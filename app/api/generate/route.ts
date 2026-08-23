import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractText, ExtractionError, MAX_FILE_SIZE_BYTES } from "@/lib/extraction";
import { truncateForBudget } from "@/lib/ai/truncate";
import { generateResumeDraft, AIGenerationError } from "@/lib/ai/generate-resume-draft";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/supabase/server";
import type { GenerateSuccessResponse, GenerateErrorResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 5;

const requestMetaSchema = z.object({
  text: z.string().max(50_000).optional(),
  fileCount: z.number().int().min(0).max(MAX_FILES),
});

function errorResponse(
  type: string,
  message: string,
  status: number
): NextResponse<GenerateErrorResponse> {
  return NextResponse.json({ error: { type, message } }, { status });
}

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateSuccessResponse | GenerateErrorResponse>> {
  // Generation is expensive and authenticated-only. Deriving the user from
  // the session also stops one signed-in user burning the shared IP budget
  // for everyone behind the same NAT.
  const userId = await getSessionUserId();
  if (!userId) {
    return errorResponse("unauthenticated", "Sign in to generate a resume.", 401);
  }

  // Two independent buckets: per-IP (Phase 1, abuse from one network) and
  // per-user (Phase 3, one account's fair share). Both must pass.
  const ipLimit = await checkRateLimit(`ip:${getClientIdentifier(request)}`);
  const userLimit = await checkRateLimit(`user:${userId}`);
  if (!ipLimit.success || !userLimit.success) {
    return errorResponse(
      "rate-limited",
      "Too many requests. Please wait a minute and try again.",
      429
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("invalid-request", "Expected multipart/form-data.", 400);
  }

  const pastedText = formData.get("text");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  const meta = requestMetaSchema.safeParse({
    text: typeof pastedText === "string" && pastedText.length > 0 ? pastedText : undefined,
    fileCount: files.length,
  });

  if (!meta.success) {
    return errorResponse("invalid-request", meta.error.issues[0]?.message ?? "Invalid request.", 400);
  }

  if (files.length === 0 && !meta.data.text) {
    return errorResponse(
      "invalid-request",
      "Provide at least one file or some pasted text.",
      400
    );
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return errorResponse(
        "too-large",
        `"${file.name}" is larger than the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`,
        413
      );
    }
  }

  const warnings: string[] = [];
  const blocks: { label: string; text: string }[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const doc = await extractText({ buffer, mimeType: file.type, name: file.name });
      blocks.push({ label: file.name, text: doc.text });
      warnings.push(...doc.warnings.map((w) => `${file.name}: ${w}`));
    } catch (error) {
      if (error instanceof ExtractionError) {
        return errorResponse(error.type, `"${file.name}": ${error.message}`, 422);
      }
      return errorResponse("extraction-failed", `Could not read "${file.name}".`, 422);
    }
  }

  if (meta.data.text) {
    blocks.push({ label: "Pasted text", text: meta.data.text });
  }

  const { text: combinedText, truncated } = truncateForBudget(blocks);
  if (truncated) {
    warnings.push(
      "The combined input was too long and was intelligently trimmed to the most resume-relevant sections."
    );
  }

  try {
    const resume = await generateResumeDraft(combinedText);
    return NextResponse.json({ resume, warnings });
  } catch (error) {
    if (error instanceof AIGenerationError) {
      return errorResponse("ai-generation-failed", error.message, 502);
    }
    return errorResponse("unknown", "Something went wrong while generating your resume.", 500);
  }
}

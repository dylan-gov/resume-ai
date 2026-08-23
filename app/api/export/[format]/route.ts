import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resumeDocSchema } from "@/lib/schema/resume";
import { getSessionUserId } from "@/lib/supabase/server";
import { EXPORTERS, buildFilename, isExportFormat } from "@/lib/export";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Generates an export of the document the client currently has open.
 *
 * The document is sent in the request body rather than read from the
 * database, because the export must reflect the live editor state including
 * unsaved edits. That is safe: it is the caller's own content, it is
 * re-validated against the Zod schema here, and nothing is read from or
 * written to another user's data. No id is accepted from the client, so
 * there is no object-reference surface to abuse.
 */
const requestSchema = z.object({
  doc: resumeDocSchema,
  title: z.string().max(200).optional(),
  // Resolved and clamped by the exporter, so a stale or partial style
  // still exports rather than failing.
  style: z.unknown().optional(),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ format: string }> }
) {
  // Authenticate before doing any work or validating input, so an
  // unauthenticated caller learns nothing about the endpoint's shape.
  const userId = await getSessionUserId();
  if (!userId) return errorResponse("Sign in to export your resume.", 401);

  const { format } = await context.params;
  if (!isExportFormat(format)) {
    return errorResponse(`Unsupported export format "${format}".`, 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Expected a JSON body.", 400);
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    // Never echo the document back — it is the user's private content.
    return errorResponse("The resume could not be validated for export.", 422);
  }

  const exporter = EXPORTERS[format];

  try {
    const { body, warnings } = await exporter.generate(parsed.data.doc, parsed.data.style);
    const filename = buildFilename(
      parsed.data.title?.trim() || parsed.data.doc.header?.name || "Resume",
      exporter.extension
    );

    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;

    return new NextResponse(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": exporter.contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        // Surfaced by the client so a PDF font limitation is never silent.
        ...(warnings.length > 0
          ? { "X-Export-Warnings": encodeURIComponent(warnings.join(" ")) }
          : {}),
      },
    });
  } catch {
    // Do not leak library internals or document contents into the response.
    return errorResponse("Could not generate the file. Please try again.", 500);
  }
}

import type { SourceFile, ExtractedDoc } from "./types";
import { ExtractionError, MAX_FILE_SIZE_BYTES } from "./types";
import { extractPdf } from "./pdf";
import { extractDocx } from "./docx";
import { extractPlainText } from "./text";

export type { SourceFile, ExtractedDoc, ExtractionErrorType } from "./types";
export { ExtractionError, MAX_FILE_SIZE_BYTES, SUPPORTED_MIME_TYPES } from "./types";

type Format = "pdf" | "docx" | "text";

/**
 * Browsers report unreliable or empty MIME types for .txt/.md, so we fall
 * back to the file extension when the declared mimeType doesn't match a
 * known format.
 */
function detectFormat(file: Pick<SourceFile, "mimeType" | "name">): Format | null {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (file.mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (
    file.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (file.mimeType === "text/plain" || file.mimeType === "text/markdown" || ext === "txt" || ext === "md") {
    return "text";
  }
  return null;
}

/**
 * Extracts normalized text from a single uploaded document. Server-side only
 * (relies on Buffer and format-specific native/WASM parsers). Throws
 * ExtractionError on any failure — never returns partial garbage — so
 * callers can surface a typed, user-facing message instead of a 500.
 */
export async function extractText(file: SourceFile): Promise<ExtractedDoc> {
  if (file.buffer.byteLength === 0) {
    throw new ExtractionError("empty", file.name, "This file is empty.");
  }

  if (file.buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ExtractionError(
      "too-large",
      file.name,
      `This file is larger than the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
    );
  }

  const format = detectFormat(file);

  switch (format) {
    case "pdf":
      return extractPdf(file);
    case "docx":
      return extractDocx(file);
    case "text":
      return extractPlainText(file);
    default:
      throw new ExtractionError(
        "unsupported-type",
        file.name,
        `Unsupported file type${file.mimeType ? ` (${file.mimeType})` : ""}. Please upload a PDF, DOCX, TXT, or MD file.`
      );
  }
}

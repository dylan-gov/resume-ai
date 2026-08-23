import mammoth from "mammoth";
import type { SourceFile, ExtractedDoc } from "./types";
import { ExtractionError } from "./types";
import { normalizeExtractedText } from "./normalize";

export async function extractDocx(file: SourceFile): Promise<ExtractedDoc> {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer: file.buffer });
  } catch {
    throw new ExtractionError(
      "corrupt",
      file.name,
      "This DOCX file could not be read. It may be corrupted or an unsupported Word format."
    );
  }

  const normalized = normalizeExtractedText(result.value);

  if (normalized.length < 20) {
    throw new ExtractionError(
      "empty",
      file.name,
      "No readable text was found in this document."
    );
  }

  const warnings = result.messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  return { text: normalized, warnings };
}

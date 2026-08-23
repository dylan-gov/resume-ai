import type { SourceFile, ExtractedDoc } from "./types";
import { ExtractionError } from "./types";
import { normalizeExtractedText } from "./normalize";

export async function extractPlainText(file: SourceFile): Promise<ExtractedDoc> {
  let raw: string;
  try {
    raw = file.buffer.toString("utf-8");
  } catch {
    throw new ExtractionError("corrupt", file.name, "This file could not be read as text.");
  }

  const normalized = normalizeExtractedText(raw);

  if (normalized.length < 1) {
    throw new ExtractionError("empty", file.name, "This file is empty.");
  }

  return { text: normalized, warnings: [] };
}

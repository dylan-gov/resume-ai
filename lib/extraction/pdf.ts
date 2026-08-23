import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import type { SourceFile, ExtractedDoc } from "./types";
import { ExtractionError } from "./types";
import { normalizeExtractedText } from "./normalize";

export async function extractPdf(file: SourceFile): Promise<ExtractedDoc> {
  let doc;
  try {
    doc = await getDocumentProxy(new Uint8Array(file.buffer));
  } catch {
    throw new ExtractionError(
      "corrupt",
      file.name,
      "This PDF could not be opened. It may be corrupted or password-protected."
    );
  }

  const { text, totalPages } = await extractPdfText(doc, { mergePages: true });
  const normalized = normalizeExtractedText(text);

  if (normalized.length < 20) {
    throw new ExtractionError(
      "empty",
      file.name,
      "No readable text was found in this PDF. It may be a scanned or image-only document — try pasting the text instead."
    );
  }

  const warnings: string[] = [];
  const avgCharsPerPage = normalized.length / Math.max(totalPages, 1);
  if (avgCharsPerPage < 100 && totalPages > 1) {
    warnings.push(
      `Very little text was extracted per page (${totalPages} pages) — some pages may be scanned images.`
    );
  }

  return { text: normalized, warnings };
}

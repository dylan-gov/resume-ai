/**
 * Collapses incidental whitespace (extraction artifacts: repeated spaces,
 * form feeds, trailing whitespace) while preserving blank lines and leading
 * indentation/bullet markers, since those are the signal that separates
 * sections and bullet points in unstructured resume text.
 */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

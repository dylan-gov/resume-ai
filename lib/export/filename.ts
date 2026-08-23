/**
 * Builds a safe download filename from a resume title.
 *
 * The result goes into a `Content-Disposition` header, so it must contain
 * no quotes, newlines, or path separators — a title is user-controlled text
 * and would otherwise be a header-injection vector.
 */
export function buildFilename(title: string, extension: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "Resume"}.${extension}`;
}

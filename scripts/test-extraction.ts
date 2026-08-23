/**
 * Runs the text extraction layer (lib/extraction) against the fixtures in
 * fixtures/ and asserts each one produces non-trivial, normalized text.
 * Not a unit test framework — just a fast, dependency-free smoke test.
 *
 *   npm run test:extraction
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { extractText } from "../lib/extraction";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "fixtures");

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

async function main() {
  const files = (await readdir(FIXTURES_DIR)).filter(
    (name) => MIME_BY_EXT[path.extname(name).toLowerCase()]
  );

  if (files.length === 0) {
    console.error(`No fixture files found in ${FIXTURES_DIR}`);
    process.exit(1);
  }

  let failures = 0;

  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    const buffer = await readFile(path.join(FIXTURES_DIR, name));

    try {
      const { text, warnings } = await extractText({
        buffer,
        mimeType: MIME_BY_EXT[ext],
        name,
      });

      if (text.trim().length < 20) {
        throw new Error(`extracted text is suspiciously short (${text.length} chars)`);
      }

      console.log(`ok    ${name}  (${text.length} chars${warnings.length ? `, ${warnings.length} warning(s)` : ""})`);
    } catch (error) {
      failures++;
      console.error(`FAIL  ${name}:`, error instanceof Error ? error.message : error);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures}/${files.length} fixture(s) failed extraction.`);
    process.exit(1);
  }

  console.log(`\nAll ${files.length} fixtures extracted successfully.`);
}

main();

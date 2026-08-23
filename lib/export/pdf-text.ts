/**
 * Character handling for the PDF exporter.
 *
 * React-PDF's built-in fonts (Helvetica et al.) are standard PDF fonts
 * encoded as WinAnsi/CP1252. Anything outside that repertoire is not just
 * unsupported — it is silently mangled. Measured: `→` (U+2192) came back
 * out of the rendered PDF as `’`, a *different character*, and `✓` vanished
 * entirely. Neither raises an error.
 *
 * Silently emitting the wrong character would violate the phase's core rule
 * that no format may invent or drop content, so unsupported characters are
 * handled explicitly here instead:
 *
 *   - characters with a faithful ASCII equivalent are transliterated
 *     (→ becomes ->), which changes presentation but not meaning;
 *   - anything still unrepresentable is replaced with a visible marker and
 *     reported as a warning, so the user is told rather than shipped a
 *     quietly corrupted document.
 *
 * DOCX, Markdown, and TXT embed no fonts and carry every character
 * perfectly, so this constraint is PDF-only — the warning points users
 * there.
 */

/** Characters CP1252 adds above Latin-1, which the standard fonts do cover. */
const CP1252_EXTRAS = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split("")
);

function isRenderable(char: string): boolean {
  const code = char.codePointAt(0)!;
  if (code >= 0x20 && code <= 0x7e) return true; // printable ASCII
  if (code >= 0xa0 && code <= 0xff) return true; // Latin-1 supplement
  if (code === 0x09 || code === 0x0a) return true; // tab, newline
  return CP1252_EXTRAS.has(char);
}

/** Meaning-preserving fallbacks for symbols that commonly appear in resumes. */
const TRANSLITERATIONS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "✓": "(check)",
  "✔": "(check)",
  "✗": "x",
  "★": "*",
  "☆": "*",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "≈": "~",
  "∞": "infinity",
  "π": "pi",
  "…": "...",
  "​": "", // zero-width space
  " ": " ", // non-breaking space → plain space
};

const REPLACEMENT = "?";

export interface SanitizedText {
  text: string;
  /** Distinct characters that had no faithful representation. */
  dropped: string[];
}

export function sanitizeForPdf(input: string): SanitizedText {
  const dropped = new Set<string>();
  let out = "";

  // Iterate by code point so surrogate pairs (emoji) are handled as one.
  for (const char of input) {
    if (isRenderable(char)) {
      out += char;
      continue;
    }
    const replacement = TRANSLITERATIONS[char];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    // Try decomposing accented forms that fall outside Latin-1.
    const decomposed = char.normalize("NFKD").replace(/\p{M}/gu, "");
    if (decomposed.length > 0 && [...decomposed].every(isRenderable)) {
      out += decomposed;
      continue;
    }
    dropped.add(char);
    out += REPLACEMENT;
  }

  return { text: out, dropped: [...dropped] };
}

/** Collects sanitization warnings across a whole document render. */
export class PdfTextSanitizer {
  private readonly dropped = new Set<string>();

  clean(input: string | undefined): string {
    if (!input) return "";
    const { text, dropped } = sanitizeForPdf(input);
    for (const char of dropped) this.dropped.add(char);
    return text;
  }

  warnings(): string[] {
    if (this.dropped.size === 0) return [];
    const chars = [...this.dropped].join(" ");
    return [
      `The PDF font cannot render these characters, so they appear as "${REPLACEMENT}": ${chars}. ` +
        `Export as DOCX, Markdown, or plain text to keep them exactly.`,
    ];
  }
}

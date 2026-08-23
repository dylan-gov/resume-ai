import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { EXPORTERS } from "./index";
import { buildFilename } from "./filename";
import { buildOutline } from "./outline";
import { sanitizeForPdf } from "./pdf-text";
import { toMarkdown } from "./markdown";
import { toPlainText } from "./text";
import { toDocx } from "./docx";
import { toPdf } from "./pdf";
import { EXPORT_FIXTURES, FULL_DOC, MINIMAL_DOC, MULTIPAGE_DOC, makeMultiPageDoc } from "./fixtures";
import type { ResumeDoc } from "@/lib/schema/resume";

/** Reads a generated PDF back out as text — proves it is not an image. */
async function pdfText(bytes: Uint8Array) {
  const doc = await getDocumentProxy(bytes);
  return extractText(doc, { mergePages: true });
}

async function docxText(bytes: Uint8Array) {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

describe("every exporter, every fixture", () => {
  for (const [name, doc] of Object.entries(EXPORT_FIXTURES)) {
    for (const exporter of Object.values(EXPORTERS)) {
      it(`${exporter.format} produces a non-empty file for the ${name} fixture`, async () => {
        const { body } = await exporter.generate(doc as ResumeDoc);
        expect(body.length).toBeGreaterThan(0);
      });
    }
  }
});

describe("PDF", () => {
  it("emits valid PDF bytes", async () => {
    const { body } = await toPdf(FULL_DOC);
    expect(Buffer.from(body.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(1000);
  });

  it("contains real selectable text, not an image", async () => {
    const { body } = await toPdf(FULL_DOC);
    const { text } = await pdfText(body);

    // Content from across the document must be extractable (ATS-parseable).
    expect(text).toContain("Northwind Systems");
    expect(text).toContain("Rebuilt the billing service");
    expect(text).toContain("University of Texas");
    expect(text).toContain("Routeplan");
    expect(text).toContain("Scaling Postgres");
  });

  it("extracts section headings as whole words, for ATS parsing", async () => {
    const { body } = await toPdf(FULL_DOC);
    const { text } = await pdfText(body);

    // Regression guard: `letterSpacing` on headings made these extract as
    // "E X P E R I E N C E", which no ATS keyword match would ever find.
    for (const heading of ["SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS", "PROJECTS"]) {
      expect(text, `heading ${heading} is not extractable as a word`).toContain(heading);
    }
  });

  it("paginates a long resume across multiple pages", async () => {
    const { body } = await toPdf(MULTIPAGE_DOC);
    const { totalPages, text } = await pdfText(body);

    expect(totalPages).toBeGreaterThan(1);
    // Nothing is clipped: content from the first and last job both survive.
    expect(text).toContain("Job 1 bullet 1");
    expect(text).toContain("Job 12 bullet 8");
  });

  it("keeps every bullet of a very long document", async () => {
    const doc = makeMultiPageDoc(4, 30);
    const { body } = await toPdf(doc);
    const { text } = await pdfText(body);

    for (let job = 1; job <= 4; job++) {
      for (let bullet = 1; bullet <= 30; bullet++) {
        expect(text).toContain(`Job ${job} bullet ${bullet}:`);
      }
    }
  });

  it("renders a document with no sections at all", async () => {
    const { body } = await toPdf(MINIMAL_DOC);
    const { text } = await pdfText(body);
    expect(text).toContain("Ada Lovelace");
  });

  it("warns instead of silently corrupting unrenderable characters", async () => {
    const doc: ResumeDoc = {
      header: { name: "张伟" },
      summary: "Shipped it 🚀",
      sections: [{ id: "summary", kind: "summary", label: "Summary" }],
    };
    const { warnings } = await toPdf(doc);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/cannot render/i);
    expect(warnings[0]).toMatch(/DOCX/);
  });

  it("renders Latin-1 and CP1252 characters without warning", async () => {
    const { warnings } = await toPdf(FULL_DOC);
    // The full fixture has accents, curly quotes, and em dashes.
    expect(warnings).toEqual([]);
  });
});

describe("PDF text sanitizer", () => {
  it("passes through characters the standard fonts support", () => {
    for (const value of ["Jordan’s", "2019 — 2022", "José Müller", "• item", "€50"]) {
      expect(sanitizeForPdf(value)).toEqual({ text: value, dropped: [] });
    }
  });

  it("transliterates symbols rather than emitting the wrong glyph", () => {
    // Measured: React-PDF renders U+2192 as "’" — a different character.
    expect(sanitizeForPdf("A → B").text).toBe("A -> B");
    expect(sanitizeForPdf("✓ done").text).toBe("(check) done");
    expect(sanitizeForPdf("a ≥ b").text).toBe("a >= b");
  });

  it("reports characters it cannot represent", () => {
    const result = sanitizeForPdf("张伟");
    expect(result.dropped).toEqual(["张", "伟"]);
    expect(result.text).toBe("??");
  });
});

describe("DOCX", () => {
  it("is a valid, openable Word document", async () => {
    const { body } = await toDocx(FULL_DOC);
    // OOXML is a zip: "PK" magic bytes.
    expect(Buffer.from(body.slice(0, 2)).toString("latin1")).toBe("PK");
    // mammoth parsing it end-to-end is a real openability check.
    const text = await docxText(body);
    expect(text.length).toBeGreaterThan(100);
  });

  it("contains the document's content as editable text", async () => {
    const { body } = await toDocx(FULL_DOC);
    const text = await docxText(body);

    expect(text).toContain("José Ólafur Müller");
    expect(text).toContain("Northwind Systems");
    expect(text).toContain("Rebuilt the billing service");
    expect(text).toContain("Routeplan");
  });

  it("uses real Word list numbering rather than literal bullet characters", async () => {
    const { body } = await toDocx(FULL_DOC);
    const zip = Buffer.from(body).toString("latin1");
    // A numbering definition part is present in the package.
    expect(zip).toContain("numbering.xml");

    const text = await docxText(body);
    // mammoth returns list text without a hardcoded glyph prefix.
    expect(text).not.toContain("• Rebuilt the billing service");
    expect(text).toContain("Rebuilt the billing service");
  });

  it("flows a multi-page document without dropping content", async () => {
    const { body } = await toDocx(MULTIPAGE_DOC);
    const text = await docxText(body);
    expect(text).toContain("Job 1 bullet 1");
    expect(text).toContain("Job 12 bullet 8");
  });

  it("preserves characters the PDF cannot render", async () => {
    const doc: ResumeDoc = {
      header: { name: "张伟" },
      summary: "Shipped it 🚀",
      sections: [{ id: "summary", kind: "summary", label: "Summary" }],
    };
    const { body, warnings } = await toDocx(doc);
    const text = await docxText(body);

    expect(warnings).toEqual([]);
    expect(text).toContain("张伟");
    expect(text).toContain("🚀");
  });
});

describe("Markdown", () => {
  it("matches its snapshot for the full fixture", async () => {
    await expect(toMarkdown(FULL_DOC)).toMatchFileSnapshot(
      "./__snapshots__/full-resume.md"
    );
  });

  it("matches its snapshot for the minimal fixture", async () => {
    await expect(toMarkdown(MINIMAL_DOC)).toMatchFileSnapshot(
      "./__snapshots__/minimal-resume.md"
    );
  });

  it("renders links as markdown links", () => {
    const md = toMarkdown(FULL_DOC);
    expect(md).toContain("[GitHub](https://github.com/example)");
    expect(md).toContain("[Routeplan](https://routeplan.example.com)");
  });

  it("renders bullets as - lists", () => {
    const md = toMarkdown(FULL_DOC);
    expect(md).toContain("- Rebuilt the billing service");
  });
});

describe("plain text", () => {
  it("matches its snapshot for the full fixture", async () => {
    await expect(toPlainText(FULL_DOC)).toMatchFileSnapshot(
      "./__snapshots__/full-resume.txt"
    );
  });

  it("contains no markup", () => {
    const txt = toPlainText(FULL_DOC);
    // `*` is fine as a plain-text bullet glyph; markdown syntax is not.
    expect(txt).not.toMatch(/\]\(/); // links
    expect(txt).not.toMatch(/\*\*/); // bold
    expect(txt).not.toMatch(/^#{1,6} /m); // headings
    expect(txt).not.toMatch(/`/); // code spans
    // URLs appear bare, not wrapped in markdown syntax.
    expect(txt).toContain("https://routeplan.example.com");
  });
});

/**
 * The phase's hard requirement: all four formats render the same document,
 * so none may invent, drop, or reorder content.
 */
describe("cross-format fidelity", () => {
  const REQUIRED = [
    "Northwind Systems",
    "Fenwick Data Co.",
    "University of Texas at Austin",
    "Routeplan",
    "AWS Solutions Architect",
    "Austin Backend Meetup",
    "Scaling Postgres",
  ];

  it("every format contains every entry in the document", async () => {
    const md = toMarkdown(FULL_DOC);
    const txt = toPlainText(FULL_DOC);
    const { body: docxBytes } = await toDocx(FULL_DOC);
    const { body: pdfBytes } = await toPdf(FULL_DOC);
    const docx = await docxText(docxBytes);
    const { text: pdf } = await pdfText(pdfBytes);

    for (const value of REQUIRED) {
      expect(md, `markdown missing ${value}`).toContain(value);
      expect(txt, `txt missing ${value}`).toContain(value);
      expect(docx, `docx missing ${value}`).toContain(value);
      expect(pdf, `pdf missing ${value}`).toContain(value);
    }
  });

  it("no format prints a section that has no entries", async () => {
    const md = toMarkdown(FULL_DOC);
    const txt = toPlainText(FULL_DOC);
    const { body: docxBytes } = await toDocx(FULL_DOC);
    const docx = await docxText(docxBytes);
    const { body: pdfBytes } = await toPdf(FULL_DOC);
    const { text: pdf } = await pdfText(pdfBytes);

    for (const [label, output] of Object.entries({ md, txt, docx, pdf })) {
      expect(output, `${label} printed an empty section`).not.toContain("Empty Section");
    }
  });

  it("no format emits a blank bullet", () => {
    const outline = buildOutline(FULL_DOC);
    const job = outline.sections.find((s) => s.kind === "workExperience")!.entries[0];
    expect(job.bullets).toHaveLength(2);
  });

  it("respects the user's section order in every format", async () => {
    // Reverse the section order and assert each format follows.
    const reordered: ResumeDoc = {
      ...FULL_DOC,
      sections: [...(FULL_DOC.sections ?? [])].reverse(),
    };

    const md = toMarkdown(reordered);
    const txt = toPlainText(reordered);
    const { body: pdfBytes } = await toPdf(reordered);
    const { text: pdf } = await pdfText(pdfBytes);

    for (const [label, raw] of Object.entries({ md, txt, pdf })) {
      // TXT upper-cases section headings, so compare case-insensitively.
      const output = raw.toLowerCase();
      const speaking = output.indexOf("speaking");
      const experience = output.indexOf("experience");
      expect(speaking, `${label} lost section order`).toBeGreaterThan(-1);
      expect(experience, `${label} lost section order`).toBeGreaterThan(-1);
      // "Speaking" was last; reversed it must now precede "Experience".
      expect(speaking, `${label} did not honor reordering`).toBeLessThan(experience);
    }
  });

  it("drops a deleted section from every format", async () => {
    const withoutEducation: ResumeDoc = {
      ...FULL_DOC,
      education: undefined,
      sections: (FULL_DOC.sections ?? []).filter((s) => s.kind !== "education"),
    };

    const md = toMarkdown(withoutEducation);
    const txt = toPlainText(withoutEducation);
    const { body } = await toPdf(withoutEducation);
    const { text: pdf } = await pdfText(body);

    for (const [label, output] of Object.entries({ md, txt, pdf })) {
      expect(output, `${label} resurrected a deleted section`).not.toContain(
        "University of Texas"
      );
    }
  });
});

describe("filenames", () => {
  it("sanitizes a title into a safe download name", () => {
    expect(buildFilename("Dylan Gov", "pdf")).toBe("Dylan-Gov.pdf");
    expect(buildFilename("José's Résumé (v2)", "docx")).toBe("Jose-s-Resume-v2.docx");
  });

  it("never produces header-injection or path characters", () => {
    const nasty = buildFilename('../../etc/passwd"; drop\n', "pdf");
    expect(nasty).not.toMatch(/[/\\"\n]/);
  });

  it("falls back when a title has no usable characters", () => {
    expect(buildFilename("张伟", "txt")).toBe("Resume.txt");
  });
});

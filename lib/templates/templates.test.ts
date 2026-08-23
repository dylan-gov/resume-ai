import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import JSZip from "jszip";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TemplateRenderer } from "@/components/resume/template-renderer";
import { toPdf } from "@/lib/export/pdf";
import { toDocx } from "@/lib/export/docx";
import { FULL_DOC, MULTIPAGE_DOC } from "@/lib/export/fixtures";
import { buildOutline } from "@/lib/export/outline";
import type { ResumeDoc } from "@/lib/schema/resume";
import {
  DEFAULT_STYLE,
  STYLE_BOUNDS,
  TEMPLATE_IDS,
  checkContrast,
  contrastOnWhite,
  resolveStyle,
  styleConfigSchema,
  type StyleConfig,
  type TemplateId,
} from "./style";
import { TEMPLATE_LIST, applyTemplate } from "./registry";
import { resolveTheme } from "./theme";

function styleFor(templateId: TemplateId, overrides: Partial<StyleConfig> = {}): StyleConfig {
  // Picking a template adopts its designed look, then any explicit override.
  return resolveStyle({ ...applyTemplate(templateId), ...overrides });
}

function renderHtml(doc: ResumeDoc, style: StyleConfig): string {
  return renderToStaticMarkup(createElement(TemplateRenderer, { doc, style }));
}

/** Text content of the rendered HTML, tags stripped. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&(?:middot|#183);/g, "·")
    .replace(/\s+/g, " ")
    .trim();
}

/** Everything the document says, as the outline defines it. */
function expectedStrings(doc: ResumeDoc): string[] {
  const outline = buildOutline(doc);
  const values: string[] = [];
  if (outline.header.name) values.push(outline.header.name);
  for (const section of outline.sections) {
    values.push(section.label);
    if (section.paragraph) values.push(section.paragraph);
    for (const entry of section.entries) {
      if (entry.title) values.push(entry.title);
      if (entry.subtitle) values.push(entry.subtitle);
      if (entry.description) values.push(entry.description);
      values.push(...entry.bullets);
    }
  }
  return values.filter((v) => v.trim().length > 2);
}

/* ------------------------- the template contract ------------------------ */

describe("template contract: content is never changed by presentation", () => {
  it.each(TEMPLATE_IDS)("%s renders every section and entry in the document", (templateId) => {
    const text = textOf(renderHtml(FULL_DOC, styleFor(templateId)));

    for (const value of expectedStrings(FULL_DOC)) {
      expect(text, `${templateId} dropped: ${value}`).toContain(value);
    }
  });

  it.each(TEMPLATE_IDS)("%s keeps sections in the document's order", (templateId) => {
    // Unique sentinel labels: the real fixture has "Languages" as both a
    // section heading and a skills category, so a plain indexOf would find
    // the category first and report a false reordering.
    const marked: ResumeDoc = {
      ...FULL_DOC,
      sections: (FULL_DOC.sections ?? []).map((section, i) => ({
        ...section,
        label: `ZQSECTION${i}`,
      })),
    };

    const text = textOf(renderHtml(marked, styleFor(templateId)));
    const labels = buildOutline(marked).sections.map((s) => s.label);

    const positions = labels.map((label) => text.indexOf(label));
    expect(positions.every((p) => p >= 0), `${templateId} lost a section`).toBe(true);
    expect(positions, `${templateId} reordered sections`).toEqual(
      [...positions].sort((a, b) => a - b)
    );
  });

  it.each(TEMPLATE_IDS)("%s adds no section that is not in the document", (templateId) => {
    const text = textOf(renderHtml(FULL_DOC, styleFor(templateId)));
    // The fixture carries an empty section that must never print.
    expect(text).not.toContain("Empty Section");
  });

  it("renders identical text content across all seven templates", () => {
    // The strongest form of the rule: presentation differs, content does not.
    const perTemplate = TEMPLATE_IDS.map((id) =>
      expectedStrings(FULL_DOC).map((value) => textOf(renderHtml(FULL_DOC, styleFor(id))).includes(value))
    );
    for (const results of perTemplate) {
      expect(results.every(Boolean)).toBe(true);
    }
  });

  it("does not mutate the document when switching templates", () => {
    const before = structuredClone(FULL_DOC);
    for (const id of TEMPLATE_IDS) renderHtml(FULL_DOC, styleFor(id));
    expect(FULL_DOC).toEqual(before);
  });

  it("produces visually different markup per template", () => {
    // Guards against seven templates that are secretly the same design.
    const markup = TEMPLATE_IDS.map((id) => renderHtml(FULL_DOC, styleFor(id)));
    expect(new Set(markup).size).toBe(TEMPLATE_IDS.length);
  });
});

/* ------------------------------ StyleConfig ----------------------------- */

describe("StyleConfig", () => {
  it("round-trips through persistence unchanged", () => {
    const style = styleFor("technical", { accentColor: "#0f766e", fontScale: 1.1 });
    const persisted = JSON.parse(JSON.stringify(style));
    expect(resolveStyle(persisted)).toEqual(style);
    expect(styleConfigSchema.safeParse(persisted).success).toBe(true);
  });

  it("clamps out-of-range values instead of refusing to render", () => {
    const style = resolveStyle({
      ...DEFAULT_STYLE,
      fontScale: 99,
      margin: 0,
      lineHeight: -5,
    });
    expect(style.fontScale).toBe(STYLE_BOUNDS.fontScale.max);
    expect(style.margin).toBe(STYLE_BOUNDS.margin.min);
    expect(style.lineHeight).toBe(STYLE_BOUNDS.lineHeight.min);
  });

  it("falls back to defaults for unknown or missing values", () => {
    expect(resolveStyle({ templateId: "nope", fontFamily: "comic" })).toMatchObject({
      templateId: DEFAULT_STYLE.templateId,
      fontFamily: DEFAULT_STYLE.fontFamily,
    });
    expect(resolveStyle(null)).toEqual(DEFAULT_STYLE);
    expect(resolveStyle(undefined)).toEqual(DEFAULT_STYLE);
  });

  it("rejects malformed colors rather than emitting broken CSS", () => {
    expect(resolveStyle({ ...DEFAULT_STYLE, accentColor: "red" }).accentColor).toBe(
      DEFAULT_STYLE.accentColor
    );
    expect(resolveStyle({ ...DEFAULT_STYLE, textColor: "#xyz" }).textColor).toBe(
      DEFAULT_STYLE.textColor
    );
  });

  it("adopts the template's designed look when a template is picked", () => {
    // Regression: without this, switching template kept the previous
    // template's font and accent, so all seven rendered nearly identically.
    const executive = applyTemplate("executive");
    const technical = applyTemplate("technical");

    expect(executive.fontFamily).toBe("serif");
    expect(technical.fontFamily).toBe("mono");
    expect(executive.accentColor).not.toBe(technical.accentColor);
  });

  it("gives each template a distinct starting look", () => {
    const looks = TEMPLATE_LIST.map((t) => {
      const s = applyTemplate(t.id);
      return `${s.fontFamily}|${s.accentColor}|${s.headerStyle}`;
    });
    // Not all seven need a unique tuple, but they must not collapse to one.
    expect(new Set(looks).size).toBeGreaterThanOrEqual(5);
  });

  it("applies a template's own defaults when the user has not chosen", () => {
    const theme = resolveTheme({ templateId: "executive" });
    expect(theme.style.fontFamily).toBe("serif");
    expect(theme.style.templateId).toBe("executive");
  });

  it("lets a saved user choice win over the template's default", () => {
    const theme = resolveTheme({ templateId: "executive", fontFamily: "mono" });
    expect(theme.style.fontFamily).toBe("mono");
  });
});

describe("contrast guardrails", () => {
  it("computes known contrast ratios against white", () => {
    expect(contrastOnWhite("#000000")).toBeCloseTo(21, 0);
    expect(contrastOnWhite("#ffffff")).toBeCloseTo(1, 1);
  });

  it("warns about unreadable body text", () => {
    const warnings = checkContrast({ ...DEFAULT_STYLE, textColor: "#cccccc" });
    expect(warnings.some((w) => w.field === "textColor")).toBe(true);
  });

  it("warns about an accent that vanishes in grayscale", () => {
    const warnings = checkContrast({ ...DEFAULT_STYLE, accentColor: "#f5f5f5" });
    expect(warnings.some((w) => w.field === "accentColor")).toBe(true);
  });

  it("passes every template's own defaults", () => {
    for (const template of TEMPLATE_LIST) {
      const warnings = checkContrast(styleFor(template.id));
      const blocking = warnings.filter((w) => w.ratio < 4.5 && w.field === "textColor");
      expect(blocking, `${template.id} ships an unreadable default`).toEqual([]);
    }
  });
});

/* ------------------------- export integration --------------------------- */

async function pdfText(bytes: Uint8Array) {
  const doc = await getDocumentProxy(bytes);
  return extractText(doc, { mergePages: true });
}

describe("exports respect the active template", () => {
  it.each(TEMPLATE_IDS)("%s exports a PDF with all content as real text", async (templateId) => {
    const { body } = await toPdf(FULL_DOC, styleFor(templateId));
    expect(Buffer.from(body.slice(0, 5)).toString("latin1")).toBe("%PDF-");

    const { text } = await pdfText(body);
    for (const value of ["Northwind Systems", "University of Texas at Austin", "Routeplan"]) {
      expect(text, `${templateId} PDF dropped ${value}`).toContain(value);
    }
  });

  it.each(TEMPLATE_IDS)("%s keeps section headings ATS-extractable", async (templateId) => {
    // Every template must stay machine-readable — that is the product's
    // core promise, and visual distinctiveness never overrides it.
    const { body } = await toPdf(FULL_DOC, styleFor(templateId));
    const { text } = await pdfText(body);

    for (const heading of ["EXPERIENCE", "EDUCATION", "SKILLS"]) {
      expect(text, `${templateId} heading ${heading} is not extractable`).toContain(heading);
    }
  });

  it("keeps the gutter-label template's reading order intact", async () => {
    // Creative and Technical put labels in a left gutter; the label must
    // still be emitted before the content it describes.
    for (const templateId of ["creative", "technical"] as const) {
      const { body } = await toPdf(FULL_DOC, styleFor(templateId));
      const { text } = await pdfText(body);
      expect(
        text.indexOf("EXPERIENCE"),
        `${templateId} lost reading order`
      ).toBeLessThan(text.indexOf("Northwind Systems"));
    }
  });

  it("renders a non-default template's PDF differently from the default", async () => {
    const modern = await toPdf(FULL_DOC, styleFor("modern"));
    const executive = await toPdf(FULL_DOC, styleFor("executive"));
    // Same content, different presentation — so the bytes must differ.
    expect(Buffer.from(modern.body).equals(Buffer.from(executive.body))).toBe(false);
  });

  it("carries template styling into DOCX", async () => {
    const { body } = await toDocx(FULL_DOC, styleFor("technical"));
    expect(Buffer.from(body.slice(0, 2)).toString("latin1")).toBe("PK");

    // A .docx is a zip, so the styling lives in compressed parts — read
    // them properly rather than grepping the archive bytes.
    const zip = await JSZip.loadAsync(Buffer.from(body));
    const styles = await zip.file("word/styles.xml")!.async("string");
    const documentXml = await zip.file("word/document.xml")!.async("string");

    // Technical maps to a monospace Word face and a teal accent.
    expect(styles).toContain("Consolas");
    expect(documentXml).toContain("0F766E");

    const text = (await mammoth.extractRawText({ buffer: Buffer.from(body) })).value;
    expect(text).toContain("Northwind Systems");
  });

  it("produces different DOCX bytes for different templates", async () => {
    const a = await toDocx(FULL_DOC, styleFor("executive"));
    const b = await toDocx(FULL_DOC, styleFor("technical"));
    expect(Buffer.from(a.body).equals(Buffer.from(b.body))).toBe(false);
  });

  it("still paginates a long resume in every template", async () => {
    for (const templateId of TEMPLATE_IDS) {
      const { body } = await toPdf(MULTIPAGE_DOC, styleFor(templateId));
      const { totalPages, text } = await pdfText(body);
      expect(totalPages, `${templateId} did not paginate`).toBeGreaterThan(1);
      expect(text, `${templateId} clipped content`).toContain("Job 12 bullet 8");
    }
  });
});

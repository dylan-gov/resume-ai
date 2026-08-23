import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from "docx";
import type { ResumeDoc } from "@/lib/schema/resume";
import { resolveTheme, type ResolvedTheme } from "@/lib/templates/theme";
import { buildOutline, type OutlineEntry, type OutlineSection } from "./outline";
import type { Exporter, ExportResult } from "./types";

/**
 * Real Word document: styled headings, proper paragraph/run structure,
 * bullets as an actual numbering definition (not literal "•" characters),
 * and real hyperlinks. Everything stays editable text — nothing is
 * flattened to an image.
 *
 * Templates reach DOCX as a **theme**, not as a layout. Word cannot honestly
 * express a gutter-label or a full-bleed accent band without abusing tables
 * and frames, which is exactly what makes a .docx unparseable to an ATS —
 * the one thing this product must not do. So DOCX takes the parts of a
 * template that translate faithfully (typeface, accent, case, spacing,
 * heading rule, bullet glyph) and keeps the structure Word is good at. This
 * is a deliberate limit, documented in docs/architecture.md.
 */

const BULLET_REFERENCE = "resume-bullets";

/** Word wants bare hex; the theme carries CSS-style `#rrggbb`. */
const hx = (color: string) => color.replace("#", "").toUpperCase();
/** Word sizes are half-points. */
const halfPt = (pt: number) => Math.round(pt * 2);

const RIGHT_TAB = convertInchesToTwip(7.0);

function runs(
  text: string,
  opts: { bold?: boolean; color?: string; size?: number; font?: string } = {}
) {
  return new TextRun({
    text,
    bold: opts.bold,
    color: opts.color,
    size: opts.size,
    font: opts.font,
  });
}

function entryParagraphs(entry: OutlineEntry, theme: ResolvedTheme): Paragraph[] {
  const accent = hx(theme.colors.accent);
  const muted = hx(theme.colors.muted);
  const metaSize = halfPt(theme.size.meta);

  if (entry.inline) {
    return [
      new Paragraph({
        spacing: { after: 40 },
        children: [runs(`${entry.title}: `, { bold: true }), runs(entry.inline)],
      }),
    ];
  }

  const titleChildren: (TextRun | ExternalHyperlink)[] = [];

  if (entry.url) {
    titleChildren.push(
      new ExternalHyperlink({
        link: entry.url,
        children: [runs(entry.title, { bold: true, color: accent })],
      })
    );
  } else {
    titleChildren.push(runs(entry.title, { bold: true }));
  }

  if (entry.subtitle) {
    titleChildren.push(
      runs(` · ${entry.subtitle}`, {
        color: theme.layout.accentSubtitles ? accent : muted,
      })
    );
  }

  // Dates go to a right tab stop, or onto the meta line, matching the
  // template's `dates` token.
  if (entry.dates && theme.layout.dates === "right") {
    titleChildren.push(runs("\t"), runs(entry.dates, { color: muted, size: metaSize }));
  }

  const paragraphs: Paragraph[] = [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
      spacing: { before: Math.round(theme.space.entry * 12), after: 0 },
      children: titleChildren,
    }),
  ];

  const metaLine = [theme.layout.dates === "under" ? entry.dates : null, entry.location]
    .filter(Boolean)
    .join(" · ");

  if (metaLine) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 0 },
        children: [runs(metaLine, { color: muted, size: metaSize })],
      })
    );
  }

  if (entry.description) {
    paragraphs.push(new Paragraph({ spacing: { after: 0 }, children: [runs(entry.description)] }));
  }

  for (const bullet of entry.bullets) {
    paragraphs.push(
      new Paragraph({
        numbering: { reference: BULLET_REFERENCE, level: 0 },
        spacing: { after: 0 },
        children: [runs(bullet)],
      })
    );
  }

  return paragraphs;
}

function sectionParagraphs(section: OutlineSection, theme: ResolvedTheme): Paragraph[] {
  const { layout, colors } = theme;
  const label = layout.sectionCase === "upper" ? section.label.toUpperCase() : section.label;

  // Only the devices Word can render faithfully; the rest fall back to a
  // plain heading rather than a bad imitation.
  const ruled = layout.sectionDevice === "rule-under" || layout.sectionDevice === "accent-bar";
  const accentText =
    layout.sectionDevice === "accent-bar" ||
    layout.sectionDevice === "boxed" ||
    layout.sectionDevice === "short-accent-underline";

  const heading = new Paragraph({
    spacing: {
      before: Math.round(theme.space.section * 18),
      after: 80,
    },
    border: ruled
      ? {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: hx(layout.sectionDevice === "accent-bar" ? colors.accent : colors.rule),
            space: 2,
          },
        }
      : undefined,
    children: [
      runs(label, {
        bold: true,
        size: halfPt(theme.size.sectionLabel),
        color: hx(accentText ? colors.accent : colors.text),
      }),
    ],
  });

  if (section.paragraph) {
    return [heading, new Paragraph({ children: [runs(section.paragraph)] })];
  }

  return [heading, ...section.entries.flatMap((entry) => entryParagraphs(entry, theme))];
}

export async function toDocx(doc: ResumeDoc, style?: unknown): Promise<ExportResult> {
  const theme = resolveTheme(style);
  const outline = buildOutline(doc);
  const { header } = outline;

  const accent = hx(theme.colors.accent);
  const muted = hx(theme.colors.muted);
  const metaSize = halfPt(theme.size.meta);
  const centered = theme.style.headerStyle === "centered";
  const alignment = centered ? AlignmentType.CENTER : AlignmentType.LEFT;

  const headerParagraphs: Paragraph[] = [];

  if (header.name) {
    headerParagraphs.push(
      new Paragraph({
        alignment,
        spacing: { after: 40 },
        children: [
          runs(
            theme.layout.nameCase === "upper" ? header.name.toUpperCase() : header.name,
            { bold: true, size: halfPt(theme.size.name) }
          ),
        ],
      })
    );
  }

  if (header.title) {
    headerParagraphs.push(
      new Paragraph({
        alignment,
        spacing: { after: 40 },
        children: [
          runs(header.title, {
            color: theme.layout.accentSubtitles ? accent : muted,
            size: halfPt(theme.size.headline),
          }),
        ],
      })
    );
  }

  const contactChildren: (TextRun | ExternalHyperlink)[] = [];
  const separator = () => runs("  |  ", { color: muted, size: metaSize });

  for (const contact of header.contacts) {
    if (contactChildren.length) contactChildren.push(separator());
    contactChildren.push(runs(contact, { color: muted, size: metaSize }));
  }
  for (const link of header.links) {
    if (contactChildren.length) contactChildren.push(separator());
    contactChildren.push(
      new ExternalHyperlink({
        link: link.url,
        children: [runs(link.label, { color: accent, size: metaSize })],
      })
    );
  }
  if (contactChildren.length) {
    headerParagraphs.push(
      new Paragraph({
        alignment,
        spacing: { after: Math.round(theme.space.headerBottom * 10) },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: theme.layout.headerTreatment === "boxed" ? 12 : 6,
            color: accent,
            space: 4,
          },
        },
        children: contactChildren,
      })
    );
  }

  const document = new Document({
    creator: "Resume AI",
    title: header.name ? `${header.name} — Resume` : "Resume",
    numbering: {
      config: [
        {
          reference: BULLET_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: theme.layout.bulletGlyph,
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.28), hanging: convertInchesToTwip(0.16) },
                },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: theme.fonts.docx,
            size: halfPt(theme.size.base),
            color: hx(theme.colors.text),
          },
          paragraph: { spacing: { line: Math.round(theme.lineHeight * 240) } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(theme.style.margin),
              bottom: convertInchesToTwip(theme.style.margin),
              left: convertInchesToTwip(theme.style.margin),
              right: convertInchesToTwip(theme.style.margin),
            },
          },
        },
        children: [
          ...headerParagraphs,
          ...outline.sections.flatMap((section) => sectionParagraphs(section, theme)),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return { body: new Uint8Array(buffer), warnings: [] };
}

export const docxExporter: Exporter = {
  format: "docx",
  contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  extension: "docx",
  generate: toDocx,
};

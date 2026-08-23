import { z } from "zod";

/**
 * All user-customizable presentation, as one serializable object.
 *
 * The load-bearing rule of Phase 6: **content lives in the `ResumeDoc`,
 * appearance lives here**. A template is a pure function of the two, so
 * switching templates can never add, drop, or reorder content.
 *
 * Every numeric control is bounded, because the guarantee that a resume
 * stays readable and exportable is worth more than unlimited freedom — a
 * 0.1in margin clips in print and a 4pt font is unreadable.
 */

/**
 * Curated font set.
 *
 * Deliberately small. The PDF exporter uses the standard PDF fonts (see
 * docs/architecture.md, Phase 4) so no font files ship and there is no
 * serverless font-loading failure mode. Offering ten CSS families that all
 * collapse to three PDF families would be a lie about what the export
 * looks like, so the list is exactly the families PDF can actually render.
 */
export const FONT_OPTIONS = {
  sans: {
    label: "Sans",
    description: "Helvetica / Arial — the safe default",
    css: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    pdf: { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" },
    docx: "Calibri",
  },
  serif: {
    label: "Serif",
    description: "Times — formal and traditional",
    css: '"Times New Roman", Times, Georgia, serif',
    pdf: { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic" },
    docx: "Cambria",
  },
  mono: {
    label: "Mono",
    description: "Courier — technical and precise",
    css: 'ui-monospace, "Courier New", Courier, monospace',
    pdf: { regular: "Courier", bold: "Courier-Bold", italic: "Courier-Oblique" },
    docx: "Consolas",
  },
} as const;

export type FontId = keyof typeof FONT_OPTIONS;

export const HEADER_STYLES = ["centered", "left", "split"] as const;
export type HeaderStyle = (typeof HEADER_STYLES)[number];

export const TEMPLATE_IDS = [
  "modern",
  "executive",
  "minimal",
  "corporate",
  "technical",
  "startup",
  "creative",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Bounds every control, so no setting can produce an unusable resume. */
export const STYLE_BOUNDS = {
  fontScale: { min: 0.85, max: 1.2, step: 0.05, default: 1 },
  lineHeight: { min: 1.15, max: 1.7, step: 0.05, default: 1.4 },
  sectionSpacing: { min: 0.6, max: 1.8, step: 0.1, default: 1 },
  /** Inches. Below ~0.4in most printers clip; above 1.1in wastes the page. */
  margin: { min: 0.4, max: 1.1, step: 0.05, default: 0.65 },
} as const;

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #1a4f8a");

export const styleConfigSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS),
  fontFamily: z.enum(["sans", "serif", "mono"]),
  fontScale: z.number().min(STYLE_BOUNDS.fontScale.min).max(STYLE_BOUNDS.fontScale.max),
  lineHeight: z.number().min(STYLE_BOUNDS.lineHeight.min).max(STYLE_BOUNDS.lineHeight.max),
  sectionSpacing: z
    .number()
    .min(STYLE_BOUNDS.sectionSpacing.min)
    .max(STYLE_BOUNDS.sectionSpacing.max),
  margin: z.number().min(STYLE_BOUNDS.margin.min).max(STYLE_BOUNDS.margin.max),
  accentColor: hexColor,
  textColor: hexColor,
  headerStyle: z.enum(HEADER_STYLES),
});

export type StyleConfig = z.infer<typeof styleConfigSchema>;

export const DEFAULT_STYLE: StyleConfig = {
  templateId: "modern",
  fontFamily: "sans",
  fontScale: STYLE_BOUNDS.fontScale.default,
  lineHeight: STYLE_BOUNDS.lineHeight.default,
  sectionSpacing: STYLE_BOUNDS.sectionSpacing.default,
  margin: STYLE_BOUNDS.margin.default,
  accentColor: "#1a4f8a",
  textColor: "#141414",
  headerStyle: "centered",
};

function clampNumber(value: number, bounds: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * Coerces anything into a valid StyleConfig.
 *
 * Used when loading persisted styling: a document saved before a control
 * existed, or with an out-of-range value, must still open — clamping to the
 * nearest legal value is always better than refusing to render the resume.
 */
export function resolveStyle(input: unknown, templateDefaults?: Partial<StyleConfig>): StyleConfig {
  const base: StyleConfig = { ...DEFAULT_STYLE, ...templateDefaults };
  if (!input || typeof input !== "object") return base;

  const raw = input as Record<string, unknown>;
  const pick = <K extends keyof StyleConfig>(key: K, fallback: StyleConfig[K]): StyleConfig[K] => {
    const value = raw[key];
    return value === undefined || value === null ? fallback : (value as StyleConfig[K]);
  };

  const candidate: StyleConfig = {
    templateId: TEMPLATE_IDS.includes(raw.templateId as TemplateId)
      ? (raw.templateId as TemplateId)
      : base.templateId,
    fontFamily: (["sans", "serif", "mono"] as const).includes(raw.fontFamily as FontId)
      ? (raw.fontFamily as FontId)
      : base.fontFamily,
    fontScale: clampNumber(Number(pick("fontScale", base.fontScale)), STYLE_BOUNDS.fontScale),
    lineHeight: clampNumber(Number(pick("lineHeight", base.lineHeight)), STYLE_BOUNDS.lineHeight),
    sectionSpacing: clampNumber(
      Number(pick("sectionSpacing", base.sectionSpacing)),
      STYLE_BOUNDS.sectionSpacing
    ),
    margin: clampNumber(Number(pick("margin", base.margin)), STYLE_BOUNDS.margin),
    accentColor: hexColor.safeParse(raw.accentColor).success
      ? (raw.accentColor as string)
      : base.accentColor,
    textColor: hexColor.safeParse(raw.textColor).success
      ? (raw.textColor as string)
      : base.textColor,
    headerStyle: HEADER_STYLES.includes(raw.headerStyle as HeaderStyle)
      ? (raw.headerStyle as HeaderStyle)
      : base.headerStyle,
  };

  return candidate;
}

/* ----------------------------- contrast ------------------------------- */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio against paper white, where a resume is actually read. */
export function contrastOnWhite(hex: string): number {
  const luminance = relativeLuminance(hex);
  return Math.round(((1.05) / (luminance + 0.05)) * 100) / 100;
}

export interface ContrastWarning {
  field: "accentColor" | "textColor";
  ratio: number;
  message: string;
}

/**
 * Warns rather than blocks. A pale accent on a heading is a defensible
 * design choice; pale body text is not, so the thresholds differ.
 */
export function checkContrast(style: StyleConfig): ContrastWarning[] {
  const warnings: ContrastWarning[] = [];

  const text = contrastOnWhite(style.textColor);
  if (text < 7) {
    warnings.push({
      field: "textColor",
      ratio: text,
      message:
        text < 4.5
          ? `Body text contrast is ${text}:1 — below the 4.5:1 minimum for readable print. Choose a darker color.`
          : `Body text contrast is ${text}:1. It passes, but resumes are often printed in grayscale; darker is safer.`,
    });
  }

  const accent = contrastOnWhite(style.accentColor);
  if (accent < 3) {
    warnings.push({
      field: "accentColor",
      ratio: accent,
      message: `Accent contrast is ${accent}:1 — headings and links may be hard to read, and will nearly vanish when printed in grayscale.`,
    });
  }

  return warnings;
}

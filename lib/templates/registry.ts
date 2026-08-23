import { DEFAULT_STYLE, type StyleConfig, type TemplateId } from "./style";

/**
 * Templates are described as **tokens**, not as seven hand-built layouts.
 *
 * One preview renderer and one PDF renderer interpret these tokens, which
 * is what keeps the export integration tractable: adding a template is a
 * data change, and it lands in the live preview and in PDF at the same
 * moment, with no chance of the two drifting apart.
 *
 * The tokens were chosen to be the things that actually distinguish
 * professional resume designs — type pairing, spacing rhythm, how the name
 * and dates are treated, and the device used to mark a section — rather
 * than colour, which is the shallowest axis of difference.
 */

/** How the name/contact block is arranged. */
export type HeaderTreatment =
  | "plain"
  | "rule-under"
  | "accent-band"
  | "boxed"
  | "oversized";

/** The device that marks the start of a section. */
export type SectionDevice =
  | "rule-under"
  | "accent-bar"
  | "plain-caps"
  | "short-accent-underline"
  | "side-label"
  | "boxed";

export type Density = "airy" | "normal" | "dense";

export interface TemplateLayout {
  headerTreatment: HeaderTreatment;
  nameCase: "normal" | "upper";
  /** Letter-spacing on the name, in em. */
  nameTracking: number;
  /** Name size multiplier relative to base body size. */
  nameScale: number;
  sectionDevice: SectionDevice;
  sectionCase: "upper" | "title";
  /** Section label size multiplier. */
  sectionScale: number;
  sectionTracking: number;
  /** Where an entry's dates sit. */
  dates: "right" | "under";
  density: Density;
  bulletGlyph: string;
  /** A hairline between entries. */
  entryDividers: boolean;
  /** Secondary text (company, school) rendered in the accent colour. */
  accentSubtitles: boolean;
}

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  /** The persona this design is for — shown in the template picker. */
  description: string;
  layout: TemplateLayout;
  /** Starting styling when the user picks this template. */
  defaults: Partial<StyleConfig>;
}

const DENSITY_SCALE: Record<Density, { section: number; entry: number; bullet: number }> = {
  airy: { section: 1.5, entry: 1.15, bullet: 1.15 },
  normal: { section: 1, entry: 1, bullet: 1 },
  dense: { section: 0.72, entry: 0.75, bullet: 0.8 },
};

export function densityScale(density: Density) {
  return DENSITY_SCALE[density];
}

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  /** Confident and current: a clear accent bar and a strong hierarchy. */
  modern: {
    id: "modern",
    name: "Modern",
    description: "Clean sans-serif with a bold accent bar. A safe, current default.",
    layout: {
      headerTreatment: "rule-under",
      nameCase: "normal",
      nameTracking: -0.01,
      nameScale: 2.2,
      sectionDevice: "accent-bar",
      sectionCase: "upper",
      sectionScale: 0.85,
      sectionTracking: 0.08,
      dates: "right",
      density: "normal",
      bulletGlyph: "•",
      entryDividers: false,
      accentSubtitles: false,
    },
    defaults: {
      fontFamily: "sans",
      accentColor: "#2f6f8f",
      textColor: "#141414",
      headerStyle: "centered",
    },
  },

  /** Formal, serif, senior. Restraint signals seniority; accent is nearly absent. */
  executive: {
    id: "executive",
    name: "Executive",
    description: "Formal serif with wide-tracked capitals. Reads senior and traditional.",
    layout: {
      headerTreatment: "rule-under",
      nameCase: "upper",
      nameTracking: 0.16,
      nameScale: 1.85,
      sectionDevice: "rule-under",
      sectionCase: "upper",
      sectionScale: 0.8,
      sectionTracking: 0.18,
      dates: "right",
      density: "airy",
      bulletGlyph: "–",
      entryDividers: false,
      accentSubtitles: false,
    },
    defaults: {
      fontFamily: "serif",
      accentColor: "#3f3f46",
      textColor: "#111111",
      headerStyle: "centered",
      lineHeight: 1.5,
      margin: 0.8,
    },
  },

  /** Airy and restrained: no rules, no colour, nothing but hierarchy. */
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "No rules, no colour — space and typography do all the work.",
    layout: {
      headerTreatment: "plain",
      nameCase: "normal",
      nameTracking: -0.02,
      nameScale: 1.9,
      sectionDevice: "plain-caps",
      sectionCase: "upper",
      sectionScale: 0.75,
      sectionTracking: 0.14,
      dates: "right",
      density: "airy",
      bulletGlyph: "–",
      entryDividers: false,
      accentSubtitles: false,
    },
    defaults: {
      fontFamily: "sans",
      accentColor: "#52525b",
      textColor: "#18181b",
      headerStyle: "left",
      lineHeight: 1.55,
      margin: 0.9,
    },
  },

  /** Structured and conservative: banded header, ruled sections, dividers. */
  corporate: {
    id: "corporate",
    name: "Corporate",
    description: "A banded header and ruled sections. Structured and conservative.",
    layout: {
      headerTreatment: "accent-band",
      nameCase: "upper",
      nameTracking: 0.05,
      nameScale: 1.9,
      sectionDevice: "rule-under",
      sectionCase: "upper",
      sectionScale: 0.82,
      sectionTracking: 0.1,
      dates: "right",
      density: "normal",
      bulletGlyph: "•",
      entryDividers: true,
      accentSubtitles: false,
    },
    defaults: {
      fontFamily: "sans",
      accentColor: "#1f3a5f",
      textColor: "#111827",
      headerStyle: "centered",
      sectionSpacing: 0.9,
    },
  },

  /** Dense and information-rich, with section labels in a left gutter. */
  technical: {
    id: "technical",
    name: "Technical",
    description: "Monospace-accented, dense, with section labels in a left gutter.",
    layout: {
      headerTreatment: "plain",
      nameCase: "normal",
      nameTracking: -0.01,
      nameScale: 1.7,
      sectionDevice: "side-label",
      sectionCase: "upper",
      sectionScale: 0.72,
      sectionTracking: 0.1,
      dates: "right",
      density: "dense",
      bulletGlyph: "▸",
      entryDividers: false,
      accentSubtitles: true,
    },
    defaults: {
      fontFamily: "mono",
      accentColor: "#0f766e",
      textColor: "#18181b",
      headerStyle: "left",
      fontScale: 0.92,
      lineHeight: 1.3,
      sectionSpacing: 0.8,
      margin: 0.55,
    },
  },

  /** Energetic: an oversized name and a short accent underline per section. */
  startup: {
    id: "startup",
    name: "Startup",
    description: "Oversized name, generous accent, punchy hierarchy.",
    layout: {
      headerTreatment: "oversized",
      nameCase: "normal",
      nameTracking: -0.03,
      nameScale: 2.8,
      sectionDevice: "short-accent-underline",
      sectionCase: "upper",
      sectionScale: 0.8,
      sectionTracking: 0.12,
      dates: "right",
      density: "normal",
      bulletGlyph: "•",
      entryDividers: false,
      accentSubtitles: true,
    },
    defaults: {
      fontFamily: "sans",
      accentColor: "#6d28d9",
      textColor: "#171717",
      headerStyle: "left",
    },
  },

  /**
   * The deliberate layout risk: a split header and every section label set
   * in a left gutter beside its content. In the PDF the label is still
   * emitted before its content, so the extracted reading order stays
   * exactly as an ATS expects.
   */
  creative: {
    id: "creative",
    name: "Creative",
    description: "Split header with section labels in a gutter. Distinctive but still parseable.",
    layout: {
      headerTreatment: "boxed",
      nameCase: "normal",
      nameTracking: -0.02,
      nameScale: 2.5,
      sectionDevice: "side-label",
      sectionCase: "upper",
      sectionScale: 0.75,
      sectionTracking: 0.14,
      dates: "under",
      density: "normal",
      bulletGlyph: "—",
      entryDividers: false,
      accentSubtitles: true,
    },
    defaults: {
      fontFamily: "sans",
      accentColor: "#b0455a",
      textColor: "#1c1917",
      headerStyle: "split",
      margin: 0.7,
    },
  },
};

export const TEMPLATE_LIST: TemplateDefinition[] = Object.values(TEMPLATES);

export function getTemplate(id: TemplateId): TemplateDefinition {
  return TEMPLATES[id];
}

/**
 * The styling to use when the user picks a template.
 *
 * Choosing a template **adopts that template's designed look** — its
 * typeface, accent, and spacing — rather than carrying the previous
 * template's customizations across. Without this, switching template would
 * only change layout tokens while keeping the old font and colour, and the
 * seven designs would look far more alike than they are meant to.
 *
 * The trade-off is that a switch discards manual tweaks. That is the right
 * default for "flip between templates to compare", and it is undoable like
 * any other edit.
 */
export function applyTemplate(templateId: TemplateId): StyleConfig {
  return { ...DEFAULT_STYLE, ...TEMPLATES[templateId].defaults, templateId };
}

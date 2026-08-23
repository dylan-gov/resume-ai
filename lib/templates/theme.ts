import { FONT_OPTIONS, resolveStyle, type StyleConfig } from "./style";
import { densityScale, getTemplate, type TemplateLayout } from "./registry";

/**
 * The concrete numbers a template renders with, derived once from
 * (template, StyleConfig).
 *
 * Both the on-screen preview and the PDF exporter consume this same object.
 * That is what makes "the PDF matches what you see" a structural property
 * rather than a promise: neither renderer computes a size, a colour, or a
 * spacing of its own.
 *
 * Everything is in points, because that is what the PDF works in and what
 * a printed resume is actually specified in; the preview scales points to
 * CSS pixels with a single constant.
 */

/** Points → CSS pixels for the preview. 1pt = 1/72in, and CSS is 96dpi. */
export const PT_TO_PX = 96 / 72;

export interface ResolvedTheme {
  layout: TemplateLayout;
  colors: {
    text: string;
    accent: string;
    /** Secondary text: companies, dates, locations. */
    muted: string;
    /** Hairlines and rules. */
    rule: string;
    /** Text drawn on top of an accent band. */
    onAccent: string;
  };
  fonts: {
    css: string;
    pdf: { regular: string; bold: string; italic: string };
    docx: string;
  };
  size: {
    base: number;
    name: number;
    headline: number;
    sectionLabel: number;
    entryTitle: number;
    meta: number;
  };
  space: {
    section: number;
    entry: number;
    bullet: number;
    headerBottom: number;
    /** Width of the left gutter for `side-label` sections. */
    gutter: number;
  };
  lineHeight: number;
  /** Page margin in points. */
  margin: number;
  style: StyleConfig;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/** Mixes a hex colour toward white; used to derive muted text and rules. */
function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => clampChannel(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminanceOf(hex: string): number {
  const toLinear = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(parseInt(hex.slice(1, 3), 16)) +
    0.7152 * toLinear(parseInt(hex.slice(3, 5), 16)) +
    0.0722 * toLinear(parseInt(hex.slice(5, 7), 16))
  );
}

/** Base body size in points before the user's scale is applied. */
const BASE_SIZE_PT = 9.6;

export function resolveTheme(input: unknown): ResolvedTheme {
  // Two-pass: read the template first so its defaults seed the style, then
  // let the user's saved values win over those defaults.
  const provisional = resolveStyle(input);
  const template = getTemplate(provisional.templateId);
  const style = resolveStyle(input, template.defaults);

  const { layout } = template;
  const density = densityScale(layout.density);
  const font = FONT_OPTIONS[style.fontFamily];
  const base = BASE_SIZE_PT * style.fontScale;

  return {
    layout,
    colors: {
      text: style.textColor,
      accent: style.accentColor,
      muted: lighten(style.textColor, 0.42),
      rule: lighten(style.textColor, 0.78),
      // Keep band text legible whichever accent the user picked.
      onAccent: relativeLuminanceOf(style.accentColor) > 0.5 ? style.textColor : "#ffffff",
    },
    fonts: { css: font.css, pdf: font.pdf, docx: font.docx },
    size: {
      base,
      name: base * layout.nameScale,
      headline: base * 1.08,
      sectionLabel: base * layout.sectionScale,
      entryTitle: base * 1.06,
      meta: base * 0.92,
    },
    space: {
      section: 12 * style.sectionSpacing * density.section,
      entry: 7 * density.entry,
      bullet: 2.2 * density.bullet,
      headerBottom: 14 * density.section,
      gutter: Math.max(58, base * 7),
    },
    lineHeight: style.lineHeight,
    margin: style.margin * 72,
    style,
  };
}

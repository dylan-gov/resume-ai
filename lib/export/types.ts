import type { ResumeDoc } from "@/lib/schema/resume";

export const EXPORT_FORMATS = ["pdf", "docx", "md", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

export interface ExportResult {
  body: Uint8Array | string;
  /** Non-fatal fidelity notes, e.g. characters a PDF font cannot render. */
  warnings: string[];
}

/**
 * Every exporter is a pure `(ResumeDoc, StyleConfig) -> bytes/string`
 * function behind one interface, so they are independently testable and
 * swappable without touching the delivery layer.
 *
 * `style` is deliberately `unknown`: it is resolved and clamped by
 * `resolveTheme`, so a document persisted before a control existed — or
 * with an out-of-range value — still exports rather than failing.
 * Text formats ignore it, because Markdown and plain text have no
 * presentation to carry.
 */
export interface Exporter {
  format: ExportFormat;
  contentType: string;
  extension: string;
  generate(doc: ResumeDoc, style?: unknown): Promise<ExportResult>;
}

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  docx: "Word (DOCX)",
  md: "Markdown",
  txt: "Plain text",
};

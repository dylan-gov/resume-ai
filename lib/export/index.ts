import type { Exporter, ExportFormat } from "./types";
import { markdownExporter } from "./markdown";
import { textExporter } from "./text";
import { docxExporter } from "./docx";
import { pdfExporter } from "./pdf";

/**
 * The exporter registry. Adding a format means adding one `Exporter` here;
 * the route handler and the UI both read from this map and need no changes.
 */
export const EXPORTERS: Record<ExportFormat, Exporter> = {
  pdf: pdfExporter,
  docx: docxExporter,
  md: markdownExporter,
  txt: textExporter,
};

export { buildFilename } from "./filename";
export { buildOutline } from "./outline";
export { toMarkdown } from "./markdown";
export { toPlainText } from "./text";
export { toDocx } from "./docx";
export { toPdf } from "./pdf";
export * from "./types";

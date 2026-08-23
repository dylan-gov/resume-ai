import type { ResumeDoc } from "@/lib/schema/resume";
import { buildOutline } from "./outline";
import type { Exporter, ExportResult } from "./types";

export function toPlainText(doc: ResumeDoc): string {
  const outline = buildOutline(doc);
  const lines: string[] = [];

  if (outline.header.name) lines.push(outline.header.name.toUpperCase(), "");
  if (outline.header.title) lines.push(outline.header.title, "");

  const contactLine = [
    ...outline.header.contacts,
    ...outline.header.links.map((l) => `${l.label}: ${l.url}`),
  ];
  if (contactLine.length) lines.push(contactLine.join(" | "), "");

  for (const section of outline.sections) {
    lines.push(section.label.toUpperCase());
    // Underline keeps sections scannable without any markup.
    lines.push("=".repeat(section.label.length));
    lines.push("");

    if (section.paragraph) {
      lines.push(section.paragraph, "");
      continue;
    }

    for (const entry of section.entries) {
      if (entry.inline) {
        lines.push(`${entry.title}: ${entry.inline}`);
        continue;
      }

      const heading = [entry.title, entry.subtitle].filter(Boolean).join(" - ");
      lines.push(entry.dates ? `${heading} (${entry.dates})` : heading);
      if (entry.location) lines.push(entry.location);
      if (entry.url) lines.push(entry.url);
      if (entry.description) lines.push(entry.description);
      for (const bullet of entry.bullets) lines.push(`  * ${bullet}`);
      lines.push("");
    }

    if (section.entries.some((e) => e.inline)) lines.push("");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export const textExporter: Exporter = {
  format: "txt",
  contentType: "text/plain; charset=utf-8",
  extension: "txt",
  async generate(doc): Promise<ExportResult> {
    return { body: toPlainText(doc), warnings: [] };
  },
};

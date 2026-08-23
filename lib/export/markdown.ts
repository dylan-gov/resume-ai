import type { ResumeDoc } from "@/lib/schema/resume";
import { buildOutline, type OutlineEntry } from "./outline";
import type { Exporter, ExportResult } from "./types";

/** Escapes characters that would otherwise become Markdown syntax. */
function escapeMd(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function link(label: string, url: string): string {
  return `[${escapeMd(label)}](${url})`;
}

function entryHeading(entry: OutlineEntry): string {
  const title = entry.url ? link(entry.title, entry.url) : escapeMd(entry.title);
  const parts = [title];
  if (entry.subtitle) parts.push(escapeMd(entry.subtitle));
  return `### ${parts.join(" — ")}`;
}

export function toMarkdown(doc: ResumeDoc): string {
  const outline = buildOutline(doc);
  const lines: string[] = [];

  if (outline.header.name) lines.push(`# ${escapeMd(outline.header.name)}`, "");
  if (outline.header.title) lines.push(`${escapeMd(outline.header.title)}`, "");

  const contactLine = [
    ...outline.header.contacts.map(escapeMd),
    ...outline.header.links.map((l) => link(l.label, l.url)),
  ];
  if (contactLine.length) lines.push(contactLine.join(" · "), "");

  for (const section of outline.sections) {
    lines.push(`## ${escapeMd(section.label)}`, "");

    if (section.paragraph) {
      lines.push(escapeMd(section.paragraph), "");
      continue;
    }

    for (const entry of section.entries) {
      // Skill-style rows read better as one line than as a heading.
      if (entry.inline) {
        lines.push(`- **${escapeMd(entry.title)}:** ${escapeMd(entry.inline)}`);
        continue;
      }

      lines.push(entryHeading(entry));
      const meta = [entry.dates, entry.location].filter(Boolean).map(String).map(escapeMd);
      if (meta.length) lines.push(`*${meta.join(" · ")}*`);
      if (entry.description) lines.push("", escapeMd(entry.description));
      if (entry.bullets.length) {
        lines.push("");
        for (const bullet of entry.bullets) lines.push(`- ${escapeMd(bullet)}`);
      }
      lines.push("");
    }

    // Inline-style sections emit no trailing blank line inside the loop.
    if (section.entries.some((e) => e.inline)) lines.push("");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export const markdownExporter: Exporter = {
  format: "md",
  contentType: "text/markdown; charset=utf-8",
  extension: "md",
  async generate(doc): Promise<ExportResult> {
    return { body: toMarkdown(doc), warnings: [] };
  },
};

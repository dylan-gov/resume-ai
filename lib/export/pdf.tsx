import {
  Document,
  Link,
  Page,
  Text,
  View,
  renderToBuffer,
  type Styles,
} from "@react-pdf/renderer";
import type { ResumeDoc } from "@/lib/schema/resume";
import { resolveTheme, type ResolvedTheme } from "@/lib/templates/theme";
import { buildOutline, type OutlineEntry, type OutlineSection, type ResumeOutline } from "./outline";
import { PdfTextSanitizer } from "./pdf-text";
import type { Exporter, ExportResult } from "./types";

/** React-PDF exposes its style type only through the Styles map. */
type PdfStyle = Styles[string];

/**
 * PDF renderer, driven by the same `ResolvedTheme` as the on-screen
 * template. Both consume identical points, colours, and layout tokens, so
 * "the PDF matches what you see" holds by construction rather than by
 * two renderers being kept in sync by hand.
 *
 * Still React-PDF primitives (Phase 4's decision): real selectable text,
 * no browser, ~0.15s cold render. Note the deliberate absence of
 * `letterSpacing` on section headings — it makes them extract as
 * "E X P E R I E N C E" and breaks ATS keyword matching (see
 * docs/architecture.md).
 */

function sectionLabelStyle(theme: ResolvedTheme): PdfStyle {
  const { layout, colors, size } = theme;
  const base: PdfStyle = {
    fontSize: size.sectionLabel,
    fontFamily: theme.fonts.pdf.bold,
    textTransform: layout.sectionCase === "upper" ? "uppercase" : "none",
    marginBottom: 4,
  };

  switch (layout.sectionDevice) {
    case "accent-bar":
      return {
        ...base,
        color: colors.accent,
        borderLeftWidth: 2.5,
        borderLeftColor: colors.accent,
        paddingLeft: 5,
      };
    case "rule-under":
      return {
        ...base,
        color: colors.text,
        borderBottomWidth: 0.75,
        borderBottomColor: colors.rule,
        paddingBottom: 2.5,
      };
    case "boxed":
      return {
        ...base,
        color: colors.onAccent,
        backgroundColor: colors.accent,
        paddingVertical: 2.5,
        paddingHorizontal: 6,
      };
    case "short-accent-underline":
      return { ...base, color: colors.text, marginBottom: 2 };
    case "plain-caps":
    case "side-label":
    default:
      return { ...base, color: colors.muted };
  }
}

function Bullets({
  items,
  theme,
  s,
}: {
  items: string[];
  theme: ResolvedTheme;
  s: PdfTextSanitizer;
}) {
  if (items.length === 0) return null;
  return (
    <View>
      {items.map((bullet, i) => (
        // A single bullet stays whole across a page break; a long list may
        // still split between bullets.
        <View key={i} style={{ flexDirection: "row", marginTop: theme.space.bullet }} wrap={false}>
          <Text style={{ width: 11, color: theme.colors.accent }}>{theme.layout.bulletGlyph}</Text>
          <Text style={{ flex: 1 }}>{s.clean(bullet)}</Text>
        </View>
      ))}
    </View>
  );
}

function Entry({
  entry,
  theme,
  s,
  isLast,
}: {
  entry: OutlineEntry;
  theme: ResolvedTheme;
  s: PdfTextSanitizer;
  isLast: boolean;
}) {
  const { colors, size, space, layout } = theme;

  if (entry.inline) {
    return (
      <View style={{ marginBottom: space.bullet }}>
        <Text>
          <Text style={{ fontFamily: theme.fonts.pdf.bold }}>{s.clean(entry.title)}: </Text>
          <Text style={{ color: colors.muted }}>{s.clean(entry.inline)}</Text>
        </Text>
      </View>
    );
  }

  const title = s.clean(entry.title);
  const metaLine = [layout.dates === "under" ? entry.dates : null, entry.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        marginBottom: isLast ? 0 : space.entry,
        paddingBottom: layout.entryDividers && !isLast ? space.entry * 0.6 : 0,
        borderBottomWidth: layout.entryDividers && !isLast ? 0.5 : 0,
        borderBottomColor: colors.rule,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ flex: 1, fontSize: size.entryTitle, fontFamily: theme.fonts.pdf.bold, paddingRight: 8 }}>
          {entry.url ? (
            <Link src={entry.url} style={{ color: colors.accent, textDecoration: "none" }}>
              {title}
            </Link>
          ) : (
            title
          )}
          {entry.subtitle ? (
            <Text
              style={{
                fontFamily: theme.fonts.pdf.regular,
                color: layout.accentSubtitles ? colors.accent : colors.muted,
              }}
            >
              {" · "}
              {s.clean(entry.subtitle)}
            </Text>
          ) : null}
        </Text>
        {layout.dates === "right" && entry.dates ? (
          <Text style={{ fontSize: size.meta, color: colors.muted }}>{s.clean(entry.dates)}</Text>
        ) : null}
      </View>

      {metaLine ? (
        <Text style={{ fontSize: size.meta, color: colors.muted }}>{s.clean(metaLine)}</Text>
      ) : null}

      {entry.description ? (
        <Text style={{ marginTop: 1.5 }}>{s.clean(entry.description)}</Text>
      ) : null}

      <Bullets items={entry.bullets} theme={theme} s={s} />
    </View>
  );
}

function SectionBody({
  section,
  theme,
  s,
}: {
  section: OutlineSection;
  theme: ResolvedTheme;
  s: PdfTextSanitizer;
}) {
  if (section.paragraph) return <Text>{s.clean(section.paragraph)}</Text>;
  return (
    <View>
      {section.entries.map((entry, i) => (
        <Entry
          key={entry.id}
          entry={entry}
          theme={theme}
          s={s}
          isLast={i === section.entries.length - 1}
        />
      ))}
    </View>
  );
}

function Section({
  section,
  theme,
  s,
}: {
  section: OutlineSection;
  theme: ResolvedTheme;
  s: PdfTextSanitizer;
}) {
  const { layout, space, colors } = theme;

  const label = (
    <View minPresenceAhead={38}>
      <Text style={sectionLabelStyle(theme)}>{s.clean(section.label)}</Text>
      {layout.sectionDevice === "short-accent-underline" && (
        <View
          style={{ width: 26, height: 2.5, backgroundColor: colors.accent, marginBottom: 5 }}
        />
      )}
    </View>
  );

  // Gutter layout: the label is still emitted *before* its content, so the
  // extracted reading order is exactly what an ATS expects.
  if (layout.sectionDevice === "side-label") {
    return (
      <View style={{ flexDirection: "row", marginBottom: space.section }}>
        <View style={{ width: space.gutter, paddingRight: 10 }}>{label}</View>
        <View style={{ flex: 1 }}>
          <SectionBody section={section} theme={theme} s={s} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: space.section }}>
      {label}
      <SectionBody section={section} theme={theme} s={s} />
    </View>
  );
}

function Header({
  outline,
  theme,
  s,
}: {
  outline: ResumeOutline;
  theme: ResolvedTheme;
  s: PdfTextSanitizer;
}) {
  const { header } = outline;
  const { layout, colors, size, space, style } = theme;

  const hasContent =
    !!header.name || !!header.title || header.contacts.length > 0 || header.links.length > 0;
  if (!hasContent) return null;

  const band = layout.headerTreatment === "accent-band";
  const onBand = band ? colors.onAccent : undefined;
  const align = style.headerStyle === "centered" ? "center" : "flex-start";

  const nameBlock = (
    <View>
      {header.name ? (
        <Text
          style={{
            fontSize: size.name,
            fontFamily: theme.fonts.pdf.bold,
            color: onBand ?? colors.text,
            textTransform: layout.nameCase === "upper" ? "uppercase" : "none",
            // Name tracking is safe: a name is not an ATS section keyword.
            letterSpacing: layout.nameTracking * size.name,
          }}
        >
          {s.clean(header.name)}
        </Text>
      ) : null}
      {header.title ? (
        <Text
          style={{
            fontSize: size.headline,
            marginTop: 2,
            color: onBand ?? (layout.accentSubtitles ? colors.accent : colors.muted),
          }}
        >
          {s.clean(header.title)}
        </Text>
      ) : null}
    </View>
  );

  const contactBlock = (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 4,
        justifyContent: style.headerStyle === "split" ? "flex-end" : align,
      }}
    >
      {header.contacts.map((contact, i) => (
        <Text
          key={`c-${i}`}
          style={{ fontSize: size.meta, color: onBand ?? colors.muted, marginRight: 8 }}
        >
          {s.clean(contact)}
        </Text>
      ))}
      {header.links.map((link, i) => (
        <Link
          key={`l-${i}`}
          src={link.url}
          style={{ fontSize: size.meta, color: onBand ?? colors.accent, marginRight: 8 }}
        >
          {s.clean(link.label)}
        </Link>
      ))}
    </View>
  );

  return (
    <View
      style={{
        marginBottom: space.headerBottom,
        paddingBottom:
          layout.headerTreatment === "rule-under" || layout.headerTreatment === "boxed" ? 7 : 0,
        borderBottomWidth:
          layout.headerTreatment === "rule-under" ? 1.2 : layout.headerTreatment === "boxed" ? 2.5 : 0,
        borderBottomColor: colors.accent,
        backgroundColor: band ? colors.accent : undefined,
        padding: band ? 12 : undefined,
        alignItems: style.headerStyle === "centered" ? "center" : undefined,
        ...(style.headerStyle === "split"
          ? { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }
          : {}),
      }}
    >
      {nameBlock}
      {contactBlock}
    </View>
  );
}

function ResumePdf({
  doc,
  theme,
  s,
}: {
  doc: ResumeDoc;
  theme: ResolvedTheme;
  s: PdfTextSanitizer;
}) {
  const outline = buildOutline(doc);

  return (
    <Document
      title={outline.header.name ? `${outline.header.name} — Resume` : "Resume"}
      author={outline.header.name}
      creator="Resume AI"
      producer="Resume AI"
    >
      <Page
        size="LETTER"
        style={{
          paddingTop: theme.margin,
          paddingBottom: theme.margin + 6,
          paddingHorizontal: theme.margin,
          fontFamily: theme.fonts.pdf.regular,
          fontSize: theme.size.base,
          lineHeight: theme.lineHeight,
          color: theme.colors.text,
        }}
      >
        <Header outline={outline} theme={theme} s={s} />
        {outline.sections.map((section) => (
          <Section key={section.id} section={section} theme={theme} s={s} />
        ))}
      </Page>
    </Document>
  );
}

export async function toPdf(doc: ResumeDoc, style?: unknown): Promise<ExportResult> {
  const sanitizer = new PdfTextSanitizer();
  const theme = resolveTheme(style);
  const buffer = await renderToBuffer(<ResumePdf doc={doc} theme={theme} s={sanitizer} />);
  return { body: new Uint8Array(buffer), warnings: sanitizer.warnings() };
}

export const pdfExporter: Exporter = {
  format: "pdf",
  contentType: "application/pdf",
  extension: "pdf",
  generate: toPdf,
};

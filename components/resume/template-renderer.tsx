import type { ResumeDoc } from "@/lib/schema/resume";
import { buildOutline, type OutlineEntry, type OutlineSection } from "@/lib/export/outline";
import { PT_TO_PX, resolveTheme, type ResolvedTheme } from "@/lib/templates/theme";

/**
 * The one on-screen template renderer.
 *
 * It takes a `ResumeDoc` and a `StyleConfig` and renders the *outline*
 * (Phase 4's format-neutral flattening), which is what guarantees the rule
 * that matters most here: **no template can add, drop, or reorder
 * content**, because none of them touch the document directly.
 *
 * Markup stays plain and semantic — real headings, real lists, one reading
 * order — so every template is equally parseable by an ATS regardless of
 * how different it looks.
 */

const px = (pt: number) => `${pt * PT_TO_PX}px`;

function SectionLabel({ section, theme }: { section: OutlineSection; theme: ResolvedTheme }) {
  const { layout, colors, size } = theme;

  const base: React.CSSProperties = {
    fontSize: px(size.sectionLabel),
    letterSpacing: `${layout.sectionTracking}em`,
    textTransform: layout.sectionCase === "upper" ? "uppercase" : "none",
    fontWeight: 700,
    margin: 0,
  };

  switch (layout.sectionDevice) {
    case "accent-bar":
      return (
        <h2
          style={{
            ...base,
            color: colors.accent,
            borderLeft: `${px(2.5)} solid ${colors.accent}`,
            paddingLeft: px(5),
            marginBottom: px(5),
          }}
        >
          {section.label}
        </h2>
      );
    case "rule-under":
      return (
        <h2
          style={{
            ...base,
            color: colors.text,
            borderBottom: `1px solid ${colors.rule}`,
            paddingBottom: px(2.5),
            marginBottom: px(5),
          }}
        >
          {section.label}
        </h2>
      );
    case "short-accent-underline":
      return (
        <h2 style={{ ...base, color: colors.text, marginBottom: px(5) }}>
          {section.label}
          <span
            style={{
              display: "block",
              width: px(26),
              height: px(2.5),
              background: colors.accent,
              marginTop: px(3),
            }}
          />
        </h2>
      );
    case "boxed":
      return (
        <h2
          style={{
            ...base,
            color: colors.onAccent,
            background: colors.accent,
            padding: `${px(2.5)} ${px(6)}`,
            marginBottom: px(5),
            display: "inline-block",
          }}
        >
          {section.label}
        </h2>
      );
    case "plain-caps":
    case "side-label":
    default:
      return (
        <h2 style={{ ...base, color: colors.muted, marginBottom: px(5) }}>{section.label}</h2>
      );
  }
}

function Bullets({ items, theme }: { items: string[]; theme: ResolvedTheme }) {
  if (items.length === 0) return null;
  const { colors, space, layout, size } = theme;

  return (
    <ul style={{ margin: `${px(space.bullet)} 0 0`, padding: 0, listStyle: "none" }}>
      {items.map((bullet, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            gap: px(5),
            marginBottom: px(space.bullet),
            fontSize: px(size.base),
          }}
        >
          <span aria-hidden style={{ color: colors.accent, flexShrink: 0 }}>
            {layout.bulletGlyph}
          </span>
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  );
}

function Entry({
  entry,
  theme,
  isLast,
}: {
  entry: OutlineEntry;
  theme: ResolvedTheme;
  isLast: boolean;
}) {
  const { colors, size, space, layout } = theme;

  if (entry.inline) {
    return (
      <p style={{ margin: `0 0 ${px(space.bullet)}`, fontSize: px(size.base) }}>
        <strong>{entry.title}:</strong>{" "}
        <span style={{ color: colors.muted }}>{entry.inline}</span>
      </p>
    );
  }

  const dates = entry.dates ? (
    <span style={{ fontSize: px(size.meta), color: colors.muted, flexShrink: 0 }}>
      {entry.dates}
    </span>
  ) : null;

  return (
    <div
      style={{
        marginBottom: isLast ? 0 : px(space.entry),
        paddingBottom: layout.entryDividers && !isLast ? px(space.entry * 0.6) : 0,
        borderBottom:
          layout.entryDividers && !isLast ? `1px solid ${colors.rule}` : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: px(8),
        }}
      >
        <p style={{ margin: 0, fontSize: px(size.entryTitle), fontWeight: 700 }}>
          {entry.url ? (
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: colors.accent, textDecoration: "none" }}
            >
              {entry.title}
            </a>
          ) : (
            entry.title
          )}
          {entry.subtitle && (
            <span
              style={{
                fontWeight: 400,
                color: layout.accentSubtitles ? colors.accent : colors.muted,
              }}
            >
              {" · "}
              {entry.subtitle}
            </span>
          )}
        </p>
        {layout.dates === "right" ? dates : null}
      </div>

      {(entry.location || layout.dates === "under") && (
        <p style={{ margin: 0, fontSize: px(size.meta), color: colors.muted }}>
          {[layout.dates === "under" ? entry.dates : null, entry.location]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {entry.description && (
        <p style={{ margin: `${px(1.5)} 0 0`, fontSize: px(size.base) }}>{entry.description}</p>
      )}

      <Bullets items={entry.bullets} theme={theme} />
    </div>
  );
}

function Section({ section, theme }: { section: OutlineSection; theme: ResolvedTheme }) {
  const { layout, space, size } = theme;

  const body = section.paragraph ? (
    <p style={{ margin: 0, fontSize: px(size.base) }}>{section.paragraph}</p>
  ) : (
    <div>
      {section.entries.map((entry, i) => (
        <Entry
          key={entry.id}
          entry={entry}
          theme={theme}
          isLast={i === section.entries.length - 1}
        />
      ))}
    </div>
  );

  // The gutter layout keeps the label before its content in source order,
  // so screen readers and ATS parsers read it exactly as it looks.
  if (layout.sectionDevice === "side-label") {
    return (
      <section style={{ display: "flex", gap: px(10), marginBottom: px(space.section) }}>
        <div style={{ width: px(space.gutter), flexShrink: 0 }}>
          <SectionLabel section={section} theme={theme} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: px(space.section) }}>
      <SectionLabel section={section} theme={theme} />
      {body}
    </section>
  );
}

function Header({ outline, theme }: { outline: ReturnType<typeof buildOutline>; theme: ResolvedTheme }) {
  const { header } = outline;
  const { layout, colors, size, space, style } = theme;

  const hasContent =
    !!header.name || !!header.title || header.contacts.length > 0 || header.links.length > 0;
  if (!hasContent) return null;

  const align =
    style.headerStyle === "centered" ? "center" : style.headerStyle === "split" ? "left" : "left";

  const nameEl = header.name ? (
    <h1
      style={{
        margin: 0,
        fontSize: px(size.name),
        letterSpacing: `${layout.nameTracking}em`,
        textTransform: layout.nameCase === "upper" ? "uppercase" : "none",
        color: layout.headerTreatment === "accent-band" ? colors.onAccent : colors.text,
        fontWeight: 700,
        lineHeight: 1.1,
      }}
    >
      {header.name}
    </h1>
  ) : null;

  const headlineEl = header.title ? (
    <p
      style={{
        margin: `${px(2)} 0 0`,
        fontSize: px(size.headline),
        color:
          layout.headerTreatment === "accent-band"
            ? colors.onAccent
            : layout.accentSubtitles
              ? colors.accent
              : colors.muted,
      }}
    >
      {header.title}
    </p>
  ) : null;

  const contactEl = (
    <p
      style={{
        margin: `${px(4)} 0 0`,
        fontSize: px(size.meta),
        color: layout.headerTreatment === "accent-band" ? colors.onAccent : colors.muted,
        display: "flex",
        flexWrap: "wrap",
        gap: `${px(2)} ${px(8)}`,
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      {header.contacts.map((contact) => (
        <span key={contact}>{contact}</span>
      ))}
      {header.links.map((link, i) => (
        <a
          key={`${link.url}-${i}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          style={{
            color: layout.headerTreatment === "accent-band" ? colors.onAccent : colors.accent,
          }}
        >
          {link.label}
        </a>
      ))}
    </p>
  );

  const inner =
    style.headerStyle === "split" ? (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: px(12),
        }}
      >
        <div>
          {nameEl}
          {headlineEl}
        </div>
        <div style={{ textAlign: "right", maxWidth: "45%" }}>{contactEl}</div>
      </div>
    ) : (
      <div style={{ textAlign: align }}>
        {nameEl}
        {headlineEl}
        {contactEl}
      </div>
    );

  const band = layout.headerTreatment === "accent-band";
  const boxed = layout.headerTreatment === "boxed";

  return (
    <header
      style={{
        marginBottom: px(space.headerBottom),
        paddingBottom: layout.headerTreatment === "rule-under" ? px(7) : boxed ? px(8) : 0,
        borderBottom:
          layout.headerTreatment === "rule-under"
            ? `${px(1.2)} solid ${colors.accent}`
            : boxed
              ? `${px(2.5)} solid ${colors.accent}`
              : undefined,
        background: band ? colors.accent : undefined,
        padding: band ? `${px(12)} ${px(14)}` : undefined,
        margin: band ? `${px(-6)} ${px(-6)} ${px(space.headerBottom)}` : undefined,
      }}
    >
      {inner}
    </header>
  );
}

export function TemplateRenderer({
  doc,
  style,
  className,
}: {
  doc: ResumeDoc;
  style?: unknown;
  className?: string;
}) {
  const theme = resolveTheme(style);
  const outline = buildOutline(doc);

  const isEmpty =
    outline.sections.length === 0 &&
    !outline.header.name &&
    outline.header.contacts.length === 0;

  if (isEmpty) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to show yet. Add a section, or upload a document to get started.
      </p>
    );
  }

  return (
    <article
      className={className}
      style={{
        // The page itself stays print-oriented white in both app themes —
        // it is a preview of a printed document, not app chrome.
        background: "#ffffff",
        color: theme.colors.text,
        fontFamily: theme.fonts.css,
        fontSize: px(theme.size.base),
        lineHeight: theme.lineHeight,
        padding: px(theme.margin),
        maxWidth: `${8.5 * 96}px`,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <Header outline={outline} theme={theme} />
      {outline.sections.map((section) => (
        <Section key={section.id} section={section} theme={theme} />
      ))}
    </article>
  );
}

import { getTemplate } from "@/lib/templates/registry";
import { resolveTheme } from "@/lib/templates/theme";

/**
 * A miniature of the resume's template.
 *
 * Deliberately an abstraction rather than a real render: it draws the
 * template's *structure* — header treatment, section device, density — from
 * the same theme the real template uses, so it stays truthful as templates
 * change, without the cost of rendering a full document per dashboard row.
 */
export function ResumeThumbnail({ style }: { style?: unknown }) {
  const theme = resolveTheme(style);
  const template = getTemplate(theme.style.templateId);
  const { layout, colors } = theme;

  const band = layout.headerTreatment === "accent-band";
  const gutter = layout.sectionDevice === "side-label";

  const line = (width: string, tone: "text" | "muted" = "muted") => (
    <div
      style={{
        width,
        height: 2,
        borderRadius: 1,
        background: tone === "text" ? colors.text : colors.rule,
      }}
    />
  );

  const sectionBlock = (key: number) => (
    <div key={key} style={{ display: "flex", gap: 3, marginTop: 5 }}>
      {gutter && (
        <div style={{ width: 12, flexShrink: 0 }}>
          <div style={{ width: 10, height: 2.5, background: colors.accent, borderRadius: 1 }} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        {!gutter && (
          <div
            style={{
              width: layout.sectionDevice === "short-accent-underline" ? 12 : 26,
              height: 2.5,
              background:
                layout.sectionDevice === "rule-under" ? colors.text : colors.accent,
              borderRadius: 1,
              marginBottom: 3,
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {line("92%")}
          {line("78%")}
          {layout.density !== "dense" ? null : line("84%")}
        </div>
      </div>
    </div>
  );

  return (
    <div
      aria-hidden
      title={`${template.name} template`}
      className="h-full w-full overflow-hidden rounded-md ring-1 ring-black/10"
      style={{ background: "#ffffff", padding: 6 }}
    >
      {/* Header */}
      <div
        style={{
          background: band ? colors.accent : undefined,
          padding: band ? 4 : 0,
          margin: band ? -2 : 0,
          marginBottom: 4,
          borderBottom:
            layout.headerTreatment === "rule-under" || layout.headerTreatment === "boxed"
              ? `1.5px solid ${colors.accent}`
              : undefined,
          paddingBottom: layout.headerTreatment === "plain" ? 0 : 3,
          textAlign: theme.style.headerStyle === "centered" ? "center" : "left",
        }}
      >
        <div
          style={{
            width: layout.nameScale > 2.3 ? "68%" : "50%",
            height: layout.nameScale > 2.3 ? 5 : 4,
            background: band ? colors.onAccent : colors.text,
            borderRadius: 1,
            margin: theme.style.headerStyle === "centered" ? "0 auto" : undefined,
          }}
        />
        <div
          style={{
            width: "34%",
            height: 2,
            background: band ? colors.onAccent : colors.muted,
            borderRadius: 1,
            marginTop: 2.5,
            opacity: 0.7,
            marginLeft: theme.style.headerStyle === "centered" ? "auto" : undefined,
            marginRight: theme.style.headerStyle === "centered" ? "auto" : undefined,
          }}
        />
      </div>

      {[0, 1, 2].map(sectionBlock)}
    </div>
  );
}

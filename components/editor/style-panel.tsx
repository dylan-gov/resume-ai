"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStyle, useStyleActions } from "@/lib/store/style-store";
import {
  FONT_OPTIONS,
  HEADER_STYLES,
  STYLE_BOUNDS,
  checkContrast,
  type FontId,
  type HeaderStyle,
} from "@/lib/templates/style";
import { TEMPLATE_LIST } from "@/lib/templates/registry";

/**
 * Customization controls.
 *
 * Every control is bounded by `STYLE_BOUNDS`, so no combination can produce
 * a resume that clips in print or is unreadable on screen — guardrails over
 * infinite freedom. Colour is the exception: it warns rather than blocks,
 * because a pale accent can be a legitimate choice while pale body text
 * essentially never is.
 */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Slider({
  value,
  bounds,
  onChange,
  label,
}: {
  value: number;
  bounds: { min: number; max: number; step: number };
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      min={bounds.min}
      max={bounds.max}
      step={bounds.step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-4 w-full accent-primary"
    />
  );
}

export function StylePanel() {
  const style = useStyle((s) => s.style);
  const { setTemplate, update, reset } = useStyleActions();
  const warnings = checkContrast(style);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Design</h2>
          <p className="text-xs text-muted-foreground">
            Switching template keeps every word — only the look changes.
          </p>
        </div>
        <Button variant="ghost" size="xs" onClick={reset} title="Reset to defaults">
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      {/* Template picker */}
      <div>
        <p className="mb-1.5 text-xs font-medium">Template</p>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATE_LIST.map((template) => {
            const active = template.id === style.templateId;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setTemplate(template.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border p-2 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border hover:bg-muted"
                )}
              >
                <span className="block text-xs font-medium">{template.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {template.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Typeface */}
      <Field label="Typeface">
        <div className="flex gap-1">
          {(Object.keys(FONT_OPTIONS) as FontId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => update({ fontFamily: id })}
              aria-pressed={style.fontFamily === id}
              style={{ fontFamily: FONT_OPTIONS[id].css }}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
                style.fontFamily === id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              )}
              title={FONT_OPTIONS[id].description}
            >
              {FONT_OPTIONS[id].label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Text size" hint={`${Math.round(style.fontScale * 100)}%`}>
        <Slider
          label="Text size"
          value={style.fontScale}
          bounds={STYLE_BOUNDS.fontScale}
          onChange={(fontScale) => update({ fontScale })}
        />
      </Field>

      <Field label="Line spacing" hint={style.lineHeight.toFixed(2)}>
        <Slider
          label="Line spacing"
          value={style.lineHeight}
          bounds={STYLE_BOUNDS.lineHeight}
          onChange={(lineHeight) => update({ lineHeight })}
        />
      </Field>

      <Field label="Space between sections" hint={`${Math.round(style.sectionSpacing * 100)}%`}>
        <Slider
          label="Space between sections"
          value={style.sectionSpacing}
          bounds={STYLE_BOUNDS.sectionSpacing}
          onChange={(sectionSpacing) => update({ sectionSpacing })}
        />
      </Field>

      <Field label="Page margin" hint={`${style.margin.toFixed(2)}in`}>
        <Slider
          label="Page margin"
          value={style.margin}
          bounds={STYLE_BOUNDS.margin}
          onChange={(margin) => update({ margin })}
        />
      </Field>

      <Field label="Header layout">
        <div className="flex gap-1">
          {HEADER_STYLES.map((header) => (
            <button
              key={header}
              type="button"
              onClick={() => update({ headerStyle: header as HeaderStyle })}
              aria-pressed={style.headerStyle === header}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors",
                style.headerStyle === header
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              )}
            >
              {header}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Accent">
          <input
            type="color"
            aria-label="Accent color"
            value={style.accentColor}
            onChange={(e) => update({ accentColor: e.target.value })}
            className="h-8 w-full cursor-pointer rounded-md border border-border bg-transparent"
          />
        </Field>
        <Field label="Text">
          <input
            type="color"
            aria-label="Text color"
            value={style.textColor}
            onChange={(e) => update({ textColor: e.target.value })}
            className="h-8 w-full cursor-pointer rounded-md border border-border bg-transparent"
          />
        </Field>
      </div>

      {warnings.map((warning) => (
        <p
          key={warning.field}
          role="status"
          className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {warning.message}
        </p>
      ))}
    </div>
  );
}

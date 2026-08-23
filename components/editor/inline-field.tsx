"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useResumeActions } from "@/lib/store/use-resume-store";

/** How long a field can sit idle before its edit session is committed to history. */
const EDIT_PAUSE_MS = 700;

interface InlineFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Stable per-field key; a run of keystrokes under one key is one undo step. */
  sessionKey: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  /** Rendered visually as a heading/emphasis rather than body text. */
  emphasis?: "strong" | "muted" | "none";
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  inputRef?: React.Ref<HTMLInputElement & HTMLTextAreaElement>;
  autoFocus?: boolean;
  /** DOM id, so analysis findings can scroll to and highlight this field. */
  id?: string;
}

/**
 * A field that reads as plain text until you focus it, but is always a real
 * input — no click-to-swap, which keeps focus and screen-reader behavior
 * predictable.
 *
 * The preview updates on every keystroke while history only gains one entry
 * per edit session: the session ends on blur, or after a typing pause.
 */
export function InlineField({
  value,
  onChange,
  sessionKey,
  label,
  placeholder,
  multiline,
  className,
  emphasis = "none",
  onKeyDown,
  inputRef,
  autoFocus,
  id,
}: InlineFieldProps) {
  const { endEditSession } = useResumeActions();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeKey = useRef(sessionKey);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  // A single mounted input can be re-pointed at a different logical field —
  // bullets are keyed by position, so reordering one shifts what this input
  // edits. Close the previous session so the two edits stay distinct in history.
  useEffect(() => {
    if (activeKey.current === sessionKey) return;
    activeKey.current = sessionKey;
    clearTimer();
    endEditSession();
  }, [sessionKey, endEditSession]);

  function handleChange(next: string) {
    onChange(next);
    clearTimer();
    timer.current = setTimeout(() => {
      endEditSession();
      timer.current = null;
    }, EDIT_PAUSE_MS);
  }

  function handleBlur() {
    clearTimer();
    endEditSession();
  }

  const classes = cn(
    "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none transition-colors",
    "hover:border-border focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/30",
    "placeholder:text-muted-foreground/60",
    emphasis === "strong" && "font-medium",
    emphasis === "muted" && "text-muted-foreground",
    className
  );

  if (multiline) {
    return (
      <textarea
        id={id}
        ref={inputRef}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        rows={1}
        className={cn(classes, "field-sizing-content resize-none leading-relaxed")}
      />
    );
  }

  return (
    <input
      id={id}
      ref={inputRef}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      className={classes}
    />
  );
}

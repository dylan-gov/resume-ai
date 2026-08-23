"use client";

import { useEffect, useRef, useState } from "react";
import { InlineField } from "./inline-field";

/**
 * Edits a `string[]` (skills, tech, authors) as a comma-separated line.
 *
 * While focused, the raw text is authoritative so the caret never jumps when
 * you type a comma or a space; the parsed array is still written to the store
 * on every keystroke so the preview stays live. On blur the text re-syncs
 * from the (trimmed) stored array.
 */
export function ListField({
  value,
  onChange,
  sessionKey,
  label,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  sessionKey: string;
  label: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const joined = value.join(", ");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(null);
  }, [joined]);

  return (
    <div
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setDraft(null);
      }}
    >
      <InlineField
        label={label}
        placeholder={placeholder}
        value={draft ?? joined}
        sessionKey={sessionKey}
        onChange={(next) => {
          setDraft(next);
          onChange(
            next
              .split(",")
              .map((part) => part.trim())
              .filter((part) => part.length > 0)
          );
        }}
      />
    </div>
  );
}

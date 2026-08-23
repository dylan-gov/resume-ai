"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Command,
  Download,
  LayoutDashboard,
  Moon,
  Palette,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

export interface CommandAction {
  id: string;
  label: string;
  group: string;
  icon?: typeof Command;
  keywords?: string;
  run: () => void;
}

/**
 * Cmd/Ctrl+K command palette.
 *
 * Fully keyboard-operable: arrows move, Enter runs, Escape closes, and
 * focus is trapped to the input while open. Actions are contributed by
 * whichever surface is mounted, so the editor can add "switch template"
 * without this component knowing anything about templates.
 */
export function CommandPalette({ actions = [] }: { actions?: CommandAction[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const reduced = useReducedMotion();

  const baseActions = useMemo<CommandAction[]>(
    () => [
      {
        id: "go-dashboard",
        label: "Go to dashboard",
        group: "Navigate",
        icon: LayoutDashboard,
        run: () => router.push("/dashboard"),
      },
      {
        id: "new-resume",
        label: "New resume",
        group: "Navigate",
        icon: Sparkles,
        run: () => router.push("/"),
      },
      {
        id: "toggle-theme",
        label: mode === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Appearance",
        icon: mode === "dark" ? Sun : Moon,
        keywords: "dark light theme mode",
        run: () => setMode(mode === "dark" ? "light" : "dark"),
      },
    ],
    [router, mode, setMode]
  );

  const all = useMemo(() => [...actions, ...baseActions], [actions, baseActions]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter((action) =>
      `${action.label} ${action.group} ${action.keywords ?? ""}`.toLowerCase().includes(term)
    );
  }, [all, query]);

  // Opening resets the query here rather than in an effect keyed on `open`,
  // which would cause a cascading render every time the palette appears.
  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => {
          if (current) return false;
          setQuery("");
          setActive(0);
          return true;
        });
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette]);

  const run = useCallback((action: CommandAction) => {
    setOpen(false);
    action.run();
  }, []);

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      run(results[active]);
    }
  }

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.08 : 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: reduced ? 0.08 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search actions…"
                aria-label="Search actions"
                aria-controls="command-results"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
                Esc
              </kbd>
            </div>

            <ul id="command-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No actions match “{query}”.
                </li>
              )}
              {results.map((action, index) => {
                const showGroup = action.group !== lastGroup;
                lastGroup = action.group;
                const Icon = action.icon;
                return (
                  <li key={action.id}>
                    {showGroup && (
                      <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        {action.group}
                      </p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => run(action)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                        index === active ? "bg-muted" : "hover:bg-muted/60"
                      )}
                    >
                      {Icon ? (
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Palette className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{action.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span className="ml-auto flex items-center gap-1">
                <Download className="size-3" />
                Ctrl/⌘K anytime
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

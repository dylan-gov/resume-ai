"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "resume-ai-theme";

/**
 * Inlined into <head> so the correct theme is applied before first paint.
 * Without this the page flashes light before hydration, which is the single
 * most noticeable dark-mode bug.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var stored = localStorage.getItem('${STORAGE_KEY}');
  var mode = stored || 'system';
  var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}catch(e){}})();
`;

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ mode: "system", setMode: () => {} });

/**
 * The stored preference is external state (localStorage), so it is read
 * with `useSyncExternalStore` rather than an effect. React renders the
 * server snapshot first and swaps to the client value during hydration —
 * the supported pattern for this, with no cascading render.
 */
const listeners = new Set<() => void>();

function subscribeToMode(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getModeSnapshot(): ThemeMode {
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
}

function getServerModeSnapshot(): ThemeMode {
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribeToMode, getModeSnapshot, getServerModeSnapshot);

  const apply = useCallback((next: ThemeMode) => {
    const dark =
      next === "dark" ||
      (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
      for (const listener of listeners) listener();
    },
    [apply]
  );

  // Follow the OS while the user is on "system".
  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode, apply]);

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

const OPTIONS: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn("flex rounded-lg border border-border p-0.5", className)}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          title={label}
          onClick={() => setMode(value)}
          className={cn(
            "rounded-md p-1.5 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

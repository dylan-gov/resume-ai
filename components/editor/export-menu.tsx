"use client";

import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResumeStore } from "@/lib/store/use-resume-store";
import { useStyle } from "@/lib/store/style-store";
import { EXPORT_FORMATS, EXPORT_LABELS, type ExportFormat } from "@/lib/export/types";

/**
 * Export control. Sends the *live* document from the store — not the last
 * saved copy — so unsaved edits are always included in the file.
 *
 * PDF and DOCX are generated server-side so their libraries never reach the
 * client bundle; Markdown and TXT go the same route for consistency.
 */
export function ExportMenu({ title }: { title?: string }) {
  const doc = useResumeStore((s) => s.present);
  const style = useStyle((s) => s.style);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function download(format: ExportFormat) {
    setBusy(format);
    setError(null);
    setWarning(null);

    try {
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc, title, style }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(data?.error?.message ?? "Export failed. Please try again.");
        return;
      }

      const headerWarning = response.headers.get("X-Export-Warnings");
      if (headerWarning) setWarning(decodeURIComponent(headerWarning));

      const blob = await response.blob();
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `resume.${format}`;

      // Anchor + object URL is the only way to name a downloaded blob.
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      if (!headerWarning) setOpen(false);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Download className="size-4" />
        Export
      </Button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-border bg-popover p-1 shadow-lg">
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              disabled={busy !== null}
              onClick={() => download(format)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-60"
            >
              {EXPORT_LABELS[format]}
              {busy === format && <Loader2 className="size-3.5 animate-spin" />}
            </button>
          ))}

          {busy && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Generating your file…
            </p>
          )}

          {error && (
            <p className="flex items-start gap-1 px-2 py-1 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          )}

          {warning && (
            <p className="px-2 py-1 text-xs text-amber-700 dark:text-amber-400">{warning}</p>
          )}
        </div>
      )}
    </div>
  );
}

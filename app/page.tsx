"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadPanel } from "@/components/resume/upload-panel";
import { PersistentEditor } from "@/components/editor/persistent-editor";
import type { ResumeDoc } from "@/lib/schema/resume";
import type { GenerateResponse } from "@/lib/api-types";
import { isGenerateError } from "@/lib/api-types";

type Status = "idle" | "loading" | "error" | "editing";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [doc, setDoc] = useState<ResumeDoc | null>(null);

  async function handleSubmit(files: File[], text: string) {
    setStatus("loading");
    setErrorMessage(null);

    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    if (text) formData.append("text", text);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = (await res.json()) as GenerateResponse;

      if (!res.ok || isGenerateError(data)) {
        const message = isGenerateError(data) ? data.error.message : "Something went wrong.";
        setErrorMessage(message);
        setStatus("error");
        return;
      }

      // PersistentEditor hydrates the store from this document; it stays a
      // local draft until the user explicitly saves it to their account.
      setDoc(data.resume);
      setWarnings(data.warnings);
      setStatus("editing");
    } catch {
      setErrorMessage("Could not reach the server. Please try again.");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setErrorMessage(null);
    setWarnings([]);
    setDoc(null);
  }

  if (status === "editing" && doc) {
    return (
      <div className="flex flex-1 flex-col">
        {warnings.length > 0 && (
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            {warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </div>
        )}
        <PersistentEditor initialDoc={doc} resumeId={null} onReset={reset} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Resume AI</h1>
            <p className="text-sm text-muted-foreground">
              Upload an old resume, a project write-up, or just paste some notes — we&apos;ll turn
              it into a clean, structured resume you can edit.
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
            <LayoutDashboard className="size-4" />
            My resumes
          </Button>
        </header>

        {status === "idle" && <UploadPanel onSubmit={handleSubmit} />}

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Reading your documents and drafting your resume…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

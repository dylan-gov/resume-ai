"use client";

import { useRef, useState } from "react";
import { UploadCloud, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

interface UploadPanelProps {
  onSubmit: (files: File[], text: string) => void;
  disabled?: boolean;
}

function isAcceptedFile(file: File): boolean {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel({ onSubmit, disabled }: UploadPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | File[]) {
    setFileError(null);
    const incomingArray = Array.from(incoming);

    const rejected: string[] = [];
    const accepted: File[] = [];

    for (const file of incomingArray) {
      if (!isAcceptedFile(file)) {
        rejected.push(`${file.name} (unsupported type)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push(`${file.name} (larger than 10MB)`);
        continue;
      }
      accepted.push(file);
    }

    setFiles((prev) => {
      const combined = [...prev, ...accepted];
      if (combined.length > MAX_FILES) {
        rejected.push(`Only ${MAX_FILES} files are supported per submission`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });

    if (rejected.length > 0) {
      setFileError(`Skipped: ${rejected.join(", ")}`);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function handleSubmit() {
    if (files.length === 0 && text.trim().length === 0) return;
    onSubmit(files, text.trim());
  }

  const canSubmit = !disabled && (files.length > 0 || text.trim().length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDragging ? "border-primary bg-muted" : "border-border hover:bg-muted/50"
        )}
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drag and drop files here, or click to browse</p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, TXT, or MD — up to 10MB each, {MAX_FILES} files max
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {fileError && <p className="text-sm text-destructive">{fileError}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`}>
              <Card size="sm">
                <CardContent className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(i)}
                  >
                    <X className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="paste-text" className="text-sm font-medium">
          Or paste text directly
        </label>
        <Textarea
          id="paste-text"
          placeholder="Paste a resume, project write-up, or any relevant career notes here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-40"
        />
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit} className="self-start">
        Generate resume
      </Button>
    </div>
  );
}

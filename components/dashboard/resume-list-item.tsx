"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  deleteResumeAction,
  duplicateResumeAction,
  renameResumeAction,
} from "@/app/actions/resumes";
import { ResumeThumbnail } from "./resume-thumbnail";
import { AtsBadge } from "./ats-badge";

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function ResumeListItem({
  id,
  title,
  updatedAt,
  style,
  templateName,
  atsScore,
}: {
  id: string;
  title: string;
  updatedAt: string;
  style?: unknown;
  templateName?: string;
  atsScore?: number | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    failure: string
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        // Say what happened and what to do — no apologies, no vagueness.
        toast({ tone: "error", title: failure, description: result.error });
        return;
      }
      toast({ tone: "success", title: success });
      router.refresh();
    });
  }

  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
    >
      <Link
        href={`/editor/${id}`}
        className="block aspect-[8.5/11] max-h-44 overflow-hidden border-b border-border bg-muted/40 p-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`Open ${title}`}
      >
        <ResumeThumbnail style={style} />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {renaming ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                async () => {
                  const result = await renameResumeAction(id, draftTitle);
                  if (result.ok) setRenaming(false);
                  return result;
                },
                "Renamed",
                "Couldn't rename this resume"
              );
            }}
          >
            <Input
              autoFocus
              aria-label="Resume title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
            <Button type="submit" size="xs" disabled={pending}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setDraftTitle(title);
                setRenaming(false);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <div className="min-w-0">
              <Link
                href={`/editor/${id}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {templateName ? `${templateName} · ` : ""}
                Edited {formatUpdated(updatedAt)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              {typeof atsScore === "number" ? <AtsBadge score={atsScore} /> : <span />}

              <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Rename ${title}`}
                  onClick={() => setRenaming(true)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Duplicate ${title}`}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => duplicateResumeAction(id),
                      "Duplicated",
                      "Couldn't duplicate this resume"
                    )
                  }
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${title}`}
                  disabled={pending}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}

        {confirmingDelete && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2">
            <p className="text-xs">
              Delete <span className="font-medium">{title}</span>? This can&apos;t be undone.
            </p>
            <div className="mt-1.5 flex gap-1">
              <Button
                variant="destructive"
                size="xs"
                disabled={pending}
                onClick={() =>
                  run(() => deleteResumeAction(id), "Deleted", "Couldn't delete this resume")
                }
              >
                Delete
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.li>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase/server";
import { createResumeRepository, type ResumeDb } from "@/lib/data/resumes";
import { resumeDocSchema } from "@/lib/schema/resume";
import { analyzeResume } from "@/lib/analysis";
import { getTemplate } from "@/lib/templates/registry";
import { resolveTheme } from "@/lib/templates/theme";
import { ResumeListItem } from "@/components/dashboard/resume-list-item";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/ui/theme-provider";
import { CommandPalette } from "@/components/ui/command-palette";

export const metadata = { title: "Your resumes · Resume AI" };

export default async function DashboardPage() {
  // The proxy already redirects unauthenticated users, but authorization is
  // re-derived here: proxy gating is a convenience, not the security boundary.
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const repo = createResumeRepository(prisma as unknown as ResumeDb);
  const summaries = await repo.list(user.id);

  // The list view needs each resume's template and score, which the summary
  // query deliberately omits; fetch the documents only for what is shown.
  const resumes = await Promise.all(
    summaries.map(async (summary) => {
      const row = await repo.get(user.id, summary.id);
      const parsed = resumeDocSchema.safeParse(row.doc);
      const analysis = parsed.success ? analyzeResume(parsed.data) : null;
      const theme = resolveTheme(row.style);

      return {
        ...summary,
        style: row.style,
        templateName: getTemplate(theme.style.templateId).name,
        atsScore: analysis?.ats.value ?? null,
      };
    })
  );

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <CommandPalette />

      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Your resumes</h1>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button size="sm" render={<Link href="/" />}>
              <FilePlus2 className="size-4" />
              New resume
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        {resumes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-20 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="size-6 text-primary" />
            </div>
            <p className="text-base font-medium">Let&apos;s build your first resume</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Upload an old resume or paste some notes. We&apos;ll turn it into a structured
              resume you can edit, score, and export.
            </p>
            <Button render={<Link href="/" />} className="mt-1">
              <FilePlus2 className="size-4" />
              Create your first resume
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((resume) => (
              <ResumeListItem
                key={resume.id}
                id={resume.id}
                title={resume.title}
                updatedAt={resume.updatedAt.toISOString()}
                style={resume.style}
                templateName={resume.templateName}
                atsScore={resume.atsScore}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

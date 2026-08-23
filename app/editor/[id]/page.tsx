import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase/server";
import { createResumeRepository, NotFoundError, type ResumeDb } from "@/lib/data/resumes";
import { resumeDocSchema } from "@/lib/schema/resume";
import { PersistentEditor } from "@/components/editor/persistent-editor";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const repo = createResumeRepository(prisma as unknown as ResumeDb);

  let row;
  try {
    // Ownership-scoped: another user's id is indistinguishable from a
    // nonexistent one, and both render the same 404.
    row = await repo.get(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // The column is validated on write, but a document can predate a schema
  // change, so parse on read too rather than trusting stored JSON.
  const parsed = resumeDocSchema.safeParse(row.doc);
  if (!parsed.success) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          <ArrowLeft className="size-4" />
          Dashboard
        </Button>
        <span className="truncate text-sm font-medium">{row.title}</span>
      </div>
      <PersistentEditor
        initialDoc={parsed.data}
        initialStyle={row.style}
        resumeId={row.id}
        title={row.title}
      />
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireUserId } from "@/lib/supabase/server";
import {
  createResumeRepository,
  InvalidDocumentError,
  NotFoundError,
  type ResumeDb,
} from "@/lib/data/resumes";
import { ensureUser } from "@/lib/data/users";
import type { UserDb } from "@/lib/data/users";

/**
 * Server actions are the only way the browser touches resume data.
 *
 * Every one of them derives the user id from the session — a client-supplied
 * userId is never accepted, and none of these signatures even has a slot for
 * one. Errors are returned as values rather than thrown so the editor can
 * surface a save failure without losing local edit state.
 */

const repo = createResumeRepository(prisma as unknown as ResumeDb);

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toError(error: unknown): { ok: false; error: string } {
  if (error instanceof NotFoundError) return { ok: false, error: "Resume not found." };
  if (error instanceof InvalidDocumentError) return { ok: false, error: error.message };
  if (error instanceof Error && error.message === "Not authenticated") {
    return { ok: false, error: "You are signed out. Sign in again to keep your changes." };
  }
  // Never echo raw database errors — they can carry row contents.
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** First save of a freshly generated resume: creates the row. */
export async function createResumeAction(
  doc: unknown,
  title?: string,
  style?: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    // The resumes FK needs a users row; sign-in may be the first time we see them.
    await ensureUser(prisma as unknown as UserDb, user);

    const row = await repo.create(user.id, doc, title, style);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return toError(error);
  }
}

/** Subsequent saves (manual or autosave) of an existing resume. */
export async function saveResumeAction(
  resumeId: string,
  doc: unknown,
  style?: unknown
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await repo.updateDoc(userId, resumeId, doc, style);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return toError(error);
  }
}

export async function renameResumeAction(
  resumeId: string,
  title: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await repo.rename(userId, resumeId, title);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return toError(error);
  }
}

export async function duplicateResumeAction(
  resumeId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const row = await repo.duplicate(userId, resumeId);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return toError(error);
  }
}

export async function deleteResumeAction(resumeId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await repo.remove(userId, resumeId);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return toError(error);
  }
}

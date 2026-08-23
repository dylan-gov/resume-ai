import { resumeDocSchema, type ResumeDoc } from "@/lib/schema/resume";
import { withFreshIds } from "@/lib/resume/duplicate";
import { resolveStyle } from "@/lib/templates/style";

/**
 * Data-access layer for resumes.
 *
 * The one invariant this module exists to guarantee: **every query is scoped
 * to the owning user's id inside the `where` clause**, so the database — not
 * a follow-up `if` in application code — does the filtering.
 *
 * Concretely, that means:
 *   - reads use `findFirst({ where: { id, userId } })`, never
 *     `findUnique({ where: { id } })` followed by an ownership check;
 *   - writes use `updateMany` / `deleteMany` with `{ id, userId }` rather
 *     than `update` / `delete`, whose `where` only accepts a unique key and
 *     so cannot carry the userId.
 *
 * A non-owner therefore matches zero rows and is indistinguishable from a
 * row that does not exist — no existence oracle, no accidental leak.
 *
 * `userId` must always come from the session (see lib/supabase/server.ts),
 * never from client input.
 */

export interface ResumeRow {
  id: string;
  userId: string;
  title: string;
  doc: unknown;
  /** Presentation only; see lib/templates/style.ts. */
  style?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type ResumeSummary = Omit<ResumeRow, "doc" | "userId">;

/** The narrow slice of Prisma this layer uses, so it can be faked in tests. */
export interface ResumeDb {
  resume: {
    findMany(args: {
      where: { userId: string };
      orderBy: { updatedAt: "desc" };
      select: { id: true; title: true; createdAt: true; updatedAt: true };
    }): Promise<ResumeSummary[]>;
    findFirst(args: { where: { id: string; userId: string } }): Promise<ResumeRow | null>;
    create(args: {
      data: { userId: string; title: string; doc: unknown; style?: unknown };
    }): Promise<ResumeRow>;
    updateMany(args: {
      where: { id: string; userId: string };
      data: { title?: string; doc?: unknown; style?: unknown };
    }): Promise<{ count: number }>;
    deleteMany(args: { where: { id: string; userId: string } }): Promise<{ count: number }>;
  };
}

export class NotFoundError extends Error {
  constructor() {
    // Deliberately identical whether the row is absent or owned by someone
    // else — the caller must not be able to tell those apart.
    super("Resume not found");
    this.name = "NotFoundError";
  }
}

export class InvalidDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentError";
  }
}

/** Parses and re-validates a document before it is written to the database. */
function validateDoc(doc: unknown): ResumeDoc {
  const parsed = resumeDocSchema.safeParse(doc);
  if (!parsed.success) {
    throw new InvalidDocumentError(
      parsed.error.issues[0]?.message ?? "Document failed schema validation"
    );
  }
  return parsed.data;
}

function fallbackTitle(doc: ResumeDoc): string {
  const name = doc.header?.name?.trim();
  return name ? `${name}'s Resume` : "Untitled Resume";
}

export function createResumeRepository(db: ResumeDb) {
  return {
    async list(userId: string): Promise<ResumeSummary[]> {
      return db.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      });
    },

    /** Throws NotFoundError when the resume does not exist *or* is not theirs. */
    async get(userId: string, resumeId: string): Promise<ResumeRow> {
      const row = await db.resume.findFirst({ where: { id: resumeId, userId } });
      if (!row) throw new NotFoundError();
      return row;
    },

    async create(
      userId: string,
      doc: unknown,
      title?: string,
      style?: unknown
    ): Promise<ResumeRow> {
      const validated = validateDoc(doc);
      return db.resume.create({
        data: {
          userId,
          title: title?.trim() || fallbackTitle(validated),
          doc: validated,
          // Clamped here too: the column must never hold styling the
          // renderer would reject.
          style: style === undefined ? undefined : resolveStyle(style),
        },
      });
    },

    async updateDoc(
      userId: string,
      resumeId: string,
      doc: unknown,
      style?: unknown
    ): Promise<void> {
      const validated = validateDoc(doc);
      const { count } = await db.resume.updateMany({
        where: { id: resumeId, userId },
        data: {
          doc: validated,
          ...(style === undefined ? {} : { style: resolveStyle(style) }),
        },
      });
      if (count === 0) throw new NotFoundError();
    },

    async rename(userId: string, resumeId: string, title: string): Promise<void> {
      const trimmed = title.trim();
      if (!trimmed) throw new InvalidDocumentError("Title cannot be empty");
      const { count } = await db.resume.updateMany({
        where: { id: resumeId, userId },
        data: { title: trimmed },
      });
      if (count === 0) throw new NotFoundError();
    },

    /**
     * Copies a resume the user owns. The source is fetched through the
     * ownership-scoped read, so another user's resume can never be the
     * source of a copy that lands in this user's account.
     */
    async duplicate(userId: string, resumeId: string): Promise<ResumeRow> {
      const source = await this.get(userId, resumeId);
      const validated = validateDoc(source.doc);
      return db.resume.create({
        data: {
          userId,
          title: `${source.title} (copy)`,
          doc: withFreshIds(validated),
          style: source.style === undefined ? undefined : resolveStyle(source.style),
        },
      });
    },

    async remove(userId: string, resumeId: string): Promise<void> {
      const { count } = await db.resume.deleteMany({ where: { id: resumeId, userId } });
      if (count === 0) throw new NotFoundError();
    },
  };
}

export type ResumeRepository = ReturnType<typeof createResumeRepository>;

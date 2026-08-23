import { beforeEach, describe, expect, it } from "vitest";
import type { ResumeDoc } from "@/lib/schema/resume";
import {
  createResumeRepository,
  InvalidDocumentError,
  NotFoundError,
  type ResumeDb,
  type ResumeRow,
} from "./resumes";

/**
 * An in-memory stand-in for the Prisma client.
 *
 * It applies the `where` clause exactly as Postgres would — matching on
 * every key present, including `userId`. That is the point: if the
 * repository ever drops `userId` from a query, these tests fail, because the
 * fake would then match another user's row just as the real database would.
 */
function createFakeDb(seed: ResumeRow[] = []) {
  let rows: ResumeRow[] = [...seed];
  let nextId = 0;

  const matches = (row: ResumeRow, where: Partial<ResumeRow>) =>
    Object.entries(where).every(([k, v]) => row[k as keyof ResumeRow] === v);

  const db: ResumeDb = {
    resume: {
      async findMany({ where }) {
        return rows
          .filter((r) => matches(r, where))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }));
      },
      async findFirst({ where }) {
        return rows.find((r) => matches(r, where)) ?? null;
      },
      async create({ data }) {
        const row: ResumeRow = {
          id: `new-${++nextId}`,
          userId: data.userId,
          title: data.title,
          doc: data.doc,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        const hits = rows.filter((r) => matches(r, where));
        for (const hit of hits) {
          if (data.title !== undefined) hit.title = data.title;
          if (data.doc !== undefined) hit.doc = data.doc;
          hit.updatedAt = new Date();
        }
        return { count: hits.length };
      },
      async deleteMany({ where }) {
        const before = rows.length;
        rows = rows.filter((r) => !matches(r, where));
        return { count: before - rows.length };
      },
    },
  };

  return { db, all: () => rows };
}

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

const ALICE_DOC: ResumeDoc = {
  header: { name: "Alice Alvarez" },
  workExperience: [{ id: "job-a", company: "Acme", role: "Engineer", bullets: ["Secret work"] }],
  sections: [{ id: "workExperience", kind: "workExperience", label: "Experience" }],
};

function seedAliceResume(): ResumeRow {
  return {
    id: "alice-resume-1",
    userId: ALICE,
    title: "Alice's Resume",
    doc: ALICE_DOC,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
  };
}

let fake: ReturnType<typeof createFakeDb>;
let repo: ReturnType<typeof createResumeRepository>;

beforeEach(() => {
  fake = createFakeDb([seedAliceResume()]);
  repo = createResumeRepository(fake.db);
});

/**
 * The most important tests in Phase 3: Bob must not be able to reach Alice's
 * resume by guessing its id, through any operation.
 */
describe("ownership isolation", () => {
  const ALICE_RESUME_ID = "alice-resume-1";

  it("does not let another user read a resume by id", async () => {
    await expect(repo.get(BOB, ALICE_RESUME_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reports a missing resume and someone else's resume identically", async () => {
    const foreign = await repo.get(BOB, ALICE_RESUME_ID).catch((e) => e as Error);
    const absent = await repo.get(BOB, "does-not-exist").catch((e) => e as Error);

    // No existence oracle: Bob cannot distinguish "exists but not yours"
    // from "no such resume".
    expect(foreign.constructor).toBe(absent.constructor);
    expect(foreign.message).toBe(absent.message);
  });

  it("does not let another user overwrite a resume's document", async () => {
    await expect(
      repo.updateDoc(BOB, ALICE_RESUME_ID, { header: { name: "Bob Was Here" } })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(fake.all()[0].doc).toEqual(ALICE_DOC);
  });

  it("does not let another user rename a resume", async () => {
    await expect(repo.rename(BOB, ALICE_RESUME_ID, "Pwned")).rejects.toBeInstanceOf(
      NotFoundError
    );

    expect(fake.all()[0].title).toBe("Alice's Resume");
  });

  it("does not let another user duplicate a resume into their own account", async () => {
    await expect(repo.duplicate(BOB, ALICE_RESUME_ID)).rejects.toBeInstanceOf(NotFoundError);

    // Critically: no new row was created, so Alice's content did not leak
    // into Bob's account.
    expect(fake.all()).toHaveLength(1);
    expect(fake.all().some((r) => r.userId === BOB)).toBe(false);
  });

  it("does not let another user delete a resume", async () => {
    await expect(repo.remove(BOB, ALICE_RESUME_ID)).rejects.toBeInstanceOf(NotFoundError);

    expect(fake.all()).toHaveLength(1);
  });

  it("never lists another user's resumes", async () => {
    await repo.create(BOB, { header: { name: "Bob Brown" } }, "Bob's Resume");

    const bobList = await repo.list(BOB);
    const aliceList = await repo.list(ALICE);

    expect(bobList.map((r) => r.title)).toEqual(["Bob's Resume"]);
    expect(aliceList.map((r) => r.title)).toEqual(["Alice's Resume"]);
  });

  it("scopes every query by userId at the database boundary", async () => {
    // Guards the technique itself: a query without userId in the `where`
    // would match here, which is exactly the bug these tests exist to catch.
    const seen: Record<string, unknown>[] = [];
    const spy: ResumeDb = {
      resume: {
        findMany: async (a) => (seen.push(a.where), []),
        findFirst: async (a) => (seen.push(a.where), null),
        create: async (a) => {
          seen.push(a.data);
          return { ...seed, ...a.data } as ResumeRow;
        },
        updateMany: async (a) => (seen.push(a.where), { count: 1 }),
        deleteMany: async (a) => (seen.push(a.where), { count: 1 }),
      },
    };
    const seed = seedAliceResume();
    const spied = createResumeRepository(spy);

    await spied.list(ALICE);
    await spied.get(ALICE, "x").catch(() => {});
    await spied.updateDoc(ALICE, "x", ALICE_DOC);
    await spied.rename(ALICE, "x", "New");
    await spied.remove(ALICE, "x");
    await spied.create(ALICE, ALICE_DOC);

    expect(seen).toHaveLength(6);
    for (const where of seen) expect(where.userId).toBe(ALICE);
  });
});

describe("owner operations", () => {
  const ID = "alice-resume-1";

  it("reads its own resume", async () => {
    const row = await repo.get(ALICE, ID);
    expect(row.title).toBe("Alice's Resume");
  });

  it("updates, renames, and deletes its own resume", async () => {
    await repo.updateDoc(ALICE, ID, { ...ALICE_DOC, summary: "Updated" });
    expect((fake.all()[0].doc as ResumeDoc).summary).toBe("Updated");

    await repo.rename(ALICE, ID, "  Renamed  ");
    expect(fake.all()[0].title).toBe("Renamed");

    await repo.remove(ALICE, ID);
    expect(fake.all()).toHaveLength(0);
  });

  it("duplicates its own resume with fresh entry ids", async () => {
    const copy = await repo.duplicate(ALICE, ID);

    expect(copy.title).toBe("Alice's Resume (copy)");
    expect(copy.userId).toBe(ALICE);

    const original = (fake.all()[0].doc as ResumeDoc).workExperience![0].id;
    const duplicated = (copy.doc as ResumeDoc).workExperience![0].id;
    expect(duplicated).not.toBe(original);
    // Content is preserved even though identity is not.
    expect((copy.doc as ResumeDoc).workExperience![0].company).toBe("Acme");
  });

  it("derives a title from the document when none is given", async () => {
    const row = await repo.create(ALICE, { header: { name: "Carol Chen" } });
    expect(row.title).toBe("Carol Chen's Resume");

    const untitled = await repo.create(ALICE, { sections: [] });
    expect(untitled.title).toBe("Untitled Resume");
  });
});

describe("document validation", () => {
  it("refuses to store a document that fails schema validation", async () => {
    await expect(
      repo.create(ALICE, { workExperience: [{ id: "x", company: 42, role: "Dev" }] })
    ).rejects.toBeInstanceOf(InvalidDocumentError);

    expect(fake.all()).toHaveLength(1);
  });

  it("refuses to overwrite a valid document with an invalid one", async () => {
    await expect(
      repo.updateDoc(ALICE, "alice-resume-1", { summary: 123 })
    ).rejects.toBeInstanceOf(InvalidDocumentError);

    expect(fake.all()[0].doc).toEqual(ALICE_DOC);
  });

  it("rejects an empty title", async () => {
    await expect(repo.rename(ALICE, "alice-resume-1", "   ")).rejects.toBeInstanceOf(
      InvalidDocumentError
    );
  });
});

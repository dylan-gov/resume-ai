import { describe, expect, it } from "vitest";
import { resumeDocSchema, type ResumeDoc } from "@/lib/schema/resume";
import { createResumeStore, type ResumeStoreState } from "./resume-store";
import type { StoreApi } from "zustand/vanilla";

/** Deterministic ids so assertions can name entries directly. */
function idGenerator() {
  let n = 0;
  return () => `id-${++n}`;
}

const BASE_DOC: ResumeDoc = {
  header: { name: "Jordan Ellis", title: "Backend Engineer" },
  summary: "Backend engineer with 5 years of experience.",
  workExperience: [
    { id: "job-1", company: "Northwind", role: "Senior Engineer", bullets: ["Built billing"] },
    { id: "job-2", company: "Fenwick", role: "Engineer", bullets: ["Built ingestion"] },
  ],
  education: [{ id: "edu-1", institution: "UT Austin", degree: "B.S." }],
  clarifications: ["What was your end date at Fenwick?", "Which month did you start?"],
};

function makeStore(doc: ResumeDoc = BASE_DOC): StoreApi<ResumeStoreState> {
  return createResumeStore({ initialDoc: doc, generateId: idGenerator() });
}

const doc = (s: StoreApi<ResumeStoreState>) => s.getState().present;
const jobs = (s: StoreApi<ResumeStoreState>) => doc(s).workExperience ?? [];
const sectionIds = (s: StoreApi<ResumeStoreState>) => (doc(s).sections ?? []).map((x) => x.id);

describe("normalization on hydrate", () => {
  it("backfills a section list for a Phase 1 document that has none", () => {
    const store = makeStore();
    // Only sections with content are included, in default resume order.
    expect(sectionIds(store)).toEqual(["summary", "workExperience", "education"]);
    expect(doc(store).sections?.map((s) => s.label)).toEqual([
      "Summary",
      "Experience",
      "Education",
    ]);
  });

  it("leaves an already-normalized document's section order untouched", () => {
    const custom: ResumeDoc = {
      ...BASE_DOC,
      sections: [
        { id: "education", kind: "education", label: "Schooling" },
        { id: "workExperience", kind: "workExperience", label: "Work" },
      ],
    };
    const store = makeStore(custom);
    expect(sectionIds(store)).toEqual(["education", "workExperience"]);
    expect(doc(store).sections?.[0].label).toBe("Schooling");
  });

  it("discards history when hydrating a new document", () => {
    const store = makeStore();
    store.getState().renameSection("workExperience", "Career");
    expect(store.getState().past.length).toBe(1);

    store.getState().hydrate(BASE_DOC);
    expect(store.getState().past).toEqual([]);
    expect(store.getState().future).toEqual([]);
  });
});

describe("updateField", () => {
  it("applies a nested edit immutably", () => {
    const store = makeStore();
    const before = doc(store);

    store.getState().updateField(["header", "name"], "Jordan E.");

    expect(doc(store).header?.name).toBe("Jordan E.");
    expect(before.header?.name).toBe("Jordan Ellis");
    expect(doc(store)).not.toBe(before);
  });

  it("removes the key when the value is undefined, keeping the doc serializable", () => {
    const store = makeStore();
    store.getState().updateField(["header", "title"], undefined);

    expect("title" in (doc(store).header ?? {})).toBe(false);
    expect(JSON.parse(JSON.stringify(doc(store))).header).toEqual({ name: "Jordan Ellis" });
  });

  it("rejects a mutation that would make the document schema-invalid", () => {
    const store = makeStore();
    const before = doc(store);

    // `company` is a required string on a work-experience entry.
    store.getState().updateField(["workExperience", 0, "company"], 42);

    expect(doc(store)).toBe(before);
    expect(store.getState().lastError).not.toBeNull();
    expect(store.getState().past.length).toBe(0);
  });
});

describe("edit-session coalescing", () => {
  it("collapses a run of keystrokes in one field into a single undo step", () => {
    const store = makeStore();
    const key = "field:header.name";

    for (const value of ["J", "Jo", "Jor", "Jord"]) {
      store.getState().updateField(["header", "name"], value, key);
    }

    expect(doc(store).header?.name).toBe("Jord");
    expect(store.getState().past.length).toBe(1);

    store.getState().undo();
    expect(doc(store).header?.name).toBe("Jordan Ellis");
  });

  it("starts a new history entry when the edited field changes", () => {
    const store = makeStore();
    store.getState().updateField(["header", "name"], "A", "field:header.name");
    store.getState().updateField(["header", "title"], "B", "field:header.title");

    expect(store.getState().past.length).toBe(2);
  });

  it("starts a new history entry after the session is explicitly ended", () => {
    const store = makeStore();
    const key = "field:header.name";

    store.getState().updateField(["header", "name"], "A", key);
    store.getState().endEditSession();
    store.getState().updateField(["header", "name"], "AB", key);

    expect(store.getState().past.length).toBe(2);
    store.getState().undo();
    expect(doc(store).header?.name).toBe("A");
  });

  it("treats structural edits as their own history entries", () => {
    const store = makeStore();
    store.getState().updateField(["header", "name"], "A", "field:header.name");
    store.getState().addEntry("workExperience");
    store.getState().updateField(["header", "name"], "AB", "field:header.name");

    expect(store.getState().past.length).toBe(3);
  });
});

describe("entry actions", () => {
  it("adds a blank entry shaped for the section kind", () => {
    const store = makeStore();
    store.getState().addEntry("workExperience");

    const added = jobs(store).at(-1)!;
    expect(added).toMatchObject({ id: "id-1", company: "", role: "" });
    expect(resumeDocSchema.safeParse(doc(store)).success).toBe(true);
  });

  it("adds entries into a custom section's own entry list", () => {
    const store = makeStore();
    store.getState().addCustomSection("Speaking");
    store.getState().addEntry("id-1");

    const section = doc(store).sections?.find((s) => s.id === "id-1");
    expect(section?.kind).toBe("custom");
    expect(section?.entries).toHaveLength(1);
    expect(section?.entries?.[0].id).toBe("id-2");
  });

  it("deletes an entry by id", () => {
    const store = makeStore();
    store.getState().deleteEntry("workExperience", "job-1");

    expect(jobs(store).map((j) => j.id)).toEqual(["job-2"]);
  });

  it("leaves an empty but valid section when its last entry is deleted", () => {
    const store = makeStore();
    store.getState().deleteEntry("education", "edu-1");

    expect(doc(store).education).toEqual([]);
    expect(sectionIds(store)).toContain("education");
    expect(resumeDocSchema.safeParse(doc(store)).success).toBe(true);
  });

  it("reorders entries by id", () => {
    const store = makeStore();
    store.getState().reorderEntries("workExperience", "job-2", "job-1");

    expect(jobs(store).map((j) => j.id)).toEqual(["job-2", "job-1"]);
  });

  it("ignores a reorder referencing an unknown id", () => {
    const store = makeStore();
    const before = doc(store);
    store.getState().reorderEntries("workExperience", "job-1", "nope");

    expect(jobs(store).map((j) => j.id)).toEqual(["job-1", "job-2"]);
    expect(store.getState().past.at(-1)).toBe(before);
  });
});

describe("bullet actions", () => {
  it("inserts a bullet at a position", () => {
    const store = makeStore();
    store.getState().addBullet("workExperience", "job-1", 0);

    expect(jobs(store)[0].bullets).toEqual(["", "Built billing"]);
  });

  it("coalesces typing within one bullet but not across bullets", () => {
    const store = makeStore();
    store.getState().addBullet("workExperience", "job-1");
    const baseline = store.getState().past.length;

    store.getState().updateBullet("workExperience", "job-1", 1, "A");
    store.getState().updateBullet("workExperience", "job-1", 1, "AB");
    expect(store.getState().past.length).toBe(baseline + 1);

    store.getState().updateBullet("workExperience", "job-1", 0, "Other");
    expect(store.getState().past.length).toBe(baseline + 2);
  });

  it("deletes and reorders bullets", () => {
    const store = makeStore();
    store.getState().addBullet("workExperience", "job-1");
    store.getState().updateBullet("workExperience", "job-1", 1, "Second");

    store.getState().reorderBullets("workExperience", "job-1", 1, 0);
    expect(jobs(store)[0].bullets).toEqual(["Second", "Built billing"]);

    store.getState().deleteBullet("workExperience", "job-1", 0);
    expect(jobs(store)[0].bullets).toEqual(["Built billing"]);
  });

  it("targets a kind's own list key, e.g. education's `details`", () => {
    const store = makeStore();
    store.getState().addBullet("education", "edu-1", 0, "details");
    store.getState().updateBullet("education", "edu-1", 0, "GPA 3.7", "details");

    const edu = doc(store).education?.[0];
    expect(edu?.details).toEqual(["GPA 3.7"]);
    // The write must not have invented a `bullets` field the schema strips.
    expect("bullets" in (edu ?? {})).toBe(false);
    expect(resumeDocSchema.safeParse(doc(store)).success).toBe(true);
  });

  it("ignores an out-of-range bullet reorder", () => {
    const store = makeStore();
    store.getState().reorderBullets("workExperience", "job-1", 0, 5);
    expect(jobs(store)[0].bullets).toEqual(["Built billing"]);
  });
});

describe("section actions", () => {
  it("renames a built-in section", () => {
    const store = makeStore();
    store.getState().renameSection("workExperience", "Where I've Worked");

    expect(doc(store).sections?.find((s) => s.id === "workExperience")?.label).toBe(
      "Where I've Worked"
    );
  });

  it("coalesces consecutive renames of the same section into one undo step", () => {
    const store = makeStore();
    for (const label of ["W", "Wo", "Wor", "Work"]) {
      store.getState().renameSection("workExperience", label);
    }

    expect(store.getState().past.length).toBe(1);
    store.getState().undo();
    expect(doc(store).sections?.find((s) => s.id === "workExperience")?.label).toBe("Experience");
  });

  it("reorders sections by id", () => {
    const store = makeStore();
    store.getState().reorderSections("education", "summary");

    expect(sectionIds(store)).toEqual(["education", "summary", "workExperience"]);
  });

  it("deletes a section and its backing data", () => {
    const store = makeStore();
    store.getState().deleteSection("workExperience");

    expect(sectionIds(store)).toEqual(["summary", "education"]);
    expect(doc(store).workExperience).toBeUndefined();
    expect("workExperience" in doc(store)).toBe(false);
  });

  it("deletes the summary section's string data", () => {
    const store = makeStore();
    store.getState().deleteSection("summary");

    expect(doc(store).summary).toBeUndefined();
    expect(sectionIds(store)).toEqual(["workExperience", "education"]);
  });

  it("adds a built-in section with an empty backing array", () => {
    const store = makeStore();
    store.getState().addSection("projects");

    expect(doc(store).projects).toEqual([]);
    expect(sectionIds(store)).toContain("projects");
  });

  it("refuses to add a duplicate built-in section", () => {
    const store = makeStore();
    const before = doc(store);
    store.getState().addSection("workExperience");

    expect(sectionIds(store).filter((id) => id === "workExperience")).toHaveLength(1);
    expect(store.getState().past.at(-1)).toBe(before);
  });

  it("allows multiple custom sections, each with a distinct id", () => {
    const store = makeStore();
    store.getState().addCustomSection("Speaking");
    store.getState().addCustomSection("Patents");

    const customs = doc(store).sections?.filter((s) => s.kind === "custom") ?? [];
    expect(customs.map((s) => s.label)).toEqual(["Speaking", "Patents"]);
    expect(new Set(customs.map((s) => s.id)).size).toBe(2);
  });

  it("survives deleting every section", () => {
    const store = makeStore();
    for (const id of [...sectionIds(store)]) store.getState().deleteSection(id);

    expect(doc(store).sections).toEqual([]);
    expect(resumeDocSchema.safeParse(doc(store)).success).toBe(true);
  });
});

describe("clarifications", () => {
  it("removes one clarification by index and drops the key when empty", () => {
    const store = makeStore();
    store.getState().dismissClarification(0);
    expect(doc(store).clarifications).toEqual(["Which month did you start?"]);

    store.getState().dismissClarification(0);
    expect("clarifications" in doc(store)).toBe(false);
  });
});

describe("undo / redo", () => {
  it("moves the pointer across a sequence of edits and back", () => {
    const store = makeStore();
    const s = () => store.getState();

    s().renameSection("workExperience", "Work");
    s().addEntry("workExperience");
    s().reorderEntries("workExperience", "job-2", "job-1");

    expect(jobs(store).map((j) => j.id)).toEqual(["job-2", "job-1", "id-1"]);
    expect(s().past.length).toBe(3);

    s().undo();
    expect(jobs(store).map((j) => j.id)).toEqual(["job-1", "job-2", "id-1"]);

    s().undo();
    expect(jobs(store).map((j) => j.id)).toEqual(["job-1", "job-2"]);

    s().undo();
    expect(doc(store).sections?.find((x) => x.id === "workExperience")?.label).toBe("Experience");
    expect(s().canUndo()).toBe(false);
    expect(s().future.length).toBe(3);

    s().redo();
    s().redo();
    s().redo();
    expect(jobs(store).map((j) => j.id)).toEqual(["job-2", "job-1", "id-1"]);
    expect(s().canRedo()).toBe(false);
  });

  it("is a no-op at each end of the stack", () => {
    const store = makeStore();
    const before = doc(store);

    store.getState().undo();
    expect(doc(store)).toBe(before);

    store.getState().redo();
    expect(doc(store)).toBe(before);
  });

  it("clears the redo stack once a new edit lands after an undo", () => {
    const store = makeStore();
    store.getState().renameSection("education", "Schooling");
    store.getState().undo();
    expect(store.getState().future.length).toBe(1);

    store.getState().renameSection("education", "Studies");
    expect(store.getState().future).toEqual([]);
  });

  it("caps history at the configured depth, discarding the oldest snapshots", () => {
    const store = createResumeStore({
      initialDoc: BASE_DOC,
      generateId: idGenerator(),
      historyLimit: 5,
    });

    for (let i = 0; i < 20; i++) {
      store.getState().renameSection("education", `Label ${i}`);
      // Each rename is its own edit session, otherwise they would coalesce.
      store.getState().endEditSession();
    }

    expect(store.getState().past.length).toBe(5);

    // Undoing to the bottom reaches the oldest retained snapshot, not the original.
    while (store.getState().canUndo()) store.getState().undo();
    expect(doc(store).sections?.find((s) => s.id === "education")?.label).toBe("Label 14");
  });
});

describe("document integrity", () => {
  it("keeps the document JSON-serializable after a long editing sequence", () => {
    const store = makeStore();
    const s = () => store.getState();

    s().updateField(["header", "name"], "Jordan E.", "k1");
    s().addCustomSection("Speaking");
    s().addEntry("id-1");
    s().addBullet("id-1", "id-2");
    s().updateBullet("id-1", "id-2", 0, "Gave a talk");
    s().reorderSections("id-1", "summary");
    s().deleteEntry("workExperience", "job-1");

    const roundTripped = JSON.parse(JSON.stringify(doc(store)));
    expect(roundTripped).toEqual(doc(store));
    expect(resumeDocSchema.safeParse(roundTripped).success).toBe(true);
  });
});

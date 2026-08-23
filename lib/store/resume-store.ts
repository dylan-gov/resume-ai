import { createStore, type StoreApi } from "zustand/vanilla";
import { resumeDocSchema, type ResumeDoc, type SectionKind } from "@/lib/schema/resume";
import {
  createBlankEntry,
  DEFAULT_SECTION_LABELS,
  findSection,
  getSectionEntries,
  isArraySectionKind,
  normalizeDoc,
  reorderById,
  setSectionEntries,
} from "@/lib/resume/sections";

export const DEFAULT_HISTORY_LIMIT = 100;

export type FieldPath = readonly (string | number)[];

export interface ResumeStoreState {
  /** Snapshots strictly older than `present`, oldest first. */
  past: ResumeDoc[];
  /** The single source of truth for both the editor and the live preview. */
  present: ResumeDoc;
  /** Snapshots undone from `present`, nearest-first. */
  future: ResumeDoc[];
  /**
   * Identifies the in-progress edit session, so a run of keystrokes in one
   * field collapses into a single undo step. Null means the next mutation
   * starts a fresh history entry. See `updateField`.
   */
  sessionKey: string | null;
  /** Set when a mutation was rejected for producing a schema-invalid document. */
  lastError: string | null;

  hydrate(doc: ResumeDoc): void;
  updateField(path: FieldPath, value: unknown, sessionKey?: string): void;
  endEditSession(): void;

  addEntry(sectionId: string): void;
  deleteEntry(sectionId: string, entryId: string): void;
  reorderEntries(sectionId: string, fromId: string, toId: string): void;

  /**
   * Bullet actions take the key of the `string[]` they operate on, because
   * not every kind calls it "bullets" — education stores its list under
   * `details`. Defaults to "bullets".
   */
  addBullet(sectionId: string, entryId: string, atIndex?: number, bulletsKey?: string): void;
  updateBullet(
    sectionId: string,
    entryId: string,
    index: number,
    value: string,
    bulletsKey?: string
  ): void;
  deleteBullet(sectionId: string, entryId: string, index: number, bulletsKey?: string): void;
  reorderBullets(
    sectionId: string,
    entryId: string,
    fromIndex: number,
    toIndex: number,
    bulletsKey?: string
  ): void;

  addSection(kind: SectionKind): void;
  addCustomSection(label?: string): void;
  renameSection(sectionId: string, label: string): void;
  deleteSection(sectionId: string): void;
  reorderSections(fromId: string, toId: string): void;

  dismissClarification(index: number): void;

  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export interface CreateResumeStoreOptions {
  initialDoc?: ResumeDoc;
  historyLimit?: number;
  /** Injectable so tests get deterministic ids. */
  generateId?: () => string;
}

export const EMPTY_DOC: ResumeDoc = { sections: [] };

/** Immutable deep set. `undefined` removes the key rather than storing a hole. */
function setIn(target: unknown, path: FieldPath, value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;

  if (Array.isArray(target)) {
    const index = Number(head);
    const next = target.slice();
    next[index] = setIn(target[index], rest, value);
    return next;
  }

  const source = (target ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  const key = String(head);
  if (rest.length === 0 && value === undefined) {
    delete next[key];
    return next;
  }
  next[key] = setIn(source[key], rest, value);
  return next;
}

function defaultGenerateId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Creates an isolated editor store. The React app uses the module-level
 * `resumeStore` below; tests call this directly so each case starts clean.
 */
export function createResumeStore(
  options: CreateResumeStoreOptions = {}
): StoreApi<ResumeStoreState> {
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const generateId = options.generateId ?? defaultGenerateId;

  return createStore<ResumeStoreState>()((set, get) => {
    /**
     * The single funnel every mutation goes through.
     *
     * Validates the produced document and drops the mutation if it would
     * make the store invalid, so `present` is always a schema-valid
     * `ResumeDoc`. When `sessionKey` matches the open session the snapshot
     * is replaced in place instead of pushing a new history entry — that is
     * what keeps a typed sentence from becoming forty undo steps.
     */
    function commit(
      produce: (doc: ResumeDoc) => ResumeDoc,
      sessionKey?: string
    ): void {
      const state = get();
      const candidate = produce(state.present);

      const parsed = resumeDocSchema.safeParse(candidate);
      if (!parsed.success) {
        set({ lastError: parsed.error.issues[0]?.message ?? "Invalid document" });
        return;
      }
      const next = parsed.data;

      if (sessionKey && sessionKey === state.sessionKey) {
        set({ present: next, lastError: null });
        return;
      }

      const past = [...state.past, state.present];
      set({
        past: past.length > historyLimit ? past.slice(past.length - historyLimit) : past,
        present: next,
        future: [],
        sessionKey: sessionKey ?? null,
        lastError: null,
      });
    }

    /** Replaces a section's entries, resolving the section by id first. */
    function withSection(
      sectionId: string,
      produce: (doc: ResumeDoc, entries: ReturnType<typeof getSectionEntries>) => ResumeDoc
    ): (doc: ResumeDoc) => ResumeDoc {
      return (doc) => {
        const section = findSection(doc, sectionId);
        if (!section) return doc;
        return produce(doc, getSectionEntries(doc, section));
      };
    }

    /** Maps over one entry's bullet-style array. Shared by every bullet action. */
    function withBullets(
      sectionId: string,
      entryId: string,
      bulletsKey: string,
      produce: (bullets: string[]) => string[]
    ): (doc: ResumeDoc) => ResumeDoc {
      return withSection(sectionId, (doc, entries) => {
        const section = findSection(doc, sectionId)!;
        const nextEntries = entries.map((entry) => {
          if (entry.id !== entryId) return entry;
          const raw = (entry as Record<string, unknown>)[bulletsKey];
          const current = Array.isArray(raw) ? (raw as string[]) : [];
          return { ...entry, [bulletsKey]: produce(current) };
        });
        return setSectionEntries(doc, section, nextEntries);
      });
    }

    return {
      past: [],
      present: normalizeDoc(options.initialDoc ?? EMPTY_DOC),
      future: [],
      sessionKey: null,
      lastError: null,

      hydrate(doc) {
        const parsed = resumeDocSchema.safeParse(normalizeDoc(doc));
        if (!parsed.success) {
          set({ lastError: parsed.error.issues[0]?.message ?? "Invalid document" });
          return;
        }
        // Hydration replaces the document wholesale, so prior history no
        // longer describes this document and is discarded.
        set({
          past: [],
          present: parsed.data,
          future: [],
          sessionKey: null,
          lastError: null,
        });
      },

      updateField(path, value, sessionKey) {
        commit((doc) => setIn(doc, path, value) as ResumeDoc, sessionKey);
      },

      endEditSession() {
        if (get().sessionKey !== null) set({ sessionKey: null });
      },

      addEntry(sectionId) {
        commit(
          withSection(sectionId, (doc, entries) => {
            const section = findSection(doc, sectionId)!;
            return setSectionEntries(doc, section, [
              ...entries,
              createBlankEntry(section.kind, generateId()),
            ]);
          })
        );
      },

      deleteEntry(sectionId, entryId) {
        commit(
          withSection(sectionId, (doc, entries) => {
            const section = findSection(doc, sectionId)!;
            return setSectionEntries(
              doc,
              section,
              entries.filter((e) => e.id !== entryId)
            );
          })
        );
      },

      reorderEntries(sectionId, fromId, toId) {
        commit(
          withSection(sectionId, (doc, entries) => {
            const section = findSection(doc, sectionId)!;
            return setSectionEntries(doc, section, reorderById(entries, fromId, toId));
          })
        );
      },

      addBullet(sectionId, entryId, atIndex, bulletsKey = "bullets") {
        commit(
          withBullets(sectionId, entryId, bulletsKey, (bullets) => {
            const next = [...bullets];
            next.splice(atIndex ?? next.length, 0, "");
            return next;
          })
        );
      },

      updateBullet(sectionId, entryId, index, value, bulletsKey = "bullets") {
        commit(
          withBullets(sectionId, entryId, bulletsKey, (bullets) => {
            const next = [...bullets];
            next[index] = value;
            return next;
          }),
          `bullet:${sectionId}:${entryId}:${bulletsKey}:${index}`
        );
      },

      deleteBullet(sectionId, entryId, index, bulletsKey = "bullets") {
        commit(
          withBullets(sectionId, entryId, bulletsKey, (bullets) =>
            bullets.filter((_, i) => i !== index)
          )
        );
      },

      reorderBullets(sectionId, entryId, fromIndex, toIndex, bulletsKey = "bullets") {
        commit(
          withBullets(sectionId, entryId, bulletsKey, (bullets) => {
            if (
              fromIndex === toIndex ||
              fromIndex < 0 ||
              toIndex < 0 ||
              fromIndex >= bullets.length ||
              toIndex >= bullets.length
            ) {
              return bullets;
            }
            const next = [...bullets];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
          })
        );
      },

      addSection(kind) {
        commit((doc) => {
          const sections = doc.sections ?? [];
          if (kind !== "custom" && sections.some((s) => s.kind === kind)) return doc;

          const section = {
            id: kind === "custom" ? generateId() : kind,
            kind,
            label: DEFAULT_SECTION_LABELS[kind],
            ...(kind === "custom" ? { entries: [] } : {}),
          };

          let next: ResumeDoc = { ...doc, sections: [...sections, section] };
          // Built-in array sections need their backing array to exist so the
          // editor can render an empty state and append into it.
          if (isArraySectionKind(kind) && !next[kind]) {
            next = { ...next, [kind]: [] } as ResumeDoc;
          }
          if (kind === "summary" && next.summary === undefined) {
            next = { ...next, summary: "" };
          }
          return next;
        });
      },

      addCustomSection(label) {
        commit((doc) => ({
          ...doc,
          sections: [
            ...(doc.sections ?? []),
            {
              id: generateId(),
              kind: "custom" as const,
              label: label ?? DEFAULT_SECTION_LABELS.custom,
              entries: [],
            },
          ],
        }));
      },

      renameSection(sectionId, label) {
        commit(
          (doc) => ({
            ...doc,
            sections: doc.sections?.map((s) => (s.id === sectionId ? { ...s, label } : s)),
          }),
          `section-label:${sectionId}`
        );
      },

      deleteSection(sectionId) {
        commit((doc) => {
          const section = findSection(doc, sectionId);
          if (!section) return doc;

          const next: ResumeDoc = {
            ...doc,
            sections: (doc.sections ?? []).filter((s) => s.id !== sectionId),
          };

          // Drop the backing data too, so a deleted section does not linger
          // invisibly in the document that Phase 3 persists and Phase 4 exports.
          if (section.kind === "summary") {
            delete next.summary;
          } else if (isArraySectionKind(section.kind)) {
            delete next[section.kind];
          }
          return next;
        });
      },

      reorderSections(fromId, toId) {
        commit((doc) => ({
          ...doc,
          sections: reorderById(doc.sections ?? [], fromId, toId),
        }));
      },

      dismissClarification(index) {
        commit((doc) => {
          const remaining = (doc.clarifications ?? []).filter((_, i) => i !== index);
          if (remaining.length === 0) {
            const next = { ...doc };
            delete next.clarifications;
            return next;
          }
          return { ...doc, clarifications: remaining };
        });
      },

      undo() {
        const { past, present, future } = get();
        if (past.length === 0) return;
        set({
          past: past.slice(0, -1),
          present: past[past.length - 1],
          future: [present, ...future],
          sessionKey: null,
          lastError: null,
        });
      },

      redo() {
        const { past, present, future } = get();
        if (future.length === 0) return;
        set({
          past: [...past, present],
          present: future[0],
          future: future.slice(1),
          sessionKey: null,
          lastError: null,
        });
      },

      canUndo() {
        return get().past.length > 0;
      },

      canRedo() {
        return get().future.length > 0;
      },
    };
  });
}

/** The app-wide editor store. Single-document editor, so a singleton is enough. */
export const resumeStore = createResumeStore();

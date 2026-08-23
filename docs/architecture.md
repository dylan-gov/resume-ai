# Architecture — Phase 1

This covers the three load-bearing decisions in Phase 1: the `ResumeDoc`
schema, the AI provider abstraction, and what's deliberately left for
Phase 2/3 to build on top of.

## The `ResumeDoc` schema (`lib/schema/resume.ts`)

`resumeDocSchema` (Zod) is the single source of truth for a resume,
end to end — extraction output, render input, and (in later phases) the
edit and export input. A few decisions worth calling out:

- **Every section is optional.** A resume is never "complete"; the schema
  has to represent a half-filled draft just as validly as a finished one.
  The AI extraction step is instructed to omit a section entirely rather
  than pad it with empty/placeholder entries.
- **Dates are free-form strings**, not `Date`/timestamp values. Resumes say
  things like "Summer 2019" or "2021 – Present"; forcing that into a real
  date type would mean silently guessing at precision that was never there.
- **Every array entry has a stable `id`.** Phase 2 (editing) and future
  reordering/drag-and-drop need something to key off other than array
  index. Critically, **the model is never asked to produce these IDs** —
  `resumeDraftSchema` is the same shape with every `id` field stripped
  (via `.omit({ id: true })` per entry), and `generateResumeDraft` assigns
  real IDs (`crypto.randomUUID()`) server-side after generation, in
  `attachIds()`. An LLM has no way to produce an ID that's actually stable
  across regenerations, so it isn't given the chance to.
- **`clarifications: string[]`** is part of the document, not a side
  channel. It's the model's way of saying "I didn't have enough
  information to fill this in confidently" instead of guessing — the UI
  surfaces it above the rendered resume. Answering clarifications is
  Phase 2; Phase 1 only displays them.

## The AI provider abstraction (`lib/ai/`)

`generateResumeDraft(input, opts)` in `lib/ai/generate-resume-draft.ts` is
the *only* function the rest of the app calls to talk to an LLM. It:

1. Resolves a `LanguageModel` via `resolveModel()` (`lib/ai/provider.ts`) —
   the only file that imports a provider package (`@ai-sdk/anthropic`,
   `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/mistral`, `@ai-sdk/groq`).
   Provider + model are read from `AI_PROVIDER` / `AI_MODEL` env vars (with
   per-provider API keys), so switching providers is a config change, never
   a code change. Google, Mistral, and Groq were each added after the fact
   and each touched exactly one file plus config — the abstraction working
   as intended.
2. Calls `generateText` with `output: Output.object({ schema:
   resumeDraftSchema })` from the Vercel AI SDK — structured output
   validated against the Zod schema, not hand-parsed JSON. (Note: this
   codebase is on AI SDK v7, where the older `generateObject` helper is
   deprecated in favor of `generateText` + `output`; see
   `node_modules/ai/dist/index.d.ts` if this ever needs re-verifying
   against a different SDK version.)
3. Runs the result through `attachIds()` and a final
   `resumeDocSchema.parse()` before returning — the function's return type
   is a guarantee, not just a type annotation.

The extraction-quality rules (never invent facts, merge duplicate entries
across source documents, rewrite bullets professionally, ask instead of
guessing) live in the system prompt in `lib/ai/prompt.ts`, not scattered
across the codebase.

### Provider/model choice is a correctness concern, not just a cost one

The schema asks a model to fill 13 entirely-optional sections in one shot.
That shape is right for the product but it is demanding: a model that isn't
strong enough silently under-extracts rather than failing loudly, and
**Zod validation cannot catch this** — a resume missing its education
section is still a structurally valid `ResumeDoc`.

Measured against `fixtures/sample-resume.txt`, whose contents are known, by
scoring 14 expected facts (2 jobs, 5 bullets, 2 end dates, 1 education entry
with details, 2 skill groups, 1 certification). The schema was confirmed to
reach each provider intact — all 13 top-level properties and all 6
`workExperience` item properties:

| Provider / model | Score | Consistency | Time |
| --- | --- | --- | --- |
| `mistral/mistral-large-latest` | 14/14 | 3/3 runs identical | ~7s |
| `mistral/mistral-medium-latest` | 14/14 | 3/3 runs identical | ~3–9s |
| `google/gemini-3-flash-preview` | 14/14 *or* far less | varies run to run | ~14s |
| `google/gemini-flash-latest` | degenerate | — | — |
| `groq/*` | could not run | — | — |

Findings worth carrying forward:

- **Weak models fail silently, not loudly.** `gemini-flash-latest` collapsed
  into a token-repetition loop, dumping hundreds of junk words into
  `startDate` — and still passed `resumeDocSchema.parse()`, because garbage
  strings are valid strings. `gemini-3-flash-preview` was worse in a subtler
  way: *sometimes* perfect, sometimes dropping bullets, education, and end
  dates that are plainly in the source, with `finishReason: stop` (not
  truncation) and ~1000–1500 reasoning tokens against ~80–230 output tokens.
  Neither prompt strengthening nor `thinkingLevel` tuning fixed it.
- **Groq cannot enforce this schema.** With `structuredOutputs` enabled,
  `llama-3.3-70b-versatile` rejects `json_schema` outright and the
  `gpt-oss-*` models enforce OpenAI *strict* mode, which requires every
  object to list all of its properties in `required`. Our schema is
  deliberately all-optional (a resume in progress is missing whole
  sections), so satisfying strict mode would mean making every field
  required-but-nullable — inverting the meaning the extraction prompt relies
  on ("omit the section entirely if the source has nothing for it"). With
  `structuredOutputs` disabled the SDK falls back to plain JSON mode, where
  the schema is not enforced at all and output fails validation. Groq stays
  wired up for when a compatible model is available, but the schema design
  is not going to be contorted to fit one provider's strict mode.
- **"Schema-valid" is a floor, not proof of a good extraction.** Zod does
  structural validation only, by design. A semantic quality check — flagging
  when the source clearly contains a section the output omits — is the
  natural follow-up, and the scoring harness above is the seed of it.

Long inputs are handled *before* this layer, not inside it:
`lib/ai/truncate.ts` scores each source document by resume-like signal
(keywords like "experience"/"education", year-like numbers) and keeps the
highest-signal blocks within a character budget, preserving their original
order. `app/api/generate/route.ts` calls this ahead of
`generateResumeDraft` and surfaces a warning if truncation happened, since
`generateResumeDraft`'s return type is just a validated `ResumeDoc` with no
room for out-of-band warnings.

## Text extraction (`lib/extraction/`)

One function, one interface: `extractText(file): Promise<ExtractedDoc>`,
dispatching to a format-specific module (`pdf.ts` via `unpdf`, `docx.ts`
via `mammoth`, `text.ts` for `.txt`/`.md`) based on MIME type with an
extension fallback (browsers report unreliable MIME types for `.txt`/`.md`).
Every failure mode — corrupt file, scanned/image-only PDF with no
extractable text, unsupported type, oversized file — throws a typed
`ExtractionError` with a `type` the UI can map to a specific message,
instead of an unhandled exception turning into a 500.

# Architecture — Phase 2 (editing, state, live preview)

Phase 2 turns the read-only render into an editor. Nothing about the Phase 1
pipeline changed: extraction, the AI layer, and the API route are untouched.

## The section ordering layer (a schema extension, not a rewrite)

Phase 1 modelled sections as fixed keys on the document (`workExperience`,
`education`, ...). That cannot express three things Phase 2 requires:
user-controlled section order, renamed headings, and custom sections.

Rather than restructure into a generic `sections: Section[]` union — which
would have broken the AI layer's `generateObject` schema and the template's
per-kind rendering — Phase 2 adds an **ordering layer alongside** the
existing arrays:

```ts
sections?: Array<{ id, kind, label, entries? }>
```

`sections` owns *order and headings*. Entry data still lives where Phase 1
put it: the top-level array named by the section's `kind`. Only
`kind: "custom"` sections carry their own `entries`, because there is no
top-level array for them. `lib/resume/sections.ts` is the single place that
knows this split (`getSectionEntries` / `setSectionEntries`), so no other
code has to care.

The field is optional, so **every Phase 1 document is still valid**.
`normalizeDoc()` backfills a default section list (default order, default
labels, only sections that have content) when the store hydrates. It is
idempotent, and it is the same entry point Phase 3 will use when hydrating
from a persisted record.

Two deliberate exclusions: the **header** is not a section — it is the
resume's identity block, always present and always first, so it is not
reorderable or deletable. And **bullets stay `string[]`** rather than
gaining ids, so the AI layer and Phase 4 export keep working against the
same shape; `BulletListEditor` derives drag identity from position, which is
safe because it is the only writer and the ids are recomputed from the store
after every change.

## State model (`lib/store/resume-store.ts`)

One immutable `ResumeDoc` in a Zustand store, with history:

```ts
{ past: ResumeDoc[], present: ResumeDoc, future: ResumeDoc[], sessionKey: string | null }
```

`present` is the single source of truth. The editor and the live preview
both read it, so they cannot drift — the preview is literally the Phase 1
`<ResumeView>` given `present`.

Every mutation funnels through one internal `commit(produce, sessionKey?)`:

1. Produce a candidate document immutably.
2. `resumeDocSchema.safeParse` it. **If it fails, the mutation is dropped**
   and `lastError` is set, so the store can never hold an invalid document.
   The parsed output is what gets stored, which also keeps the document
   normalized and JSON-clean.
3. Push the previous `present` onto `past` (capped at
   `DEFAULT_HISTORY_LIMIT` = 100, oldest discarded) and clear `future`.

Whole-document snapshots rather than diffs: the document is small JSON, and
snapshotting is far harder to get wrong than patch/inverse-patch pairs.

### Undo coalescing

Snapshot-per-change would make a typed sentence forty undo steps. Each
mutation may carry a **session key** (`field:<entryId>:<key>`). When the
incoming key matches the open session, `commit` replaces `present` in place
instead of pushing history — so the preview still updates on every
keystroke, but history gains one entry per edit session.

A session ends when: a different key arrives, a structural action runs
(those pass no key), the field blurs, or typing pauses (700ms, in
`InlineField`). The store itself holds no timers, which keeps it
synchronous and fully unit-testable; the UI decides when a session is over.

### Action API

`updateField(path, value)` is the generic primitive — an immutable deep set
where `undefined` deletes the key rather than leaving a hole, keeping the
document serializable. Everything else is a typed action:
`addEntry` / `deleteEntry` / `reorderEntries`,
`addBullet` / `updateBullet` / `deleteBullet` / `reorderBullets`,
`addSection` / `addCustomSection` / `renameSection` / `deleteSection` /
`reorderSections`, `dismissClarification`, `undo` / `redo`.

Reordering is reindexing an array, always **by id** (`reorderById`), never
by array index — ids flow from the store through `dnd-kit` and back. Bullet
actions additionally take the key of the list they edit, because not every
kind calls it `bullets` (education's is `details`); getting this wrong
silently wrote a field the schema strips, which is what the
`education / details` regression test pins down.

`deleteSection` also drops the section's backing data, so a deleted section
does not linger invisibly in the document Phase 3 persists and Phase 4
exports.

`createResumeStore()` is a factory (with injectable `generateId` and
`historyLimit`) so each test gets an isolated store; the app uses a single
module-level instance, which is enough for a one-document editor.

## Clarifications (`lib/resume/clarifications.ts`)

Phase 1 emits clarifications as plain prose with no pointer to what they are
about. Phase 2 resolves each question to `{ sectionId, entryId, fieldKey }`
by matching its text against identifying values already in the document
(company, institution, ...) and mapping keywords to a field the entry
actually has. It is best-effort and never invents content — only *where* a
question points. Unresolved questions still show, just without an inline
answer field. Answering is ordinary editing; dismissing removes the string
from the document.

## What Phase 3 and Phase 4 build on top of this

- **Phase 3 (persistence)** hydrates the store with
  `resumeStore.getState().hydrate(doc)`, which runs `normalizeDoc` and
  resets history — the same path the generate flow already uses, so
  persistence needs no new state plumbing. Saving is
  `JSON.stringify(store.getState().present)`; the store guarantees that
  value is schema-valid and free of React state or class instances.
- **Phase 4 (export)** reads that same `present` document. Because
  `sections` carries order and labels, an exporter renders sections in the
  user's chosen order without consulting the UI.

# Architecture — Phase 3 (auth & persistence)

Phase 3 wraps auth and storage *around* the Phase 2 editor. The store, the
schema, and the editing model are unchanged — persistence reads `present`
and writes it out, and loading hydrates it back.

## Auth and session flow (Supabase)

`@supabase/ssr` with three clients, each for a different runtime:

| File | Runtime | Purpose |
| --- | --- | --- |
| `lib/supabase/client.ts` | browser | anon key only |
| `lib/supabase/server.ts` | server components / actions | per-request, bound to the cookie jar |
| `lib/supabase/proxy.ts` | proxy | refreshes the session, gates routes |

Three things here are easy to get wrong and are load-bearing:

1. **The file is `proxy.ts`, not `middleware.ts`.** Next.js 16 renamed
   Middleware to Proxy. Supabase's documentation still says
   `middleware.ts`, which in Next 16 is an inert filename — session refresh
   would silently never run, producing random logouts.
2. **Always `getUser()`, never `getSession()`.** `getSession()` reads the
   cookie payload, which the client can modify; `getUser()` revalidates the
   token with Supabase. Authorization decisions use `getUser()` only.
3. **The proxy returns the same response object the cookies were written
   to.** Constructing a fresh `NextResponse` after `setAll` discards the
   rotated tokens.

API routes are excluded from the proxy's redirect: they authenticate
themselves and answer with JSON status codes. Redirecting `/api/generate`
to an HTML sign-in page made `res.json()` throw in the browser, surfacing a
generic network error instead of "Sign in to generate a resume."

Proxy gating is a **convenience, not the security boundary**. Every server
action and protected page re-derives the user from the session
independently, so a proxy misconfiguration cannot expose data.

## Data model, and why the resume is a JSON column

```
users (id = Supabase auth.users.id, email)
  └─ resumes (id, userId, title, doc JSONB, timestamps)
```

`users` mirrors the Supabase auth user and stores **no credentials** —
Supabase owns identity. `resumes.doc` is the Zod `ResumeDoc` verbatim.

Storing the document as one JSON column rather than normalizing it into a
dozen relational tables is deliberate: the Zod schema is already the
canonical definition, the editor store already holds exactly this shape, and
a resume is always read and written whole. Normalizing would mean
maintaining the same structure in three places (Zod, Prisma, the store) and
reassembling it on every read, for no query we actually need — nothing in
the product searches *inside* a resume. The column is validated against Zod
on every write, so it can never hold a document the app cannot parse, and
parsed again on read in case a stored document predates a schema change.

The index is `(userId, updatedAt)` — userId leads because every query is
scoped by it.

### Forward-compatible placeholders

`folderId`, `parentResumeId`, and `versionLabel` exist as nullable columns
with **no UI or logic behind them**. Folders and version history are their
own phases; declaring the columns now means those phases add behavior
rather than rewriting a large table.

## Data isolation

This is the phase's most important invariant, and it lives in
`lib/data/resumes.ts`: **every query carries the owner's id inside the
`where` clause**, so Postgres does the filtering rather than a follow-up
`if` in application code.

- Reads use `findFirst({ where: { id, userId } })` — never
  `findUnique({ where: { id } })` followed by an ownership check.
- Writes use `updateMany` / `deleteMany` with `{ id, userId }`, because
  `update` / `delete` only accept a unique key in `where` and so cannot
  carry the userId. A non-owner matches zero rows.

A non-owner therefore gets exactly the same `NotFoundError` as someone
asking for a row that does not exist — no existence oracle.

`userId` always comes from the session. No action signature even has a slot
for a client-supplied user id.

`lib/data/resumes.test.ts` proves this: Bob cannot read, rename, overwrite,
duplicate, or delete Alice's resume. The tests run against an in-memory fake
that applies `where` exactly as Postgres would, so dropping `userId` from a
query makes them fail — verified by mutation-testing the repository.

**RLS is the backstop.** These tables sit in the `public` schema, which
Supabase exposes over PostgREST using the anon key that ships to the
browser. `prisma/migrations/.../enable_rls` enables RLS with no permissive
policies and revokes the anon/authenticated grants, so the tables are
unreachable with the public key. Note it uses `ENABLE`, not `FORCE`:
Prisma connects as the table owner, and `FORCE` with no policies would lock
the application out of its own tables.

## How the database connects to the Phase 2 store

Hydration is the entire adapter, because the store already accepts a
`ResumeDoc`:

```
DB row.doc → resumeDocSchema.parse → resumeStore.hydrate(doc)
```

`PersistentEditor` hydrates during its first render, so the editor never
paints an empty document first. Undo history starts fresh on load —
prior history describes a different document.

Writing back is `usePersistence`, which is deliberately **one-directional**:
it reads `present` and sends it, and never writes into the store. A slow or
failed save therefore cannot clobber what the user is typing; the failure
surfaces as save status while local edits stay intact. It detects change by
reference (store mutations always produce a new object), autosaves 2s after
edits settle, and only autosaves resumes that already exist — a freshly
generated draft is created by an explicit "Save to my account", so nothing
is silently written to an account.

`lib/db.ts` constructs the Prisma client **lazily**, on first property
access. Next.js collects page configuration at build time and Vercel builds
often have no database credentials; connecting eagerly made the app
unbuildable without a live database.

# Architecture — Phase 4 (export)

## One outline, four formats

The phase's hard requirement is that no format may invent, drop, or reorder
content relative to the `ResumeDoc`. Rather than police that with tests
alone, the code makes divergence structurally difficult:
`lib/export/outline.ts` flattens a `ResumeDoc` into a **format-neutral
outline**, and PDF, DOCX, Markdown, and TXT all render *that*.

```
ResumeDoc ─► buildOutline() ─► ResumeOutline ─┬─► PDF   (React-PDF)
                                              ├─► DOCX  (docx)
                                              ├─► Markdown
                                              └─► TXT
```

Deciding what each section contributes, and in what order, happens exactly
once. Section order is read straight from `doc.sections` — the Phase 2
ordering layer — so a user's reordering and deletions apply everywhere at
once. A section with no entries is dropped in `buildOutline`, so it cannot
reappear in one format and not another.

Every exporter implements the same interface:

```ts
interface Exporter {
  format: ExportFormat;
  contentType: string;
  extension: string;
  generate(doc: ResumeDoc): Promise<{ body: Uint8Array | string; warnings: string[] }>;
}
```

They are pure `ResumeDoc -> bytes` functions with no request context, which
is what makes them independently testable and reusable.

## PDF: React-PDF (Option A), and why

`@react-pdf/renderer` over headless Chrome. The spike that settled it, run
before any layout work:

| | Result |
| --- | --- |
| Valid PDF bytes | yes (`%PDF-` header) |
| Cold render, 4-page doc | **0.14s** |
| Pagination | automatic, verified across pages |
| Text extractable (ATS) | yes — 12.5k characters recovered |
| Runtime dependencies | none; no browser binary |

Headless Chrome would buy pixel-parity with the HTML preview, but costs a
~50MB Chromium layer, multi-second cold starts, and a class of
Vercel-specific failure modes. Nothing in the product requires the PDF to
be a pixel copy of the preview — it requires the same *content*, which the
shared outline already guarantees. So the PDF is a parallel renderer of the
outline, not a screenshot.

`@react-pdf/renderer` is already in Next.js's default
`serverExternalPackages` list, so no `next.config.ts` change is needed;
`docx` is pure JavaScript and bundles fine. Verified against a production
build: no PDF/DOCX library code reaches the client bundle.

### Two PDF findings worth keeping

**Standard PDF fonts silently corrupt non-WinAnsi characters.** Measured:
`→` (U+2192) came back out of the rendered PDF as `’` — a *different
character*, with no error raised — and `✓` vanished. Since silent
corruption is exactly what the fidelity rule forbids,
`lib/export/pdf-text.ts` handles unsupported characters explicitly:
symbols with a faithful ASCII equivalent are transliterated (`→` becomes
`->`), anything else becomes a visible marker **and raises a warning**
shown in the UI. DOCX, Markdown, and TXT embed no fonts and carry every
character exactly, so the warning points users there. This is the one place
where PDF cannot be fully faithful, and it is surfaced rather than hidden.

**`letterSpacing` breaks ATS parsing.** Styling section headings with
`letterSpacing` made them extract as `E X P E R I E N C E`. The PDF still
*looked* correct and still contained "real text", but no ATS scanning for
`EXPERIENCE` would ever match it. Visual hierarchy now comes from weight,
case, and a rule; a regression test asserts headings extract as whole words.

## Delivery

`POST /api/export/[format]` authenticates first, then validates the posted
document against the Zod schema, then generates and streams the file with
`Content-Type`, `Content-Disposition`, and a sanitized filename.

The document is **posted by the client rather than read from the database**,
because the export must reflect the live editor state including unsaved
edits. That is safe: it is the caller's own content, re-validated
server-side, and no id is accepted from the client — so unlike a
`?resumeId=` design there is no object-reference surface to abuse. Filenames
are sanitized before entering the `Content-Disposition` header, since a
resume title is user-controlled text and would otherwise be a
header-injection vector.

## How later phases plug in

Multiple templates (a later phase) become a second renderer per format
rather than a second pipeline. `buildOutline` stays the shared front half;
each format gains a template parameter selecting among renderers of the
same `ResumeOutline`. Because the exporters are pure functions behind one
interface, a new template touches no route handler and no UI wiring — and
the fidelity tests, which assert across all formats at once, keep applying.

# Architecture — Phase 5 (ATS analysis & JD matching)

## Deterministic first, AI only for judgment

Almost all of this phase is pure functions over the `ResumeDoc`. That is not
frugality for its own sake — it is what makes scores **reproducible,
free, instant, and unit-testable**, and it is what stops a language model
inventing a number and calling it a score.

| Deterministic (no model call) | AI-assisted |
| --- | --- |
| ATS, formatting, readability scores | Bullet rewrites |
| Weak-opener, passive-voice, buzzword, quantification detection | Semantic synonyms beyond the curated list |
| Bullet length checks | |
| JD keyword extraction, weighting, and matching | |

The AI half is strictly **additive**: `findSemanticSynonyms` can only turn a
`missing` keyword into a `synonym`, never the reverse, and it returns an
empty array on any failure. The match percentage therefore never depends on
a model call succeeding — if the provider is down, matching still works with
the curated synonym list alone.

Because the deterministic analysis is pure and cheap, it runs **in the
browser** against the live store, so scores update as the user edits with no
round trip. `useDeferredValue` keeps typing smooth. The AI parts are
user-triggered only, so keystrokes never spend money.

## Scoring, and why every number is explainable

`Score` is `{ value, checks[] }` by construction — the type will not let a
number exist without the checks that produced it. Each `ScoreCheck` carries
what was observed (`detail`) and, when failing, what to do (`howToImprove`).
The value is a weighted pass rate, not a curve:

```
value = round(Σ weight(passed) / Σ weight × 100)
```

- **ATS compatibility** — contact details, presence of the sections a parser
  looks for, whether their headings are *recognizable* (a section renamed
  "Where I've Worked" is flagged), start dates on every role, and the share
  of bullets carrying a metric. One check is a structural guarantee rather
  than a heuristic: the document is JSON and Phase 4 exports real selectable
  text, never an image.
- **Formatting** — no paragraph-length bullets, no three-word stubs, every
  section labelled, every role having both a title and an employer, no empty
  sections.
- **Readability** — Flesch–Kincaid grade over bullet text. Each bullet counts
  as one sentence unless it contains terminal punctuation; treating the whole
  resume as one sentence would inflate the grade wildly. Syllable counting is
  a documented vowel-group approximation, and the tests assert a ±1 tolerance
  rather than pretending it is exact.

## Findings are locations, not just messages

Every `Finding` carries a `BulletRef` — `sectionId`, `entryId`, `index`, and
`bulletsKey`. That is exactly the argument list of the Phase 2 store action
`updateBullet(...)`, which is why accepting an AI rewrite goes through the
**ordinary store mutation** and is undoable, appears in the live preview, and
needs no separate write path. `bulletsKey` is carried because education
stores its list under `details`, not `bullets`.

The same ref produces a stable DOM id (`bulletDomId`), which is how clicking
a finding scrolls to and highlights the bullet in the editor.

One finding is deliberately **not** rewritable: a missing metric. Offering to
"fix" it would mean inventing a number the user never claimed, so
quantification gaps are surfaced and left to the user.

## Job-description matching

Extraction takes unigrams plus 2- and 3-grams so multi-word skills survive
("machine learning"), weighted by frequency and by whether the term sits
under a requirements heading — the heading's context carries forward to the
lines beneath it, because that is how job descriptions are actually written.

Matching produces three outcomes, and the middle one is the point:

- **matched** — the resume uses the JD's own wording
- **synonym** — the same skill under different wording, reported as covered
- **missing** — genuinely absent

That distinction is what stops the app telling a "React.js" user to add
"React". Synonyms count fully toward coverage, because the user *has* the
skill.

Two failure modes are guarded explicitly:

- **Junk phrases.** "Kubernetes and Docker" must not be extracted as one
  phrase — it can never match, and it drags the coverage denominator down.
  `PHRASE_BREAKERS` blocks conjunctions inside a phrase while leaving
  genuine ones like "infrastructure as code" intact.
- **Dishonest equivalences.** Some near-neighbours are deliberately *not*
  synonyms, because claiming coverage the user does not have is worse than
  an extra "missing" entry: `terraform ≠ infrastructure as code` (a tool vs
  the practice), `docker ≠ containerization`, `scrum ≠ kanban`, `c# ≠ .net`.
  The AI synonym prompt is given the same rule.

Nothing in this phase fabricates experience. Rewrites may only restate what
a bullet already claims — "helped with X" may become "contributed to X", never
"led X" — and the JD panel tells users plainly that leaving out a skill they
lack is the honest choice.

## Where the word lists live

All in `lib/analysis/wordlists/`, each file a labelled data module with no
logic: `weak-openers.ts` (weak openers + action verbs), `buzzwords.ts`,
`passive.ts` (be-forms, irregular participles, and the -ed exceptions that
prevent "is experienced" false positives), and `keywords.ts` (stopwords,
synonym groups, phrase breakers, requirement markers).

# Architecture — Phase 6 (templates, customization, polish)

## The contract

```ts
Template = (doc: ResumeDoc, style: StyleConfig) => rendered resume
```

**Content lives in the document; appearance lives in the template and
`StyleConfig`.** Everything else in this phase follows from that one rule.

It is enforced structurally rather than by discipline: no template touches
the `ResumeDoc`. Templates render the **outline** — Phase 4's format-neutral
flattening — so a template physically cannot add, drop, or reorder content.

```
ResumeDoc ─► buildOutline() ─► ResumeOutline ─┬─► preview  (TemplateRenderer)
                               + ResolvedTheme ├─► PDF      (React-PDF)
                                               └─► DOCX     (docx)
```

`resolveTheme(style)` computes every size, colour, and spacing **once, in
points**, and the preview and the PDF both consume it. "The PDF matches what
you see" is therefore a property of the code, not two renderers kept in sync
by hand.

### Templates are data, not components

Seven bespoke layouts would mean fourteen renderers (preview + PDF) and an
export integration that rots. Instead each template is a set of **tokens** —
header treatment, section device, name case and tracking, date placement,
density, bullet glyph — interpreted by one preview renderer and one PDF
renderer. The tokens were chosen as the axes that actually distinguish
professional resume designs; colour alone is the shallowest of them.

**Adding a template is a data change** in `lib/templates/registry.ts`. It
appears in the preview, the PDF, the DOCX theme, the picker, the command
palette, and the dashboard thumbnail at once, and the contract tests apply to
it automatically because they iterate `TEMPLATE_IDS`.

### Picking a template adopts its look

`applyTemplate(id)` returns that template's designed styling rather than
carrying the previous one's across. Without this, switching template changed
only layout tokens while keeping the old typeface and accent, and the seven
designs looked far more alike than intended — a bug the tests now pin down.
The trade-off is that switching discards manual tweaks; that is the right
default for "flip between templates to compare".

### StyleConfig

A flat, serializable object persisted in `resumes.style` (a nullable `Json`
column, so resumes predating templates simply render with defaults).

Every numeric control is **bounded** — `resolveStyle` clamps rather than
rejects, so a value saved before a control existed still opens. Colour is the
one control that warns instead of blocking: a pale accent can be a deliberate
choice, pale body text essentially never is, so the thresholds differ and the
warning mentions grayscale printing.

Fonts are deliberately three, not thirty: the PDF uses the standard PDF fonts
(no font files, no serverless font-loading failure — Phase 4's decision), and
offering ten CSS families that all collapse to three PDF families would
misrepresent what the export looks like.

### ATS safety is never traded for looks

Every template emits plain semantic markup, one reading order, and real text.
The gutter-label designs (Technical, Creative) still emit the label *before*
its content, so extraction order is unchanged. A test renders all seven to
PDF, extracts the text, and asserts the headings and all content survive —
visual distinctiveness that breaks parsing is a failure, not a trade-off.

### DOCX is a theme, not a layout

Word cannot express a gutter label or a full-bleed band without tables and
frames, which is exactly what makes a `.docx` unparseable to an ATS. So DOCX
takes the parts of a template that translate faithfully — typeface, accent,
case, spacing, heading rule, bullet glyph — and keeps the structure Word is
good at. A deliberate limit, not an oversight.

## Theming

App chrome supports light/dark/system; the **resume itself stays white in
both**, because it is a preview of a printed document. The stored preference
is read with `useSyncExternalStore` (localStorage is external state), and an
inline script in `<head>` applies the class before first paint so there is no
flash. `prefers-reduced-motion` is honoured through one hook that every
animation reads.

## Later phases

- **Phase 4 (export)** reads the same `present` document. Because
  `sections` carries order and labels, an exporter renders sections in the
  user's chosen order without consulting the UI.
- **Phase 5+**: folders and version history, whose columns already exist as
  nullable placeholders on `resumes`.
- **Phase 6**: visual polish. The UI (`components/resume/*`,
  `components/editor/*`, `components/dashboard/*`) is intentionally plain
  shadcn/Tailwind with no template variation.

## What's explicitly not here (by design, not oversight)

Multiple resume templates, export (PDF/DOCX out), ATS scoring, folders, and
version history. None of the code so far assumes any of these are coming in
a particular shape — the `ResumeDoc` schema, the provider abstraction, the
editor store, and the resume repository are what future phases build on.

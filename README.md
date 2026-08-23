# Resume AI — Phases 1–6

Document in → structured resume JSON out → edited in a live two-pane
editor → saved to your account → exported as PDF, DOCX, Markdown, or
plain text → **scored for ATS-friendliness and matched against a job
description** → styled with seven templates. This is the first six phases of a larger resume-builder
product: a small, correct core, not a finished app.
See [`docs/architecture.md`](docs/architecture.md) for the design rationale
behind the schema, the AI provider abstraction, the editor state model, and
the auth/persistence layer.

## What exists right now

- Upload UI: drag-and-drop or file picker for PDF/DOCX/TXT/MD (multiple
  files, 10MB each), plus a textarea for pasting text directly
- Server-side text extraction for all four formats (`lib/extraction/`)
- A canonical Zod `ResumeDoc` schema (`lib/schema/resume.ts`)
- Provider-agnostic AI extraction into that schema, via the Vercel AI SDK
  (`lib/ai/`) — supports Anthropic, OpenAI, Google, Mistral, and Groq,
  selected by env var
- `POST /api/generate` — the one API route, multipart in, `{ resume,
  warnings }` (or a typed error) out
- Rate limiting on `/api/generate`: per-IP **and** per-authenticated-user
  (Upstash Redis if configured, in-memory fallback otherwise)

### Accounts and saved resumes (Phase 3)

- **Sign in** with email + password or GitHub (Supabase Auth via
  `@supabase/ssr`). All app routes are protected; `/sign-in` is the only
  public page.
- **Save**: an explicit "Save to my account" creates the row for a freshly
  generated draft; after that it autosaves 2s after edits settle. Save
  status (saving / saved / unsaved / error with retry) shows in the top bar,
  and a failed save never touches local edit state.
- **Dashboard** at `/dashboard`: list, open, rename, duplicate, and delete
  your resumes, with an empty state for new accounts.
- **Data isolation**: every query is scoped to the session user's id inside
  the SQL `where` clause. Another user's resume is indistinguishable from
  one that does not exist. Row Level Security is enabled as a backstop.

### Export (Phase 4)

An **Export** control in the editor top bar produces four formats, all
rendered from the same document — so they cannot disagree with each other
or with the preview:

| Format | Notes |
| --- | --- |
| **PDF** | Real selectable text (not an image), paginates automatically, ATS-parseable |
| **DOCX** | Real Word styles, native bullet lists, and hyperlinks — fully editable |
| **Markdown** | `#` headings, `-` bullets, `[text](url)` links |
| **Plain text** | No markup, blank-line separated sections |

Export always uses the **live** document from the editor, so unsaved edits
are included. Generation happens server-side, so the PDF and DOCX libraries
never reach the client bundle.

**PDF character support**: the PDF uses the standard PDF fonts, which cover
Latin-1 and CP1252 — accents, curly quotes, em/en dashes and bullets all
render correctly. Characters outside that range (CJK, emoji, some symbols)
cannot be rendered; where a faithful ASCII equivalent exists it is
substituted, and anything else raises a visible warning in the export menu
rather than being silently corrupted. DOCX, Markdown, and TXT preserve every
character exactly, so use one of those if your resume needs them.

**Vercel/serverless notes**: no extra configuration is required.
`@react-pdf/renderer` is in Next.js's default `serverExternalPackages` list
and is externalized automatically; `docx` is pure JavaScript and bundles
normally. There is no Chromium layer, and a cold PDF render measures
~0.15s. No new environment variables.

### The editor (Phase 2)

- **Two-pane layout**: a form-like editor beside the live, print-like
  preview. Both read the same document, so they cannot drift. Narrow
  screens collapse to one column with an Edit/Preview toggle.
- **Inline editing** of every field — header, summary, and every field of
  every entry. The preview updates on each keystroke.
- **Bullets**: add, delete, and drag-reorder, with Enter to split to a new
  bullet and Backspace on an empty one to remove it.
- **Sections**: rename (built-ins too), delete, drag-reorder the whole
  resume, add a built-in section, or add a custom section with free-form
  entries. Entries can be added, deleted, and reordered within a section.
- **Undo/redo** over the whole sequence, with Cmd/Ctrl+Z and
  Cmd/Ctrl+Shift+Z. A run of keystrokes in one field is a single undo step,
  not one per character.
- **Actionable clarifications**: each question Phase 1's AI raised is
  matched to the entry it is about and shown with an inline field to fill
  the gap directly; dismissing removes it.
- Drag handles are keyboard-operable (focus a handle, Space to lift, arrows
  to move).
- The collapsible raw-JSON view now reflects live edited state.

### Analysis and job matching (Phase 5)

An **Analysis** tab beside the preview, reading the same live document:

- **ATS compatibility, formatting, and readability scores** — every score
  expands to show the individual checks behind it, what was observed, and
  how to fix what failed. No opaque numbers.
- **Findings** for weak openers ("Responsible for…"), passive voice,
  buzzwords, missing quantification, and bullets that are too long or too
  short. Clicking a finding scrolls to and highlights that bullet.
- **AI rewrites** of weak bullets, grounded strictly in what the bullet
  already claims. Accepting one applies as a normal edit — undoable with
  Cmd/Ctrl+Z, visible in the preview, and the score improves on recompute.
- **Job-description matching** — paste a JD to get a coverage percentage
  *with its arithmetic shown*, plus keywords split into matched, "already
  covered under different wording" (so you are never told to add "React"
  when you wrote "React.js"), and genuinely missing, ranked by importance.

Scores are deterministic: the same resume always produces the same numbers,
and they recompute in the browser as you type. Only rewrites and semantic
synonym expansion call a model, and only when you ask.

**Honesty**: nothing here invents experience. Rewrites may restate what a
bullet claims but never add metrics, technologies, or scope; quantification
gaps are flagged but never auto-"fixed" with a made-up number; and terms you
genuinely lack are reported as missing rather than quietly matched. Related
terms that are not equivalent — Terraform vs "infrastructure as code",
Scrum vs Kanban — are deliberately kept distinct.

### Templates, customization, and polish (Phase 6)

Seven templates with genuinely different points of view — they differ by
typeface, spacing rhythm, name treatment, and the device that marks a
section, not just by accent colour:

| Template | Identity |
| --- | --- |
| **Modern** | Clean sans with a bold accent bar. A current default. |
| **Executive** | Formal serif, wide-tracked capitals. Reads senior. |
| **Minimal** | No rules, no colour — space and type do the work. |
| **Corporate** | Banded header, ruled sections, entry dividers. |
| **Technical** | Monospace, dense, section labels in a left gutter. |
| **Startup** | Oversized name, generous accent, punchy hierarchy. |
| **Creative** | Split header with gutter labels. Distinctive, still parseable. |

**Switching templates never changes a word.** Content lives in the document;
appearance lives in the template and its `StyleConfig`. Every template emits
real selectable text in one reading order, and a test renders all seven to
PDF and asserts the headings and content still extract — a beautiful
template an ATS can't read is a failure.

**Customization** (Design tab): typeface, text size, line spacing, section
spacing, page margin, header layout, and accent/text colours. Every control
is bounded so no setting produces a resume that clips in print or can't be
read; colours warn rather than block, including a note when a choice would
vanish in grayscale. Styling is saved with the resume and flows into exports.

**Theme**: light, dark, or follow the system, with no flash on load. The app
chrome changes; the resume itself stays white, because it is a preview of a
printed page.

**Keyboard shortcuts**

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl` + `K` | Command palette — switch template, save, navigate, toggle theme |
| `Cmd/Ctrl` + `Z` | Undo |
| `Cmd/Ctrl` + `Shift` + `Z` | Redo |
| `Space` then arrows | Reorder a section, entry, or bullet from its drag handle |
| `↑ ↓` / `↵` / `Esc` | Navigate, run, and dismiss in the palette |

**Dashboard**: resume cards with a template thumbnail, last-edited time, the
template name, and the Phase 5 ATS score as a badge.

Motion is used sparingly and every animation honours
`prefers-reduced-motion`.

## What does NOT exist yet

Cover-letter and interview generators, folders, and version history. These are later phases — see
[`docs/architecture.md`](docs/architecture.md#later-phases).

## Setup

```bash
npm install
cp .env.example .env.local
```

Then work through the Supabase setup below — from Phase 3 on, the app needs
a Supabase project and a database to run.

> If `npm install` prints warnings about blocked install scripts and
> `lib/generated/prisma` doesn't exist afterward, run `npx prisma generate`
> manually — the Prisma client is generated from `prisma/schema.prisma` and
> isn't checked into the repo.

### 1. Create a Supabase project

At [supabase.com/dashboard](https://supabase.com/dashboard), create a
project, then from **Project Settings → API** copy into `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon` / publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` key (**server-only**;
  never prefix it with `NEXT_PUBLIC_`)

From **Project Settings → Database → Connection string**:

- `DATABASE_URL` — the **Transaction mode** (pooled, port 6543) URI, used by
  the app at runtime. For serverless, append
  `?pgbouncer=true&connection_limit=1`.
- `DIRECT_URL` — the **Session mode** (direct, port 5432) URI. Migrations
  use this; DDL through PgBouncer is unreliable.

### 2. Run migrations

```bash
npx prisma migrate deploy
```

This creates the `users` and `resumes` tables and enables Row Level
Security. Use `npx prisma migrate dev` when changing the schema locally.

### 3. Configure OAuth (GitHub, and optionally Google)

Both providers redirect back to Supabase, which then redirects to the app's
`/auth/callback`. The **callback URL you give the provider is Supabase's**,
not your app's:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

**Google is not enabled**, so the sign-in page does not offer it — a button
that always errors is worse than no button. To add it: create an OAuth 2.0
Client ID (Web application) in [Google Cloud Console](https://console.cloud.google.com),
add the URL above as an Authorized redirect URI, paste the client ID and
secret into Supabase under **Authentication → Providers → Google**, then
re-add the button in `components/auth/sign-in-form.tsx` — `signInWithOAuth`
already accepts `"google"`.

**GitHub** — at **Settings → Developer settings → OAuth Apps → New OAuth
App**, set the Authorization callback URL to the URL above, then paste the
client ID and secret into Supabase under **Authentication → Providers →
GitHub** and enable it.

Finally, under **Authentication → URL Configuration**, set the Site URL
(`http://localhost:3000` for local work) and add your deployed origin plus
`http://localhost:3000/**` to Redirect URLs.

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected
to `/sign-in`.

### Environment variables

See [`.env.example`](.env.example) for the full list with comments. At minimum, to run `/api/generate`:

| Variable | Required | Notes |
| --- | --- | --- |
| `AI_PROVIDER` | Yes | `mistral`, `anthropic`, `openai`, `google`, or `groq` |
| `AI_MODEL` | Yes | Model id for the selected provider |
| `MISTRAL_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `GROQ_API_KEY` | One of these | Matching your `AI_PROVIDER` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Auth; both are public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-only. Not needed by current code paths |
| `DATABASE_URL` | Yes | Pooled connection used at runtime |
| `DIRECT_URL` | For migrations | Direct (session-mode) connection |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | No | Falls back to an in-memory rate limiter if unset |

The app **builds** without any of these (the Prisma client connects lazily,
so CI and Vercel builds don't need database credentials), but signing in and
saving need Supabase and the database at runtime.

**Pick a capable model.** Extraction asks the model to fill a large,
entirely-optional schema in one pass. Weaker models under-extract silently —
returning a structurally valid resume that is quietly missing bullets,
education, or skills, which Zod cannot detect. Measured against
`fixtures/sample-resume.txt`, `mistral-large-latest` scored a perfect 14/14
on three consecutive runs in ~7s (hence the default);
`gemini-3-flash-preview` varied run to run; and Groq's models cannot enforce
this schema at all. Details in
[`docs/architecture.md`](docs/architecture.md#providermodel-choice-is-a-correctness-concern-not-just-a-cost-one).

## Tests

```bash
npm test
```

Vitest unit tests covering:

- **`lib/data/resumes.test.ts` — ownership isolation.** The most important
  tests in the project: one user cannot read, rename, overwrite, duplicate,
  or delete another's resume, and cannot even tell whether it exists. They
  run against an in-memory fake that applies `where` exactly as Postgres
  would, so removing `userId` from a query makes them fail.
- **`lib/store/resume-store.test.ts`** — edit sequences, undo/redo pointer
  behavior, history capping and coalescing, reordering, and schema-validity
  of the resulting document.
- **`lib/resume/clarifications.test.ts`** — clarification resolution.
- **`lib/templates/templates.test.ts`** — the template contract: every one of
  the seven renders exactly the document's sections and entries, in order,
  with nothing added; switching templates does not mutate the document;
  `StyleConfig` round-trips through persistence and clamps out-of-range
  values; and all seven export to PDF with content and headings still
  extractable, plus DOCX carrying the template's theme.
- **`lib/analysis/analysis.test.ts`** — the deterministic analyzers, tested
  against known-good and known-bad input: passive bullets flagged and active
  ones not, `$2M` counted as quantified and prose not, readability ordering
  on known text, JD extraction and matching against a fixture resume and JD
  with a known expected overlap, and reproducibility of every score.
- **`lib/export/export.test.ts`** — every exporter against shared fixtures
  (minimal, full, and a deliberately multi-page resume). PDFs are read back
  with a PDF parser to prove the text is real and extractable; DOCX files
  are opened with a DOCX parser to prove they are valid; Markdown and TXT
  are snapshot-tested. Cross-format tests assert all four contain the same
  entries, honor section reordering, and drop deleted sections.

```bash
npm run test:extraction
```

Runs `lib/extraction`'s `extractText()` against the fixtures in
`fixtures/` (a plain-text resume, a markdown career-notes doc, and a short
pasted-note-style `.txt`) and fails if any of them produce suspiciously
short or empty output.

## Deploying

Deploys to Vercel with no code changes — no filesystem writes at runtime,
no long-running processes. Set the environment variables above in the
Vercel project settings, and remember to:

- use the **pooled** `DATABASE_URL` with
  `?pgbouncer=true&connection_limit=1` for serverless;
- run `npx prisma migrate deploy` against the project (locally with
  `DIRECT_URL` set, or as a build step);
- add your deployment origin to Supabase's **Redirect URLs**, otherwise
  OAuth will bounce users to `/auth/auth-code-error`.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui
· Zod · Vercel AI SDK · Zustand · dnd-kit · Supabase Auth (`@supabase/ssr`)
· Prisma (Supabase Postgres) · React-PDF · docx · Vitest

This project was scaffolded against **Next.js 16**, which has real
breaking changes vs. earlier versions (see `AGENTS.md`). If something here
looks like it contradicts common Next.js knowledge, check
`node_modules/next/dist/docs/` (bundled with this exact installed
version) before assuming it's a mistake.

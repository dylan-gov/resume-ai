-- Phase 6: per-resume presentation (template choice + StyleConfig).
--
-- Nullable on purpose: every resume created before templates existed keeps
-- working and simply renders with the default style, which `resolveStyle`
-- supplies. No backfill is needed.

ALTER TABLE "resumes" ADD COLUMN "style" JSONB;

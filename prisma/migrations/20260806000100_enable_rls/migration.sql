-- Defense in depth.
--
-- These tables live in the `public` schema, which Supabase exposes over
-- PostgREST using the anon key that ships to the browser. Without RLS,
-- anyone holding that public key could read every row directly, bypassing
-- the application entirely.
--
-- Enabling RLS with no permissive policies denies all access to the `anon`
-- and `authenticated` roles. The app needs no policy: Prisma connects over
-- DATABASE_URL as the table owner, and ENABLE (unlike FORCE) does not apply
-- RLS to the owner. Do NOT add FORCE ROW LEVEL SECURITY here — with no
-- policies defined it would lock the application out of its own tables.
--
-- Ownership is still enforced in the data-access layer
-- (lib/data/resumes.ts). RLS is the backstop, not the primary control.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resumes" ENABLE ROW LEVEL SECURITY;

-- Drop the default PostgREST-exposed grants as well, so the tables are not
-- reachable with the public anon key even if a policy is added later.
REVOKE ALL ON TABLE "users" FROM anon, authenticated;
REVOKE ALL ON TABLE "resumes" FROM anon, authenticated;

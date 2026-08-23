import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client, bound to the request's cookie jar.
 *
 * Create a new one per request — never share across requests, or one user's
 * session can leak into another's render.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. The proxy refreshes the
            // session on navigation, so ignoring this is safe.
          }
        },
      },
    }
  );
}

/**
 * The authenticated user id, or null.
 *
 * Always uses `getUser()`, which revalidates the token with Supabase, rather
 * than `getSession()`, whose cookie payload is client-modifiable and must
 * never be trusted for authorization.
 */
export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface SessionUser {
  id: string;
  email: string;
}

/** The authenticated user's id and email, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

/** Throws if unauthenticated. Use in server actions before touching data. */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** Throws if unauthenticated. Use where the email is needed too (user sync). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

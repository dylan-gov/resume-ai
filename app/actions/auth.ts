"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { ok: true } | { ok: false; error: string };

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Supabase's message is safe to show (it is deliberately non-specific about
  // whether the account exists).
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Starts an OAuth flow and returns the provider URL for the browser to follow. */
export async function signInWithOAuth(
  provider: "google" | "github",
  next?: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback },
  });

  if (error || !data.url) return { ok: false, error: error?.message ?? "Could not start sign-in." };
  return { ok: true, url: data.url };
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}

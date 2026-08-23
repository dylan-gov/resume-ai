"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithOAuth, signInWithPassword, signUpWithPassword } from "@/app/actions/auth";

type Mode = "sign-in" | "sign-up";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result =
        mode === "sign-in"
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "sign-up") {
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("sign-in");
        return;
      }
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    });
  }

  function handleOAuth(provider: "google" | "github") {
    setError(null);
    startTransition(async () => {
      const result = await signInWithOAuth(provider, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The provider consent screen lives on their domain, so a full
      // navigation is required here — router.push cannot leave the app.
      window.location.href = result.url;
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      {/*
        Only providers actually enabled on the Supabase project are offered.
        Google is not configured, and showing a button that always errors is
        worse than not showing it. `signInWithOAuth` still accepts "google",
        so re-enabling it is one button here once credentials are added.
      */}
      <Button variant="outline" disabled={pending} onClick={() => handleOAuth("github")}>
        Continue with GitHub
      </Button>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(null);
          setMessage(null);
        }}
      >
        {mode === "sign-in"
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}

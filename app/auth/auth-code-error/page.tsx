import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign-in problem · Resume AI" };

export default function AuthCodeErrorPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">We couldn&apos;t finish signing you in</h1>
        <p className="text-sm text-muted-foreground">
          The sign-in link may have expired or already been used. Please try again.
        </p>
        <Button render={<Link href="/sign-in" />}>Back to sign in</Button>
      </div>
    </div>
  );
}

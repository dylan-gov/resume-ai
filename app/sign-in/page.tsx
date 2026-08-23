import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in · Resume AI" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-semibold">Resume AI</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to generate, edit, and save your resumes.
          </p>
        </header>
        <SignInForm next={next} />
      </div>
    </div>
  );
}

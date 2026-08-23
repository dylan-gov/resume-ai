/**
 * Keeps the application `users` row in step with Supabase Auth.
 *
 * Supabase owns identity; this table exists only so resumes have a foreign
 * key to hang off and the dashboard has an email to show. No credentials are
 * ever stored here.
 */
export interface UserDb {
  user: {
    upsert(args: {
      where: { id: string };
      create: { id: string; email: string };
      update: { email: string };
    }): Promise<{ id: string }>;
  };
}

export async function ensureUser(
  db: UserDb,
  user: { id: string; email: string }
): Promise<void> {
  await db.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email },
    update: { email: user.email },
  });
}

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 renamed Middleware to Proxy; the file must be `proxy.ts` at the
 * project root. Supabase's docs still say `middleware.ts` — that filename is
 * inert here and would silently disable session refresh.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Auth checks must
     * still be repeated server-side in actions — proxy gating is a
     * redirect convenience, not the authorization boundary.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

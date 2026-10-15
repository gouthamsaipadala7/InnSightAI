import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from "@/lib/auth";

/**
 * Reads and verifies the session cookie for the current request. Use in
 * Server Components and Route Handlers. Returns `null` if there's no
 * session or it's invalid/expired — never throws for "not logged in".
 *
 * Note: middleware (src/middleware.ts) already blocks unauthenticated
 * access to protected routes before this ever runs. This function verifies
 * independently anyway (defense in depth) rather than trusting a header —
 * a route handler should never assume middleware definitely ran.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * For use at the top of a Route Handler that requires a specific role.
 * Returns the session on success. Throws a lightweight error object (not a
 * generic Error) that route handlers can catch and turn into a 401/403 —
 * see the pattern in src/app/api/me/route.ts.
 */
export class AuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError(401, "Not logged in.");
  }
  return session;
}

export async function requireRole(
  role: SessionPayload["role"]
): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) {
    throw new AuthError(403, `This action requires the ${role} role.`);
  }
  return session;
}
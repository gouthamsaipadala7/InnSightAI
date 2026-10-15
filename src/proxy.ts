import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth";

/**
 * Route protection, enforced before a request ever reaches a page or API
 * handler.
 *
 * - `/onboarding/**`         → requires any valid session (either role)
 * - `/dashboard/manager/**`  → requires a valid session with role "manager"
 * - `/dashboard/reception/**` → requires any valid session (manager can
 *   view receptionist pages too, e.g. MD Dashboard's shortcuts into
 *   Analysis/Revenue — receptionist still can't reach /dashboard/manager)
 * - `/settings/**`           → requires a valid session with role "manager"
 * - `/api/**` (except /api/auth/* and /api/health) → requires any valid session
 */

const MANAGER_ONLY_PAGE_PREFIXES = ["/dashboard/manager", "/settings"];
const ANY_SESSION_PAGE_PREFIXES = ["/onboarding", "/dashboard/reception"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  const isApiRoute = pathname.startsWith("/api");
  const isProtectedPageRoute = [
    ...MANAGER_ONLY_PAGE_PREFIXES,
    ...ANY_SESSION_PAGE_PREFIXES,
  ].some((prefix) => pathname.startsWith(prefix));

  if (!session) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }
    if (isProtectedPageRoute) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (
    MANAGER_ONLY_PAGE_PREFIXES.some((p) => pathname.startsWith(p)) &&
    session.role !== "manager"
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/settings/:path*",
    "/api/((?!auth|health).*)",
  ],
};
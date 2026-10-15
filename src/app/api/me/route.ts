import { NextResponse } from "next/server";

import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

/**
 * Protected sanity-check endpoint — not a real feature. Confirms, end to
 * end, that: the session cookie is being read and verified, middleware let
 * the request through, and tenant-scoped queries only ever see this
 * employee's own hotel. Useful for testing Phase 3 before any dashboard
 * page exists to log into.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const db = tenantScopedPrisma(session.hotelId);

    // No `where: { hotelId }` written here — the extension adds it. Proof:
    // this always returns exactly this employee's own hotel's counts, never
    // another tenant's, no matter what.
    const [roomCount, employeeCount, bookingCount] = await Promise.all([
      db.room.count(),
      db.employee.count(),
      db.booking.count(),
    ]);

    return NextResponse.json({
      session,
      tenantCounts: { roomCount, employeeCount, bookingCount },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
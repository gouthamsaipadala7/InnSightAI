import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  try {
    // "Today" in IST, expressed as UTC instants.
    const nowIst = new Date(Date.now() + IST_OFFSET_MS);
    const istMidnightUtc = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST_OFFSET_MS;
    const start = new Date(istMidnightUtc);
    const end = new Date(istMidnightUtc + 24 * 60 * 60 * 1000);

    const db = tenantScopedPrisma(session.hotelId);

    const bookingsToday = await db.booking.count({
      where: { checkinTime: { gte: start, lt: end } },
    });

    const revenueAgg = await db.revenueLog.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
    });

    return NextResponse.json({
      bookingsToday,
      revenueToday: Number(revenueAgg._sum.amount ?? 0),
    });
  } catch (error) {
    console.error("[/api/dashboard/summary]", error);
    return NextResponse.json({ error: "Failed to load summary." }, { status: 500 });
  }
}
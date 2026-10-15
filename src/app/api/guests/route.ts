import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export async function GET() {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const db = tenantScopedPrisma(session.hotelId);

  const [customers, bookings] = await Promise.all([
    db.customer.findMany({ select: { id: true, name: true, phone: true } }),
    db.booking.findMany({
      select: { customerId: true, checkinTime: true, status: true },
      orderBy: { checkinTime: "desc" },
    }),
  ]);

  const latestByCustomer = new Map<string, { checkinTime: Date; status: string }>();
  const stayCounts = new Map<string, number>();
  for (const b of bookings) {
    stayCounts.set(b.customerId, (stayCounts.get(b.customerId) ?? 0) + 1);
    if (!latestByCustomer.has(b.customerId)) {
      latestByCustomer.set(b.customerId, { checkinTime: b.checkinTime, status: b.status });
    }
  }

  return NextResponse.json({
    guests: customers.map((c) => {
      const latest = latestByCustomer.get(c.id);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalStays: stayCounts.get(c.id) ?? 0,
        lastCheckin: latest?.checkinTime ?? null,
        lastStatus: latest?.status ?? null,
      };
    }),
  });
}
import { NextResponse } from "next/server";

import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const db = tenantScopedPrisma(session.hotelId);
  const rows = await db.booking.findMany({
    where: { status: "reserved" },
    include: { customer: true, room: true },
    orderBy: { checkinTime: "asc" },
    take: 200,
  });
  return NextResponse.json({
    reservations: rows.map((b) => ({
      id: b.id,
      customerName: b.customer.name,
      phone: b.customer.phone,
      roomNumber: b.room.roomNumber,
      checkinTime: b.checkinTime,
      checkoutTime: b.checkoutTime,
    })),
  });
}
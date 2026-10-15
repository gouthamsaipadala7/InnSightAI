import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export async function GET() {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const db = tenantScopedPrisma(session.hotelId);
  const bookings = await db.booking.findMany({
    include: { customer: true, room: { include: { roomType: true } } },
    orderBy: { checkinTime: "desc" },
    take: 300,
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      customerName: b.customer.name,
      phone: b.customer.phone,
      roomNumber: b.room.roomNumber,
      roomType: b.room.roomType.name,
      checkinTime: b.checkinTime,
      checkoutTime: b.checkoutTime,
      initialPayment: Number(b.initialPayment),
      totalAmount: b.totalAmount ? Number(b.totalAmount) : null,
      status: b.status,
    })),
  });
}
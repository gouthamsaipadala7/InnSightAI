import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/session";

export async function GET(request: Request) {
  let session;
  try { session = await requireRole("manager"); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(Date.now() - 30 * 86400000);
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
  to.setUTCHours(23, 59, 59, 999);

  const hotelId = session.hotelId;

  const [revenueLogs, bookings] = await Promise.all([
    prisma.revenueLog.findMany({ where: { hotelId, date: { gte: from, lte: to } } }),
    prisma.booking.findMany({
      where: { hotelId, checkinTime: { gte: from, lte: to } },
      select: { checkinTime: true, customerId: true, room: { select: { roomType: { select: { name: true } } } } },
    }),
  ]);

  const totalRevenue = revenueLogs.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalBookings = bookings.length;
  const uniqueGuests = new Set(bookings.map((b) => b.customerId)).size;
  const avgRevenuePerGuest = uniqueGuests > 0 ? totalRevenue / uniqueGuests : 0;

  const roomTypeCounts = new Map<string, number>();
  for (const b of bookings) {
    const name = b.room.roomType.name;
    roomTypeCounts.set(name, (roomTypeCounts.get(name) ?? 0) + 1);
  }
  const roomTypeDistribution = Array.from(roomTypeCounts.entries()).map(([name, value]) => ({ name, value }));

  const momentumMap = new Map<string, number>();
  for (const b of bookings) {
    const key = b.checkinTime.toISOString().slice(0, 10);
    momentumMap.set(key, (momentumMap.get(key) ?? 0) + 1);
  }
  const momentum = Array.from(momentumMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bookings]) => ({
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      bookings,
    }));

  return NextResponse.json({ totalRevenue, totalBookings, avgRevenuePerGuest, roomTypeDistribution, momentum });
}
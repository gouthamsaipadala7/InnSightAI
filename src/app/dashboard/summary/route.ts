import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";

export async function GET() {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(); end.setUTCHours(23, 59, 59, 999);

  const [bookingsToday, revenueToday] = await Promise.all([
    prisma.booking.count({ where: { hotelId: session.hotelId, checkinTime: { gte: start, lte: end } } }),
    prisma.revenueLog.aggregate({
      where: { hotelId: session.hotelId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    bookingsToday,
    revenueToday: Number(revenueToday._sum.amount ?? 0),
  });
}
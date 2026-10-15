import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { id } = await params;
  if (id !== session.hotelId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const DAYS = 14;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (DAYS - 1));

  const bookings = await prisma.booking.findMany({
    where: { hotelId: session.hotelId, checkinTime: { gte: start } },
    select: { checkinTime: true },
  });

  const countsByDate = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    countsByDate.set(d.toISOString().slice(0, 10), 0);
  }

  for (const b of bookings) {
    const key = b.checkinTime.toISOString().slice(0, 10);
    if (countsByDate.has(key)) {
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }
  }

  const data = Array.from(countsByDate.entries()).map(([dateKey, bookings]) => ({
    label: new Date(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    bookings,
  }));

  return NextResponse.json(data);
}
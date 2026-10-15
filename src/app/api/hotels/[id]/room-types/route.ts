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

  const bookings = await prisma.booking.findMany({
    where: { hotelId: session.hotelId },
    select: { room: { select: { roomType: { select: { name: true } } } } },
  });

  const counts = new Map<string, number>();
  for (const b of bookings) {
    const name = b.room.roomType.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const data = Array.from(counts.entries()).map(([name, value]) => ({ name, value }));

  return NextResponse.json(data);
}
import { NextResponse } from "next/server";

import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const db = tenantScopedPrisma(session.hotelId);
  const [rooms, roomTypes] = await Promise.all([
    db.room.findMany({ include: { roomType: true } }),
    db.roomType.findMany(),
  ]);

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      status: r.status,
      roomTypeId: r.roomTypeId,
      roomTypeName: r.roomType.name,
    })),
    roomTypes: roomTypes.map((rt) => ({
      id: rt.id,
      name: rt.name,
      basePrice: Number(rt.basePrice),
    })),
  });
}
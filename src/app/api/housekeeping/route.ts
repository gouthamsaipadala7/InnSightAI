import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export async function GET() {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const db = tenantScopedPrisma(session.hotelId);
  const [rooms, hkRecords] = await Promise.all([
    db.room.findMany({ select: { id: true, roomNumber: true, status: true } }),
    db.housekeeping.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const latestByRoom = new Map<string, (typeof hkRecords)[number]>();
  for (const hk of hkRecords) {
    if (!latestByRoom.has(hk.roomId)) latestByRoom.set(hk.roomId, hk);
  }

  const cards = rooms.map((room) => {
    const hk = latestByRoom.get(room.id);
    let board: "dirty" | "in_progress" | "completed" | "available";
    if (room.status === "dirty") board = "dirty";
    else if (room.status === "cleaning") board = "in_progress";
    else if (hk && hk.status === "completed") board = "completed";
    else board = "available";

    return {
      id: hk?.id ?? room.id,
      roomId: room.id,
      roomNumber: room.roomNumber,
      assignedStaff: hk?.assignedStaff ?? null,
      board,
      markedDirtyAt: hk?.markedDirtyAt ?? null,
      completedAt: hk?.completedAt ?? null,
    };
  });

  return NextResponse.json({ cards });
}
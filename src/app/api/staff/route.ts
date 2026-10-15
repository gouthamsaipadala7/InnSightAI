import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export async function GET() {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const db = tenantScopedPrisma(session.hotelId);
  const staff = await db.staff.findMany({ include: { assignedRoom: true } });

  return NextResponse.json({
    available: staff.filter((s) => s.status === "available").map((s) => ({ id: s.id, name: s.name })),
    assigned: staff
      .filter((s) => s.status === "assigned")
      .map((s) => ({ id: s.id, name: s.name, roomNumber: s.assignedRoom?.roomNumber ?? "—" })),
  });
}
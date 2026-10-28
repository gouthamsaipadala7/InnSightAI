import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";

const assignSchema = z.object({ staffId: z.string().uuid("Invalid staff selection.") });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsedBody = assignSchema.safeParse(body);
  if (!parsedBody.success) return NextResponse.json({ error: "Staff selection is required." }, { status: 400 });
  const staffId = parsedBody.data.staffId;

  const record = await prisma.housekeeping.findFirst({ where: { id, hotelId: session.hotelId } });
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (record.status !== "dirty") return NextResponse.json({ error: "This room isn't awaiting assignment." }, { status: 400 });

  const staff = await prisma.staff.findFirst({ where: { id: staffId, hotelId: session.hotelId, status: "available" } });
  if (!staff) return NextResponse.json({ error: "That staff member isn't available." }, { status: 400 });

  await prisma.$transaction([
    prisma.staff.update({ where: { id: staff.id }, data: { status: "assigned", assignedRoomId: record.roomId } }),
    prisma.housekeeping.update({
      where: { id: record.id },
      data: { assignedStaff: staff.name, staffId: staff.id, status: "in_progress", cleaningStartedAt: new Date() },
    }),
    prisma.room.update({ where: { id: record.roomId }, data: { status: "cleaning" } }),
  ]);

  return NextResponse.json({ success: true, staffName: staff.name });
}
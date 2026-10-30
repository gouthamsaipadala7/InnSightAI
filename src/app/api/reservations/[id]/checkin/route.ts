import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;

  try {
    const roomNumber = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.findFirst({
        where: { id, hotelId: session.hotelId, status: "reserved" },
        include: { room: true },
      });
      if (!b) throw new Error("Reservation not found or not in reserved state.");
      if (b.room.status !== "available") {
        throw new Error(`Room ${b.room.roomNumber} is not ready (currently ${b.room.status}).`);
      }
      const now = new Date();
      if (b.checkinTime.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
        throw new Error("Too early: check-in is more than a day before the reserved date.");
      }
      // Keep the reserved checkout date; stay starts now.
      await tx.booking.update({
        where: { id: b.id },
        data: { status: "active", checkinTime: now < b.checkinTime ? now : b.checkinTime },
      });
      await tx.room.update({ where: { id: b.roomId }, data: { status: "occupied" } });
      const day = new Date(now);
      day.setUTCHours(0, 0, 0, 0);
      await tx.dailyBookingCount.upsert({
        where: { hotelId_date: { hotelId: session.hotelId, date: day } },
        create: { hotelId: session.hotelId, date: day, count: 1 },
        update: { count: { increment: 1 } },
      });
      return b.room.roomNumber;
    });
    await audit(session.hotelId, session.employeeId, "reservation_checkin", { bookingId: id });
    return NextResponse.json({ success: true, roomNumber });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("no_room_overlap") || raw.includes("23P01")) {
      return NextResponse.json({ error: "Room already booked for this period." }, { status: 409 });
    }
    return NextResponse.json({ error: raw || "Check-in failed." }, { status: 400 });
  }
}
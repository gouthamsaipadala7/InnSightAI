import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";

/**
 * Check-in a guest: creates a Customer + active Booking, flips the room to
 * "occupied". All writes happen with an explicit hotelId (from the
 * session), inside one transaction — not via tenantScopedPrisma here,
 * since Prisma's interactive $transaction callback gives a plain
 * (non-extended) client, so the auto-scoping extension wouldn't actually
 * apply inside it. Explicit hotelId is simpler and correct.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  const initialPayment = Number(body.initialPayment);
  const checkinTime = body.checkinTime ? new Date(body.checkinTime) : new Date();

  const errors: string[] = [];
  if (!customerName) errors.push("Customer name is required.");
  if (!phone) errors.push("Phone number is required.");
  if (!roomId) errors.push("Room selection is required.");
  if (!Number.isFinite(initialPayment) || initialPayment < 0) {
    errors.push("Initial payment must be a non-negative number.");
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", details: errors }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: { id: roomId, hotelId: session.hotelId },
      });
      if (!room) throw new Error("Room not found for this hotel.");
      if (room.status !== "available") {
        throw new Error(`Room ${room.roomNumber} is no longer available (currently ${room.status}).`);
      }

      const customer = await tx.customer.create({
        data: { hotelId: session.hotelId, name: customerName, phone },
      });

      const booking = await tx.booking.create({
        data: {
          hotelId: session.hotelId,
          customerId: customer.id,
          roomId: room.id,
          checkinTime,
          initialPayment,
          status: "active",
        },
      });

      await tx.room.update({ where: { id: room.id }, data: { status: "occupied" } });
            const today = new Date(checkinTime);
      today.setUTCHours(0, 0, 0, 0);
      await tx.dailyBookingCount.upsert({
        where: { hotelId_date: { hotelId: session.hotelId, date: today } },
        create: { hotelId: session.hotelId, date: today, count: 1 },
        update: { count: { increment: 1 } },
      });

      return { booking, room };
    });

    return NextResponse.json({
      success: true,
      bookingId: result.booking.id,
      roomNumber: result.room.roomNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
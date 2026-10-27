import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";

const checkinSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required.").max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number."),
  roomId: z.string().uuid("Invalid room."),
  initialPayment: z.coerce.number().min(0, "Payment must be 0 or more.").max(10_000_000),
  checkinTime: z.coerce.date().optional(),
});

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

  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const { customerName, phone, roomId, initialPayment } = parsed.data;
  const checkinTime = parsed.data.checkinTime ?? new Date();

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
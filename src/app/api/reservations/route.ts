import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";
import { istNoonUtc } from "@/lib/dates";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const schema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required.").max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number."),
  roomId: z.string().uuid("Invalid room."),
  from: z.string().regex(dateRe, "from must be YYYY-MM-DD"),
  to: z.string().regex(dateRe, "to must be YYYY-MM-DD"),
  initialPayment: z.coerce.number().min(0).max(10_000_000).default(0),
});

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const { customerName, phone, roomId, initialPayment } = parsed.data;
  const checkin = istNoonUtc(parsed.data.from);
  const checkout = istNoonUtc(parsed.data.to);
  if (checkout <= checkin) {
    return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
  }
  if (checkin.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Check-in date is in the past." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({ where: { id: roomId, hotelId: session.hotelId } });
      if (!room) throw new Error("Room not found for this hotel.");

      const customer = await tx.customer.create({
        data: { hotelId: session.hotelId, name: customerName, phone },
      });
      const booking = await tx.booking.create({
        data: {
          hotelId: session.hotelId,
          customerId: customer.id,
          roomId: room.id,
          checkinTime: checkin,
          checkoutTime: checkout,
          initialPayment,
          status: "reserved",
        },
      });
      return { booking, room };
    });

    return NextResponse.json({
      success: true,
      reservationId: result.booking.id,
      roomNumber: result.room.roomNumber,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("no_room_overlap") || raw.includes("23P01")) {
      return NextResponse.json({ error: "Room already booked for this period." }, { status: 409 });
    }
    return NextResponse.json({ error: raw || "Reservation failed." }, { status: 400 });
  }
}
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id, hotelId: session.hotelId },
        include: { room: { include: { roomType: true } } },
      });
      if (!booking) throw new Error("Booking not found for this hotel.");
      if (booking.status !== "active") throw new Error("This booking is already checked out.");

      const checkoutTime = new Date();
      const nights = Math.max(
        1,
        Math.ceil((checkoutTime.getTime() - booking.checkinTime.getTime()) / (1000 * 60 * 60 * 24))
      );
      const totalAmount = Number(booking.room.roomType.basePrice) * nights;

      await tx.booking.update({
        where: { id: booking.id },
        data: { checkoutTime, totalAmount, status: "checked_out" },
      });

      await tx.revenueLog.create({
        data: {
          hotelId: session.hotelId,
          bookingId: booking.id,
          amount: totalAmount,
          date: checkoutTime,
        },
      });

      await tx.room.update({ where: { id: booking.roomId }, data: { status: "dirty" } });

      await tx.housekeeping.create({
        data: {
          hotelId: session.hotelId,
          roomId: booking.roomId,
          status: "dirty",
          markedDirtyAt: checkoutTime,
        },
      });

      return { totalAmount, roomNumber: booking.room.roomNumber };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/session";
import { nextCustomPrefix, buildSequentialRoomNumbers } from "@/lib/hotel-rooms";

const settingsSchema = z.object({
  hotelName: z.string().trim().min(1, "Hotel name is required.").max(120),
  contactNumber: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid contact number."),
  email: z.string().trim().email("A valid email is required.").max(150),
  address: z.string().trim().min(1, "Address is required.").max(300),
  existingRoomTypes: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        count: z.coerce.number().int().min(1).max(500),
        basePrice: z.coerce.number().positive().max(1_000_000),
      })
    )
    .max(20)
    .default([]),
  newRoomTypes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        count: z.coerce.number().int().min(1).max(500),
        basePrice: z.coerce.number().positive().max(1_000_000),
      })
    )
    .max(20)
    .default([]),
});

export async function PATCH(request: Request) {
  let session;
  try {
    session = await requireRole("manager");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    const summary = await prisma.$transaction(async (tx) => {
      await tx.hotel.update({
        where: { id: session.hotelId },
        data: {
          name: data.hotelName,
          contactNumber: data.contactNumber,
          email: data.email,
          address: data.address,
        },
      });

      for (const rt of data.existingRoomTypes) {
        const current = await tx.roomType.findFirst({
          where: { id: rt.id, hotelId: session.hotelId },
        });
        if (!current) {
          throw new Error(`Room type not found for this hotel: ${rt.id}`);
        }

        if (rt.count > current.count) {
          const diff = rt.count - current.count;
          const existingRooms = await tx.room.findMany({
            where: { roomTypeId: current.id },
            select: { roomNumber: true },
          });
          const currentMax = existingRooms.length
            ? Math.max(...existingRooms.map((r) => parseInt(r.roomNumber, 10) || 0))
            : 0;
          const newNumbers = buildSequentialRoomNumbers(0, currentMax, diff);

          await tx.room.createMany({
            data: newNumbers.map((roomNumber) => ({
              hotelId: session.hotelId,
              roomNumber,
              roomTypeId: current.id,
              status: "available" as const,
            })),
          });
        } else if (rt.count < current.count) {
          const diff = current.count - rt.count;
          const candidates = await tx.room.findMany({
            where: {
              roomTypeId: current.id,
              status: "available",
              bookings: { none: {} },
            },
            select: { id: true, roomNumber: true },
          });
          candidates.sort(
            (a, b) => (parseInt(b.roomNumber, 10) || 0) - (parseInt(a.roomNumber, 10) || 0)
          );

          if (candidates.length < diff) {
            throw new Error(
              `Cannot reduce "${current.name}" to ${rt.count} rooms: only ${candidates.length} room(s) are available to remove (rooms with booking history or that are currently occupied/dirty are never removed), but ${diff} would need to be removed.`
            );
          }

          const toRemove = candidates.slice(0, diff);
          await tx.room.deleteMany({
            where: { id: { in: toRemove.map((r) => r.id) } },
          });
        }

        await tx.roomType.update({
          where: { id: current.id },
          data: { name: rt.name, count: rt.count, basePrice: rt.basePrice },
        });
      }

      const existingCustomCount = await tx.roomType.count({
        where: { hotelId: session.hotelId, category: "custom" },
      });

      let customOffset = existingCustomCount;
      for (const rt of data.newRoomTypes) {
        const roomType = await tx.roomType.create({
          data: {
            hotelId: session.hotelId,
            category: "custom",
            name: rt.name,
            count: rt.count,
            basePrice: rt.basePrice,
          },
        });

        const prefix = nextCustomPrefix(customOffset++);
        const roomNumbers = buildSequentialRoomNumbers(prefix, 0, rt.count);

        await tx.room.createMany({
          data: roomNumbers.map((roomNumber) => ({
            hotelId: session.hotelId,
            roomNumber,
            roomTypeId: roomType.id,
            status: "available" as const,
          })),
        });
      }

      const allRoomTypes = await tx.roomType.findMany({
        where: { hotelId: session.hotelId },
      });
      const totalRooms = allRoomTypes.reduce((sum, r) => sum + r.count, 0);

      await tx.hotel.update({
        where: { id: session.hotelId },
        data: { totalRooms },
      });

      return { totalRooms, roomTypeCount: allRoomTypes.length };
    });

      await audit(session.hotelId, session.employeeId, "hotel_settings_updated", {
      totalRooms: summary.totalRooms,
    });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
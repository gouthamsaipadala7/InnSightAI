import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/session";
import { nextCustomPrefix, buildSequentialRoomNumbers } from "@/lib/hotel-rooms";

interface ExistingRoomTypeInput {
  id: string;
  name: string;
  count: number;
  basePrice: number;
}

interface NewRoomTypeInput {
  name: string;
  count: number;
  basePrice: number;
}

interface SettingsBody {
  hotelName?: unknown;
  contactNumber?: unknown;
  email?: unknown;
  address?: unknown;
  existingRoomTypes?: unknown;
  newRoomTypes?: unknown;
}

function validate(body: SettingsBody) {
  const errors: string[] = [];

  const hotelName = typeof body.hotelName === "string" ? body.hotelName.trim() : "";
  if (!hotelName) errors.push("Hotel name is required.");

  const contactNumber = typeof body.contactNumber === "string" ? body.contactNumber.trim() : "";
  if (!contactNumber) errors.push("Contact number is required.");

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) errors.push("A valid email is required.");

  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!address) errors.push("Address is required.");

  const existingRoomTypes: ExistingRoomTypeInput[] = [];
  (Array.isArray(body.existingRoomTypes) ? body.existingRoomTypes : []).forEach(
    (rt: unknown, i: number) => {
      const r = rt as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const count = Number(r.count);
      const basePrice = Number(r.basePrice);
      if (!id || !name || !Number.isInteger(count) || count < 1 || !Number.isFinite(basePrice) || basePrice <= 0) {
        errors.push(`Room type #${i + 1}: invalid values.`);
        return;
      }
      existingRoomTypes.push({ id, name, count, basePrice });
    }
  );

  const newRoomTypes: NewRoomTypeInput[] = [];
  (Array.isArray(body.newRoomTypes) ? body.newRoomTypes : []).forEach((rt: unknown, i: number) => {
    const r = rt as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const count = Number(r.count);
    const basePrice = Number(r.basePrice);
    if (!name || !Number.isInteger(count) || count < 1 || !Number.isFinite(basePrice) || basePrice <= 0) {
      errors.push(`New room type #${i + 1}: invalid values.`);
      return;
    }
    newRoomTypes.push({ name, count, basePrice });
  });

  if (errors.length > 0) return { errors };
  return { errors: [], data: { hotelName, contactNumber, email, address, existingRoomTypes, newRoomTypes } };
}

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

  let body: SettingsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { errors, data } = validate(body);
  if (!data) {
    return NextResponse.json({ error: "Validation failed.", details: errors }, { status: 400 });
  }

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

      // --- Existing room types: update name/price, grow or shrink count ---
      for (const rt of data.existingRoomTypes) {
        // Tenant-safety: only ever touch a room type that belongs to THIS
        // hotel, even though `requireRole` already confirmed the session.
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

      // --- Brand new room types (always treated as "custom" — see note in
      // hotel-rooms.ts on why settings doesn't offer standard/deluxe/suite
      // here: avoids two room types colliding on the same numbering block).
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

      // Recompute totalRooms from the ground truth (all room types' counts)
      // rather than trying to track a running delta — simpler and can't drift.
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

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
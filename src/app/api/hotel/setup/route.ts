import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";
import {
  FIXED_CATEGORY_PREFIX,
  buildSequentialRoomNumbers,
  nextCustomPrefix,
} from "@/lib/hotel-rooms";

interface RoomTypeInput {
  category: "standard" | "deluxe" | "suite" | "custom";
  name: string;
  count: number;
  basePrice: number;
}

interface SetupBody {
  hotelName?: unknown;
  employeesCount?: unknown;
  contactNumber?: unknown;
  email?: unknown;
  address?: unknown;
  roomTypes?: unknown;
}

const VALID_CATEGORIES = new Set(["standard", "deluxe", "suite", "custom"]);

function validate(body: SetupBody): { errors: string[]; data?: {
  hotelName: string;
  employeesCount: number;
  contactNumber: string;
  email: string;
  address: string;
  roomTypes: RoomTypeInput[];
} } {
  const errors: string[] = [];

  const hotelName = typeof body.hotelName === "string" ? body.hotelName.trim() : "";
  if (!hotelName) errors.push("Hotel name is required.");

  const employeesCount = Number(body.employeesCount);
  if (!Number.isInteger(employeesCount) || employeesCount < 1) {
    errors.push("Number of employees must be a positive whole number.");
  }

  const contactNumber = typeof body.contactNumber === "string" ? body.contactNumber.trim() : "";
  if (!contactNumber) errors.push("Contact number is required.");

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) errors.push("A valid email is required.");

  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!address) errors.push("Address is required.");

  const rawRoomTypes = Array.isArray(body.roomTypes) ? body.roomTypes : [];
  if (rawRoomTypes.length === 0) {
    errors.push("At least one room type is required.");
  }

  const roomTypes: RoomTypeInput[] = [];
  rawRoomTypes.forEach((rt: unknown, i: number) => {
    const r = rt as Record<string, unknown>;
    const category = typeof r.category === "string" ? r.category : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const count = Number(r.count);
    const basePrice = Number(r.basePrice);

    if (!VALID_CATEGORIES.has(category)) {
      errors.push(`Room type #${i + 1}: invalid category.`);
      return;
    }
    if (!name) {
      errors.push(`Room type #${i + 1}: name is required.`);
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      errors.push(`Room type #${i + 1} (${name}): count must be a positive whole number.`);
      return;
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      errors.push(`Room type #${i + 1} (${name}): base price must be a positive number.`);
      return;
    }

    roomTypes.push({ category: category as RoomTypeInput["category"], name, count, basePrice });
  });

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    data: { hotelName, employeesCount, contactNumber, email, address, roomTypes },
  };
}

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

  let body: SetupBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { errors, data } = validate(body);
  if (!data) {
    return NextResponse.json({ error: "Validation failed.", details: errors }, { status: 400 });
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: session.hotelId } });
  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
  }
  if (hotel.setupCompleted) {
    return NextResponse.json(
      { error: "This hotel has already completed setup." },
      { status: 409 }
    );
  }

  const totalRooms = data.roomTypes.reduce((sum, rt) => sum + rt.count, 0);

  // customIndex tracks how many *custom* categories we've assigned a prefix
  // to within this single submission — the hotel has no existing custom
  // types yet (this is its first-ever setup), so we don't need to query the
  // DB for a starting offset the way Hotel Settings will later.
  let customIndex = 0;

  const result = await prisma.$transaction(async (tx) => {
    await tx.hotel.update({
      where: { id: hotel.id },
      data: {
        name: data.hotelName,
        contactNumber: data.contactNumber,
        email: data.email,
        address: data.address,
        totalRooms,
        employeesCount: data.employeesCount,
        setupCompleted: true,
      },
    });

    const createdRoomTypes = [];
    for (const rt of data.roomTypes) {
      const roomType = await tx.roomType.create({
        data: {
          hotelId: hotel.id,
          category: rt.category,
          name: rt.name,
          count: rt.count,
          basePrice: rt.basePrice,
        },
      });

      const prefix =
        rt.category === "custom"
          ? nextCustomPrefix(customIndex++)
          : FIXED_CATEGORY_PREFIX[rt.category];

      const roomNumbers = buildSequentialRoomNumbers(prefix, 0, rt.count);

      await tx.room.createMany({
        data: roomNumbers.map((roomNumber) => ({
          hotelId: hotel.id,
          roomNumber,
          roomTypeId: roomType.id,
          status: "available" as const,
        })),
      });

      createdRoomTypes.push({ ...roomType, roomNumbers });
    }

    return createdRoomTypes;
  });

  return NextResponse.json({
    success: true,
    totalRooms,
    roomTypes: result.map((rt) => ({
      id: rt.id,
      category: rt.category,
      name: rt.name,
      count: rt.count,
      roomNumbers: rt.roomNumbers,
    })),
  });
}
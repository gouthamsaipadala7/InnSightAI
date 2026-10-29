import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";
import { istNoonUtc } from "@/lib/dates";

export const dynamic = "force-dynamic";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const querySchema = z.object({
  from: z.string().regex(dateRe, "from must be YYYY-MM-DD"),
  to: z.string().regex(dateRe, "to must be YYYY-MM-DD"),
});

export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const start = istNoonUtc(parsed.data.from);
  const end = istNoonUtc(parsed.data.to);
  if (end <= start) {
    return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
  }

  const rooms = await prisma.room.findMany({
    where: {
      hotelId: session.hotelId,
      bookings: {
        none: {
          isSynthetic: false,
          status: { in: ["reserved", "active"] },
          checkinTime: { lt: end },
          OR: [{ checkoutTime: null }, { checkoutTime: { gt: start } }],
        },
      },
    },
    include: { roomType: true },
    orderBy: { roomNumber: "asc" },
  });

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      roomTypeName: r.roomType.name,
      basePrice: Number(r.roomType.basePrice),
    })),
  });
}
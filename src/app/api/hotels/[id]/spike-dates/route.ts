import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { id } = await params;
  if (id !== session.hotelId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const rows = await prisma.dailyBookingCount.findMany({
    where: { hotelId: session.hotelId, isSpikePeriod: true },
    select: { date: true },
  });

  return NextResponse.json(rows.map((r) => r.date.toISOString().slice(0, 10)));
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";

const schema = z.object({ action: z.enum(["cancel", "no_show"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const status = parsed.data.action === "cancel" ? "cancelled" : "no_show";
  const r = await prisma.booking.updateMany({
    where: { id, hotelId: session.hotelId, status: "reserved" },
    data: { status },
  });
  if (r.count !== 1) {
    return NextResponse.json({ error: "Reservation not found or not in reserved state." }, { status: 404 });
  }
  await audit(session.hotelId, session.employeeId, `reservation_${status}`, { bookingId: id });
  return NextResponse.json({ success: true, status });
}
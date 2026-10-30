import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum(["cash", "card", "upi", "deposit", "refund"]),
  amountPaise: z.number().int().positive().max(1_000_000_000), // always positive; refund is negated server-side
  idempotencyKey: z.string().min(8).max(100),
});

async function balance(hotelId: string, bookingId: string) {
  const b = await prisma.booking.findFirst({ where: { id: bookingId, hotelId } });
  if (!b) return null;
  const sum = await prisma.payment.aggregate({
    where: { hotelId, bookingId },
    _sum: { amountPaise: true },
  });
  const paid = sum._sum.amountPaise ?? 0;
  const total = b.totalAmount !== null ? Math.round(Number(b.totalAmount) * 100) : null;
  return { paidPaise: paid, totalPaise: total, balancePaise: total === null ? null : total - paid };
}

export async function GET(request: Request) {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const bookingId = new URL(request.url).searchParams.get("bookingId") ?? "";
  if (!z.string().uuid().safeParse(bookingId).success) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  const s = await balance(session.hotelId, bookingId);
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const rows = await prisma.payment.findMany({ where: { hotelId: session.hotelId, bookingId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ...s, payments: rows });
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  const { bookingId, method, amountPaise, idempotencyKey } = parsed.data;

  const before = await balance(session.hotelId, bookingId);
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (method === "refund" && amountPaise > before.paidPaise) {
    return NextResponse.json({ error: "Refund exceeds amount paid." }, { status: 400 });
  }

  try {
    await prisma.payment.create({
      data: {
        hotelId: session.hotelId, bookingId, method, idempotencyKey,
        amountPaise: method === "refund" ? -amountPaise : amountPaise,
        createdBy: session.employeeId,
      },
    });
  } catch (e) {
    if (e instanceof Error && (e.message.includes("idempotency") || e.message.includes("P2002") || e.message.includes("Unique"))) {
      const again = await balance(session.hotelId, bookingId);
      return NextResponse.json({ success: true, duplicate: true, ...again });
    }
    throw e;
  }
  await audit(session.hotelId, session.employeeId, "payment_recorded", { bookingId, method, amountPaise });
  return NextResponse.json({ success: true, duplicate: false, ...(await balance(session.hotelId, bookingId)) });
}
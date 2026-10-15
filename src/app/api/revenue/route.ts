import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/session";
import { tenantScopedPrisma } from "@/lib/tenant-prisma";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireRole("manager");
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const db = tenantScopedPrisma(session.hotelId);
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const logs = await db.revenueLog.findMany({ where, orderBy: { date: "desc" } });
    const total = logs.reduce((sum, l) => sum + Number(l.amount), 0);

    return NextResponse.json({
      total,
      count: logs.length,
      logs: logs.map((l) => ({ id: l.id, amount: Number(l.amount), date: l.date })),
    });
  } catch (error) {
    console.error("[/api/revenue]", error);
    return NextResponse.json({ error: "Failed to load revenue." }, { status: 500 });
  }
}
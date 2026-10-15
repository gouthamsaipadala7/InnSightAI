import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  let session;
  try { session = await requireSession(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return NextResponse.json({ error: "Password required." }, { status: 400 });

  const employee = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  if (!employee) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ok = await verifyPassword(password, employee.passwordHash);
  if (!ok) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });

  return NextResponse.json({ success: true });
}
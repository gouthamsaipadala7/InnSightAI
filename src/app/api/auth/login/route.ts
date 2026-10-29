import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, signSession, verifyPassword } from "@/lib/auth";
import { isLocked, recordAttempt } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  const limitKey = `login:${username.toLowerCase()}`;
  if (await isLocked(limitKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const employee = await prisma.employee.findFirst({
    where: { username },
    include: { hotel: { select: { id: true, name: true, setupCompleted: true } } },
  });

  const invalidCredentials = () =>
    NextResponse.json({ error: "Invalid username or password." }, { status: 401 });

  if (!employee) {
    await recordAttempt(limitKey, false);
    return invalidCredentials();
  }

  const passwordMatches = await verifyPassword(password, employee.passwordHash);
  if (!passwordMatches) {
    await recordAttempt(limitKey, false);
    return invalidCredentials();
  }
  await recordAttempt(limitKey, true);
  await audit(employee.hotelId, employee.id, "login");

  const token = await signSession({
    employeeId: employee.id,
    hotelId: employee.hotelId,
    hotelName: employee.hotel.name,
    role: employee.role,
    username: employee.username,
    name: employee.name,
    tokenVersion: employee.tokenVersion,
  });

  const response = NextResponse.json({
    employeeId: employee.id,
    name: employee.name,
    role: employee.role,
    hotelId: employee.hotelId,
    hotelName: employee.hotel.name,
    hotelSetupCompleted: employee.hotel.setupCompleted,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
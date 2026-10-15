import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, signSession, verifyPassword } from "@/lib/auth";

/**
 * Single login form for both roles — the client sends only username +
 * password, no hotel selector. The backend determines both the hotel and
 * the role by looking the username up in `employees`.
 *
 * Design note: `employees` enforces username uniqueness *per hotel*
 * (`@@unique([hotelId, username])`), not globally — two different hotels
 * could in principle pick the same username. This lookup is global
 * (`findFirst` by username alone), so it depends on usernames being
 * globally unique in practice. The seed script follows a hotel-prefixed
 * convention (e.g. "grandpalace.manager") specifically to guarantee that in
 * the seeded data.
 */
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

  const employee = await prisma.employee.findFirst({
    where: { username },
    include: { hotel: { select: { id: true, name: true, setupCompleted: true } } },
  });

  const invalidCredentials = () =>
    NextResponse.json({ error: "Invalid username or password." }, { status: 401 });

  if (!employee) {
    return invalidCredentials();
  }

  const passwordMatches = await verifyPassword(password, employee.passwordHash);
  if (!passwordMatches) {
    return invalidCredentials();
  }

  const token = await signSession({
    employeeId: employee.id,
    hotelId: employee.hotelId,
    hotelName: employee.hotel.name,
    role: employee.role,
    username: employee.username,
    name: employee.name,
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
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (session) {
    await prisma.employee.update({
      where: { id: session.employeeId },
      data: { tokenVersion: { increment: 1 } },
    });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
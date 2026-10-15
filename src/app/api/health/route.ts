import { NextResponse } from "next/server";

/**
 * Placeholder health-check endpoint.
 *
 * Confirms the API routing layer is wired up. Does NOT touch the database
 * yet (no tables exist until a later phase) — swap in a real `SELECT 1`
 * against `pool` once schema work begins.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "hotel-saas-api",
    timestamp: new Date().toISOString(),
  });
}

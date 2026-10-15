import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

/**
 * Auth primitives: password hashing (bcryptjs — pure JS, no native build
 * step, so it installs cleanly on Windows without extra tooling) and JWT
 * sign/verify (jose — Web Crypto based, so the exact same code runs in both
 * the Edge-runtime middleware and normal Node route handlers, unlike
 * `jsonwebtoken` which needs Node's crypto module and breaks in Edge).
 */

const SESSION_COOKIE_NAME = "hms_session";
const SESSION_TTL = "8h"; // a front-desk shift, not a "remember me" duration

export type EmployeeRole = "receptionist" | "manager";

export interface SessionPayload {
  employeeId: string;
  hotelId: string;
  hotelName: string;
  role: EmployeeRole;
  username: string;
  name: string;
}

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "replace-with-a-long-random-secret") {
    throw new Error(
      "JWT_SECRET is not set (or is still the placeholder value). Set a real random string in .env — e.g. `openssl rand -base64 48`."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey());
}

/**
 * Verifies a session JWT. Returns the payload on success, or `null` on any
 * failure (expired, tampered, wrong secret, malformed) — callers should
 * treat `null` as "not logged in", not throw a 500.
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME };
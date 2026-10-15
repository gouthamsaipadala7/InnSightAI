import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export async function isLocked(key: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const failures = await prisma.loginAttempt.count({
    where: { key, success: false, createdAt: { gte: since } },
  });
  return failures >= MAX_FAILURES;
}

export async function recordAttempt(key: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { key, success } });
  if (success) {
    await prisma.loginAttempt.deleteMany({ where: { key, success: false } });
  }
}
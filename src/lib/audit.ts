import { prisma } from "@/lib/prisma";

export async function audit(
  hotelId: string,
  employeeId: string | null,
  action: string,
  detail?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: { hotelId, employeeId, action, detail: detail ? (detail as object) : undefined },
    });
  } catch (e) {
    console.error("[audit] failed to write", action, e instanceof Error ? e.message : e);
  }
}
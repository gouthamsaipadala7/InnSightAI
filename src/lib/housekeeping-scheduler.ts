import cron from "node-cron";
import { prisma } from "@/lib/prisma";

/**
 * Server-side cron sweep — NOT a client setTimeout. Runs every minute
 * regardless of whether any browser tab is open, checking for rooms whose
 * cleaning window has elapsed and flipping them back to available. Started
 * once at server boot via src/instrumentation.ts, not per-request.
 */

declare global {
  // eslint-disable-next-line no-var
  var _housekeepingCronStarted: boolean | undefined;
}

export function startHousekeepingScheduler() {
  if (global._housekeepingCronStarted) return;
  global._housekeepingCronStarted = true;

  cron.schedule("* * * * *", async () => {
    const durationMinutes = Number(process.env.CLEANING_DURATION_MINUTES) || 120;
    const cutoff = new Date(Date.now() - durationMinutes * 60_000);

    const overdue = await prisma.housekeeping.findMany({
      where: { status: "in_progress", cleaningStartedAt: { lte: cutoff } },
    });

        for (const hk of overdue) {
        const ops: any[] = [
        prisma.housekeeping.update({
          where: { id: hk.id },
          data: { status: "completed", completedAt: new Date() },
        }),
        prisma.room.update({
          where: { id: hk.roomId },
          data: { status: "available" },
        }),
      ];
      if (hk.staffId) {
        ops.push(
          prisma.staff.update({
            where: { id: hk.staffId },
            data: { status: "available", assignedRoomId: null },
          })
        );
      }
      await prisma.$transaction(ops);
    }

    if (overdue.length > 0) {
      console.log(`[housekeeping] completed ${overdue.length} room(s)`);
    }
  });

  console.log("[housekeeping] scheduler started (checks every minute)");
}
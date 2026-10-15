export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startHousekeepingScheduler } = await import("@/lib/housekeeping-scheduler");
    startHousekeepingScheduler();
  }
}
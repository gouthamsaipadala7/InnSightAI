import { prisma } from "../src/lib/prisma";

/**
 * One-off: tags existing daily_booking_counts rows with is_spike_period,
 * for hotels seeded before that column existed. Reconstructs the same
 * spike windows Phase 3's seed.ts used (hardcoded per hotel name), anchored
 * to each hotel's actual earliest seeded date rather than assuming "today".
 */

const SPIKE_WINDOWS_BY_HOTEL: Record<string, Array<[number, number]>> = {
  "Grand Palace Hotel": [[70, 77], [190, 199]],
  "Seaside Resort": [[55, 63], [210, 218]],
  "Metro Business Hotel": [[95, 103], [160, 168]],
};

async function main() {
  const hotels = await prisma.hotel.findMany();

  for (const hotel of hotels) {
    const windows = SPIKE_WINDOWS_BY_HOTEL[hotel.name];
    if (!windows) {
      console.log(`Skipping "${hotel.name}" — not one of the 3 originally seeded hotels.`);
      continue;
    }

    const earliest = await prisma.dailyBookingCount.aggregate({
      where: { hotelId: hotel.id },
      _min: { date: true },
    });
    const startDate = earliest._min.date;
    if (!startDate) {
      console.log(`Skipping "${hotel.name}" — no daily_booking_counts rows found.`);
      continue;
    }

    let totalTagged = 0;
    for (const [s, e] of windows) {
      const rangeStart = new Date(startDate);
      rangeStart.setUTCDate(rangeStart.getUTCDate() + s);
      const rangeEnd = new Date(startDate);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + e);

      const result = await prisma.dailyBookingCount.updateMany({
        where: { hotelId: hotel.id, date: { gte: rangeStart, lte: rangeEnd } },
        data: { isSpikePeriod: true },
      });
      totalTagged += result.count;
    }

    console.log(`${hotel.name}: tagged ${totalTagged} spike-period day(s).`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
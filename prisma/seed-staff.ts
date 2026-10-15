import { prisma } from "../src/lib/prisma";

const NAMES = ["Ravi Kumar", "Lakshmi Devi", "Suresh Babu", "Anita Reddy"];

async function main() {
  const hotels = await prisma.hotel.findMany();
  for (const hotel of hotels) {
    const existing = await prisma.staff.count({ where: { hotelId: hotel.id } });
    if (existing > 0) {
      console.log(`${hotel.name}: already has staff, skipping.`);
      continue;
    }
    await prisma.staff.createMany({
      data: NAMES.map((name) => ({ hotelId: hotel.id, name })),
    });
    console.log(`${hotel.name}: added ${NAMES.length} staff members.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
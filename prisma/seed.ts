import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { generateSyntheticHistory, type RoomForBooking, type RoomTypePricing } from "./synthetic-history";

/**
 * Seeds 3 example hotels with a receptionist + manager account each, and
 * 9 months of realistic backdated demand history per hotel so the AI
 * forecasting layer (Track B) has something real to train and demo on.
 *
 * SAFE-BY-DEFAULT: refuses to run against a database that already has
 * hotels in it, so re-running this by accident doesn't duplicate months of
 * synthetic data. Run `npx prisma migrate reset` first if you want a clean
 * re-seed.
 *
 * Run with: npx prisma db seed   (or: npm run db:seed)
 */

const HISTORY_DAYS = 270; // ~9 months, within the requested 6–12 month range

interface RoomTypeDef {
  category: "standard" | "deluxe" | "suite";
  name: string;
  count: number;
  basePrice: number;
}

interface EmployeeDef {
  role: "receptionist" | "manager";
  name: string;
  username: string;
  password: string;
}

interface HotelDef {
  name: string;
  contactNumber: string;
  email: string;
  address: string;
  roomTypes: RoomTypeDef[];
  employees: EmployeeDef[];
  baseOccupancy: number;
  // Day-offset windows (from the start of the 270-day history) where demand
  // spikes, simulating a local festival/event. Staggered per hotel so the
  // three hotels don't all spike on the same calendar day — more realistic,
  // and better demonstrates the pooled model learning a shared "spike
  // shape" from hotel-specific spike timings later.
  spikeWindows: Array<[number, number]>;
}

// Passwords are deliberately simple and identical in *pattern* across
// hotels (Reception@123 / Manager@123) — this is seed/demo data for local
// development, not production credentials. Documented loudly in
// seed-output.md; change before any real deployment.
const HOTELS: HotelDef[] = [
  {
    name: "Grand Palace Hotel",
    contactNumber: "9100000001",
    email: "contact@grandpalace.example",
    address: "12 MG Road, Hyderabad, Telangana",
    roomTypes: [
      { category: "standard", name: "Standard", count: 14, basePrice: 2800 },
      { category: "deluxe", name: "Deluxe", count: 7, basePrice: 4200 },
      { category: "suite", name: "Suite", count: 3, basePrice: 7500 },
    ],
    employees: [
      { role: "receptionist", name: "Ananya Rao", username: "grandpalace.reception", password: "Reception@123" },
      { role: "manager", name: "Vikram Shah", username: "grandpalace.manager", password: "Manager@123" },
    ],
    baseOccupancy: 0.5,
    spikeWindows: [[70, 77], [190, 199]],
  },
  {
    name: "Seaside Resort",
    contactNumber: "9100000002",
    email: "contact@seasideresort.example",
    address: "45 Beach Road, Visakhapatnam, Andhra Pradesh",
    roomTypes: [
      { category: "standard", name: "Standard", count: 18, basePrice: 3200 },
      { category: "deluxe", name: "Deluxe", count: 9, basePrice: 4800 },
      { category: "suite", name: "Suite", count: 3, basePrice: 8200 },
    ],
    employees: [
      { role: "receptionist", name: "Divya Menon", username: "seaside.reception", password: "Reception@123" },
      { role: "manager", name: "Arjun Nair", username: "seaside.manager", password: "Manager@123" },
    ],
    baseOccupancy: 0.55,
    spikeWindows: [[55, 63], [210, 218]],
  },
  {
    name: "Metro Business Hotel",
    contactNumber: "9100000003",
    email: "contact@metrobusiness.example",
    address: "8 Financial District, Hyderabad, Telangana",
    roomTypes: [
      { category: "standard", name: "Standard", count: 12, basePrice: 2600 },
      { category: "deluxe", name: "Deluxe", count: 6, basePrice: 3900 },
      { category: "suite", name: "Suite", count: 2, basePrice: 6800 },
    ],
    employees: [
      { role: "receptionist", name: "Kiran Patel", username: "metrobiz.reception", password: "Reception@123" },
      { role: "manager", name: "Sneha Iyer", username: "metrobiz.manager", password: "Manager@123" },
    ],
    baseOccupancy: 0.42,
    spikeWindows: [[95, 103], [160, 168]],
  },
];

const CUSTOMER_POOL_SIZE = 150;

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Krishna", "Ishaan", "Rohan", "Karthik", "Sai",
  "Priya", "Ananya", "Diya", "Meera", "Kavya", "Riya", "Sneha", "Pooja",
  "James", "Michael", "David", "Robert", "Sarah", "Emily", "Laura", "Grace",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Reddy", "Rao", "Nair", "Iyer", "Menon",
  "Patel", "Shah", "Kumar", "Singh", "Das", "Bose", "Pillai", "Chatterjee",
  "Smith", "Johnson", "Brown", "Wilson", "Taylor", "Anderson", "Clark",
];

function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomPhone(index: number): string {
  // Deterministic-ish but varied 10-digit numbers, avoiding collisions.
  return `9${(200000000 + index * 37).toString().slice(0, 9)}`;
}

/** Splits an array into fixed-size chunks for batched createMany calls. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

interface SeedOutputHotel {
  name: string;
  hotelId: string;
  totalRooms: number;
  employees: Array<{ role: string; username: string; password: string; name: string }>;
  historyDays: number;
  totalBookings: number;
  spikeDateRanges: Array<{ start: string; end: string }>;
}

async function main() {
  const existingHotels = await prisma.hotel.count();
  if (existingHotels > 0) {
    console.error(
      `Refusing to seed: ${existingHotels} hotel(s) already exist in this database.\n` +
        "Run `npx prisma migrate reset` first if you want to wipe the database and re-seed from scratch."
    );
    process.exit(1);
  }

  const seedOutputHotels: SeedOutputHotel[] = [];

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - HISTORY_DAYS);

  for (const hotelDef of HOTELS) {
    const totalRooms = hotelDef.roomTypes.reduce((sum, rt) => sum + rt.count, 0);

    console.log(`\nSeeding "${hotelDef.name}" (${totalRooms} rooms)...`);

    const hotel = await prisma.hotel.create({
      data: {
        name: hotelDef.name,
        contactNumber: hotelDef.contactNumber,
        email: hotelDef.email,
        address: hotelDef.address,
        totalRooms,
        employeesCount: hotelDef.employees.length,
        setupCompleted: true,
      },
    });

    // Room types (small number — plain sequential creates are fine).
    const roomTypeRecords = [];
    for (const rt of hotelDef.roomTypes) {
      const created = await prisma.roomType.create({
        data: {
          hotelId: hotel.id,
          category: rt.category,
          name: rt.name,
          count: rt.count,
          basePrice: rt.basePrice,
        },
      });
      roomTypeRecords.push({ ...created, def: rt });
    }

    // Rooms — numbered 1xx/2xx/3xx by category (standard/deluxe/suite).
    const roomTypePrefixes: Record<string, number> = { standard: 100, deluxe: 200, suite: 300 };
    const roomsToCreate: RoomForBooking[] = [];
    const roomRows = [];
    for (const rt of roomTypeRecords) {
      const prefix = roomTypePrefixes[rt.def.category];
      for (let i = 0; i < rt.def.count; i++) {
        const id = randomUUID();
        roomRows.push({
          id,
          hotelId: hotel.id,
          roomNumber: String(prefix + i + 1),
          roomTypeId: rt.id,
          status: "available" as const,
        });
        roomsToCreate.push({ id, roomTypeId: rt.id });
      }
    }
    await prisma.room.createMany({ data: roomRows });

    // Employees — passwords hashed with bcrypt, never stored in plain text.
    const employeeCredentials: SeedOutputHotel["employees"] = [];
    for (const emp of hotelDef.employees) {
      const passwordHash = await hashPassword(emp.password);
      await prisma.employee.create({
        data: {
          hotelId: hotel.id,
          username: emp.username,
          passwordHash,
          role: emp.role,
          name: emp.name,
        },
      });
      employeeCredentials.push({
        role: emp.role,
        username: emp.username,
        password: emp.password,
        name: emp.name,
      });
    }

    // Customer pool — reused across many bookings so Guest History has
    // realistic repeat guests, not one customer per booking.
    const customerIds = Array.from({ length: CUSTOMER_POOL_SIZE }, () => randomUUID());
    await prisma.customer.createMany({
      data: customerIds.map((id, i) => ({
        id,
        hotelId: hotel.id,
        name: randomName(),
        phone: randomPhone(i),
      })),
    });

    // Synthetic history — the research-critical part.
    const roomTypePricing: RoomTypePricing[] = roomTypeRecords.map((rt) => ({
      roomTypeId: rt.id,
      basePrice: Number(rt.basePrice),
    }));

    const history = generateSyntheticHistory({
      hotelId: hotel.id,
      days: HISTORY_DAYS,
      startDate,
      totalRooms,
      baseOccupancy: hotelDef.baseOccupancy,
      spikeWindows: hotelDef.spikeWindows,
      rooms: roomsToCreate,
      roomTypePricing,
      customerIds,
    });

    await prisma.dailyBookingCount.createMany({ data: history.dailyCounts });

    for (const batch of chunk(history.bookings, 1000)) {
      await prisma.booking.createMany({ data: batch });
    }
    for (const batch of chunk(history.revenueLogs, 1000)) {
      await prisma.revenueLog.createMany({ data: batch });
    }

    console.log(
      `  → ${history.bookings.length} historical bookings across ${HISTORY_DAYS} days ` +
        `(spikes: ${history.spikeDateRanges.map((r) => `${r.start}–${r.end}`).join(", ")})`
    );

    seedOutputHotels.push({
      name: hotelDef.name,
      hotelId: hotel.id,
      totalRooms,
      employees: employeeCredentials,
      historyDays: HISTORY_DAYS,
      totalBookings: history.bookings.length,
      spikeDateRanges: history.spikeDateRanges,
    });
  }

  await writeSeedOutput(seedOutputHotels);
  console.log("\nSeed complete. Credentials written to seed-output.md — see that file for login details.");
}

async function writeSeedOutput(hotels: SeedOutputHotel[]) {
  const lines: string[] = [];
  lines.push("# Seed data — login credentials & synthetic history summary");
  lines.push("");
  lines.push(
    "> **Local development only.** These are plaintext demo passwords for 3 " +
      "seeded hotels. Never reuse this pattern in a real deployment."
  );
  lines.push("");

  for (const hotel of hotels) {
    lines.push(`## ${hotel.name}`);
    lines.push("");
    lines.push(`- Hotel ID: \`${hotel.hotelId}\``);
    lines.push(`- Total rooms: ${hotel.totalRooms}`);
    lines.push("");
    lines.push("| Role | Username | Password | Name |");
    lines.push("|------|----------|----------|------|");
    for (const emp of hotel.employees) {
      lines.push(`| ${emp.role} | \`${emp.username}\` | \`${emp.password}\` | ${emp.name} |`);
    }
    lines.push("");
    lines.push(
      `Synthetic history: ${hotel.historyDays} days, ${hotel.totalBookings} backdated bookings. ` +
        `Injected demand spikes: ${hotel.spikeDateRanges.map((r) => `${r.start} to ${r.end}`).join("; ")}.`
    );
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "All three hotels' `daily_booking_counts` tables are now populated and ready " +
      "for the Prophet + pooled-XGBoost forecasting layer (Track B)."
  );

  const outputPath = path.join(process.cwd(), "seed-output.md");
  await writeFile(outputPath, lines.join("\n"), "utf-8");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
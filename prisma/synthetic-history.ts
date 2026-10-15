import { randomUUID } from "node:crypto";

/**
 * Generates realistic backdated demand history for one hotel: a daily
 * booking-count time series (what Track B's Prophet + pooled XGBoost layer
 * will train on) plus the actual Booking/RevenueLog rows that reconcile
 * with it — the count for a given day always equals the number of Booking
 * rows generated with that check-in date, so the rollup table and the raw
 * bookings never disagree.
 *
 * Demand model per day = baseOccupancy × trend × weeklySeasonality ×
 * spikeMultiplier (if in a spike window) × noise, clamped to [5%, 97%] of
 * capacity, then converted to a room count.
 *
 * - Weekly seasonality: Friday/Saturday run highest, Monday/Tuesday lowest
 *   — a standard leisure-hotel weekly pattern.
 * - Trend: mild linear growth (+25% by the end of the window) — enough for
 *   Prophet's trend component to have something to fit, not so much that
 *   it swamps the seasonality/spike signal the paper cares about.
 * - Spikes: 1–3 day windows (`spikeWindows`, given as day-offsets from the
 *   start of the series) get a ~1.6–1.9× multiplier, simulating a local
 *   festival or event — this is the "injected anomaly" Prophet's residual
 *   should flag and XGBoost should learn to associate with recurring
 *   calendar effects across hotels.
 */

export interface RoomForBooking {
  id: string;
  roomTypeId: string;
}

export interface RoomTypePricing {
  roomTypeId: string;
  basePrice: number;
}

export interface GenerateHistoryOptions {
  hotelId: string;
  days: number;
  startDate: Date;
  totalRooms: number;
  baseOccupancy: number;
  spikeWindows: Array<[number, number]>;
  rooms: RoomForBooking[];
  roomTypePricing: RoomTypePricing[];
  customerIds: string[];
}

export interface DailyBookingCountRow {
  id: string;
  hotelId: string;
  date: Date;
  count: number;
  isSpikePeriod: boolean;
}

export interface BookingRow {
  id: string;
  hotelId: string;
  customerId: string;
  roomId: string;
  checkinTime: Date;
  checkoutTime: Date;
  initialPayment: number;
  totalAmount: number;
  status: "checked_out";
}

export interface RevenueLogRow {
  id: string;
  hotelId: string;
  bookingId: string;
  amount: number;
  date: Date;
}

export interface GeneratedHistory {
  dailyCounts: DailyBookingCountRow[];
  bookings: BookingRow[];
  revenueLogs: RevenueLogRow[];
  spikeDateRanges: Array<{ start: string; end: string }>;
}

const WEEKLY_MULTIPLIER = [0.85, 0.72, 0.78, 0.82, 0.9, 1.25, 1.35]; // Sun..Sat

function isInSpike(dayIndex: number, spikeWindows: Array<[number, number]>) {
  return spikeWindows.some(([s, e]) => dayIndex >= s && dayIndex <= e);
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateSyntheticHistory(
  opts: GenerateHistoryOptions
): GeneratedHistory {
  const {
    hotelId,
    days,
    startDate,
    totalRooms,
    baseOccupancy,
    spikeWindows,
    rooms,
    roomTypePricing,
    customerIds,
  } = opts;

  const priceByRoomType = new Map(
    roomTypePricing.map((rt) => [rt.roomTypeId, rt.basePrice])
  );

  const dailyCounts: DailyBookingCountRow[] = [];
  const bookings: BookingRow[] = [];
  const revenueLogs: RevenueLogRow[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + i);
    const dow = date.getUTCDay();

    const trend = 1 + 0.25 * (i / (days - 1));
    const weekly = WEEKLY_MULTIPLIER[dow];
    const inSpike = isInSpike(i, spikeWindows);
    const spike = inSpike ? 1.6 + Math.random() * 0.3 : 1;
    const noise = 0.9 + Math.random() * 0.2;

    let occupancy = baseOccupancy * trend * weekly * spike * noise;
    occupancy = Math.min(0.97, Math.max(0.05, occupancy));

    const count = Math.max(
      0,
      Math.min(totalRooms, Math.round(occupancy * totalRooms))
    );

    dailyCounts.push({ id: randomUUID(), hotelId, date, count, isSpikePeriod: inSpike });

    for (let b = 0; b < count; b++) {
      const room = pickRandom(rooms);
      const basePrice = priceByRoomType.get(room.roomTypeId) ?? 3000;
      const nights = 1 + Math.floor(Math.random() * 3); // 1–3 nights

      const checkinTime = new Date(date);
      checkinTime.setUTCHours(12 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));

      const checkoutTime = new Date(checkinTime);
      checkoutTime.setUTCDate(checkoutTime.getUTCDate() + nights);

      const totalAmount = round2(basePrice * nights * (0.95 + Math.random() * 0.1));
      const initialPayment = round2(totalAmount * (0.25 + Math.random() * 0.15));

      const bookingId = randomUUID();

      bookings.push({
        id: bookingId,
        hotelId,
        customerId: pickRandom(customerIds),
        roomId: room.id,
        checkinTime,
        checkoutTime,
        initialPayment,
        totalAmount,
        status: "checked_out",
      });

      revenueLogs.push({
        id: randomUUID(),
        hotelId,
        bookingId,
        amount: totalAmount,
        date: checkoutTime,
      });
    }
  }

  const spikeDateRanges = spikeWindows.map(([s, e]) => {
    const start = new Date(startDate);
    start.setUTCDate(start.getUTCDate() + s);
    const end = new Date(startDate);
    end.setUTCDate(end.getUTCDate() + e);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });

  return { dailyCounts, bookings, revenueLogs, spikeDateRanges };
}
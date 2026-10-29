const IST_MS = 5.5 * 60 * 60 * 1000;

// 12:00 IST on the given YYYY-MM-DD date, as a UTC instant.
export function istNoonUtc(d: string) {
  return new Date(Date.parse(d + "T12:00:00.000Z") - IST_MS);
}
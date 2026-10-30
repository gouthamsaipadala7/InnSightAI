function offsetMs(utcMs: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value])
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// Local wall-clock time (YYYY-MM-DD + HH:MM) in `tz`, as a UTC instant.
export function localToUtc(date: string, hhmm: string, tz: string) {
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const first = guess - offsetMs(guess, tz);
  return new Date(guess - offsetMs(first, tz));
}

// Backward-compatible default: 12:00 IST.
export function istNoonUtc(d: string) {
  return localToUtc(d, "12:00", "Asia/Kolkata");
}
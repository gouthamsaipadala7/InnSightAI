const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const TABLES = {
  hotels: "select * from hotels",
  room_types: "select * from room_types",
  rooms: "select * from rooms",
  employees: "select id,hotel_id,username,role,name,created_at,updated_at from employees", // no password hashes
  customers: "select * from customers",
  bookings: "select * from bookings",
  housekeeping: "select * from housekeeping",
  revenue_log: "select * from revenue_log",
  daily_booking_counts: "select * from daily_booking_counts",
  staff: "select * from staff",
};

const esc = (v) => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const dir = path.join("backups", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(dir, { recursive: true });
  const counts = {};
  for (const [name, sql] of Object.entries(TABLES)) {
    const r = await c.query(sql);
    const cols = r.fields.map((f) => f.name);
    const lines = [cols.join(",")].concat(r.rows.map((row) => cols.map((k) => esc(row[k])).join(",")));
    fs.writeFileSync(path.join(dir, name + ".csv"), lines.join("\n"), "utf8");
    counts[name] = r.rowCount;
  }
  fs.writeFileSync(path.join(dir, "row_counts.json"), JSON.stringify(counts, null, 2));
  console.table(counts);
  console.log("Saved to", dir);
  await c.end();
})().catch((e) => { console.log(e.message); process.exit(1); });
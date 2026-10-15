const { Client } = require("pg");
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
c.connect()
  .then(async () => {
    const a = await c.query("select h.name hotel, b.status, count(*) n, max(b.created_at) latest from bookings b join hotels h on h.id=b.hotel_id group by 1,2 order by 1,2");
    console.table(a.rows);
    const b = await c.query("select h.name hotel, count(*) n, sum(r.amount) total, max(r.date) latest from revenue_log r join hotels h on h.id=r.hotel_id group by 1 order by 1");
    console.table(b.rows);
    const d = await c.query("select h.name hotel, max(d.date) latest, sum(d.count) total from daily_booking_counts d join hotels h on h.id=d.hotel_id group by 1 order by 1");
    console.table(d.rows);
    await c.end();
  })
  .catch((e) => console.log(e.message));
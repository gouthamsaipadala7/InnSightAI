const { Client } = require("pg");
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
c.connect()
  .then(() =>
    c.query(
      "select h.name hotel, e.username, e.role from employees e join hotels h on h.id = e.hotel_id order by 1, 3"
    )
  )
  .then((r) => {
    console.table(r.rows);
    return c.end();
  })
  .catch((e) => console.log(e.message));
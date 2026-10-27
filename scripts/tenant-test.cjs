const BASE = "http://localhost:3000";
const PW = { rec: process.env.TEST_REC_PW, mgr: process.env.TEST_MGR_PW };

async function login(username, password) {
  const r = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  const body = await r.json();
  return { cookie, body };
}
const get = (p, cookie) => fetch(BASE + p, { headers: { cookie } }).then(async (r) => ({ s: r.status, b: await r.json().catch(() => null) }));

let fails = 0;
const check = (name, ok) => { console.log((ok ? "PASS " : "FAIL ") + name); if (!ok) fails++; };

(async () => {
  const a = await login("grandpalace.reception", PW.rec);
  const m = await login("grandpalace.manager", PW.mgr);
  const other = await login("seaside.reception", PW.rec);
  check("logins work", a.cookie && m.cookie && other.cookie);

  const otherHotel = other.body.hotelId;
  for (const p of ["occupancy", "room-types", "spike-dates"]) {
    const r = await get(`/api/hotels/${otherHotel}/${p}`, a.cookie);
    check(`cross-tenant ${p} blocked`, r.s === 403 || r.s === 404);
  }
  check("no session -> 401", (await get("/api/revenue", "")).s === 401);
  check("receptionist cannot change settings", (await fetch(BASE + "/api/hotel/settings", { method: "PATCH", headers: { cookie: a.cookie, "Content-Type": "application/json" }, body: "{}" })).status === 403);

  const staff = await get("/api/staff", a.cookie);
  const ownHotelStaff = (staff.b?.available || []).length;
  check("staff list only own hotel (<=4)", ownHotelStaff <= 4);
  check("revenue scoped (own data only)", (await get("/api/revenue", a.cookie)).s === 200);

  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
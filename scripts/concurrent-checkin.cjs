const BASE = "http://localhost:3000";
(async () => {
  const l = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "grandpalace.reception", password: process.env.TEST_REC_PW }),
  });
  const cookie = (l.headers.get("set-cookie") || "").split(";")[0];
  const rooms = await (await fetch(BASE + "/api/rooms", { headers: { cookie } })).json();
  const list = Array.isArray(rooms) ? rooms : rooms.rooms || [];
  const room = list.find((r) => r.status === "available");
  if (!room) return console.log("No available room found. Response was:", JSON.stringify(rooms).slice(0, 300));
  const body = JSON.stringify({ customerName: "Race Test", phone: "9876543210", roomId: room.id, initialPayment: 100 });
  const res = await Promise.all(Array.from({ length: 10 }, () =>
    fetch(BASE + "/api/bookings/checkin", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body }).then((r) => r.status)));
  const ok = res.filter((s) => s === 200).length;
  console.log(res.join(","), "\nsuccesses:", ok, ok === 1 ? "PASS" : "FAIL");
})();
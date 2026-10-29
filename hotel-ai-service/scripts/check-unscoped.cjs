const fs = require("fs"), path = require("path");
const bad = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/generated|node_modules/.test(p)) walk(p); continue; }
    if (!/route\.ts$/.test(f.name)) continue;
    const src = fs.readFileSync(p, "utf8");
    if (/requireSession|requireRole/.test(src) === false && !/auth[\\/](login|logout)|health/.test(p)) bad.push(p + " (no session check)");
    if (/prisma\.(booking|room|customer|staff|housekeeping|revenueLog)\.(findMany|findFirst|count)\(/.test(src) && !/hotelId/.test(src)) bad.push(p + " (query without hotelId)");
  }
})("src/app/api");
console.log(bad.length ? "FLAGGED:\n" + bad.join("\n") : "OK: all API routes check a session and scope queries");
process.exit(bad.length ? 1 : 0);
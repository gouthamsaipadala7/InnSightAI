# Hotel Management System — Phase 1 Skeleton

Multi-tenant hotel operations SaaS. This is the project skeleton only:
folder structure, theming, and config — no auth, no database tables, no
feature pages yet.

## Architecture decision: Next.js API routes (not a separate Express server)

The brief allowed either. This project uses **Next.js API routes**
(`src/app/api/**/route.ts`) instead of a standalone Express server:

- One deployable app instead of two, which matters for a college project
  with a deadline.
- Route handlers get the same TypeScript types, env vars, and `lib/`
  helpers as the frontend — no duplicate config.
- JWT auth (Phase 2+) works fine as middleware on route handlers.
- The AI research component (Track B) already lives in its own separate
  Python FastAPI service, so the project is already multi-service where it
  actually needs to be.

If a grading requirement later demands a literal Express server, the
`lib/db.ts` pool and business logic are framework-agnostic enough to move.

## Stack

- **Frontend/Backend:** Next.js (App Router) + TypeScript + Tailwind CSS v4
- **UI components:** shadcn/ui primitives (hand-added, see note below) +
  lucide-react icons
- **Database:** PostgreSQL via `pg`, connection pool in `src/lib/db.ts`
- **Fonts:** Inter via `next/font/google`
- **Charts (later phase):** Recharts
- **AI microservice (separate repo/service, later phase):** Python FastAPI —
  Prophet + XGBoost + SHAP

### Note on shadcn/ui setup

The `shadcn` CLI's `init`/`add` commands fetch component source from
`ui.shadcn.com`, which wasn't reachable from this build environment, so
`components.json`, `src/lib/utils.ts`, and the two starter components
(`Button`, `Card`) were added by hand using the same conventions the CLI
generates (new-york style, CSS variables, `@/*` aliases). If you have
network access to `ui.shadcn.com` locally, `npx shadcn@latest add <component>`
will work normally from here on and will match this setup.

## Folder structure

```
src/
  app/
    api/            → backend routes (e.g. api/health)
    layout.tsx       → root layout, loads Inter
    page.tsx         → placeholder homepage (palette + component sanity check)
    globals.css       → design tokens (Tailwind v4 @theme) + shadcn CSS vars
  components/
    ui/              → shadcn/ui primitives (button, card, ...)
  lib/
    db.ts            → PostgreSQL pool
    utils.ts         → cn() className helper
  styles/            → non-entry-point style assets (see styles/README.md)
```

## Setup

```bash
npm install
cp .env.example .env   # already done in this skeleton — edit DATABASE_URL for your local Postgres
npm run dev
```

Visit `http://localhost:3000` — you should see the design-system sanity
check page. `http://localhost:3000/api/health` returns a JSON health check
(no database call yet).

## Environment variables

See `.env.example`. `DATABASE_URL` must point at a real PostgreSQL instance —
the pool in `src/lib/db.ts` will throw clearly on boot if it's missing.

---

## Phase 2 — Database schema

### ORM choice: Prisma

Chosen over hand-rolled SQL migration files (e.g. via `node-pg-migrate`)
because:

- The whole stack is already TypeScript (Next.js API routes from Phase 1) —
  Prisma Client gives fully-typed queries against this exact schema, so a
  typo in a column name is a compile error, not a runtime bug discovered in
  a demo.
- `prisma migrate dev` still generates real, readable, plain SQL migration
  files (see below) — you get the same auditability as hand-written
  migrations, plus the type safety, rather than choosing between the two.
- Multi-tenant apps live and die by "did every query get scoped to
  `hotel_id`" — a typed client makes that a visible, greppable `where:
  { hotelId }` in every query rather than a string you hope you got right.

### Schema

`prisma/schema.prisma` — 9 tables, 5 enums, all as specified in the brief.
See inline comments in the file for the reasoning behind a couple of
judgment calls:

- **`room_types.category`** — kept the standard/deluxe/suite/custom bucket
  as an enum (`category`) *and* kept `name` as free text, since "custom"
  implies hotels need to name their own types.
- **`housekeeping.hotel_id`** — added even though it wasn't in the brief's
  literal column list, because the brief's own multi-tenant rule ("every
  query must be scoped to a hotel, with indexes on hotel_id") applies here
  too. Without it, every housekeeping board query needs a join through
  `rooms` just to filter by tenant. Flagged clearly in the schema comment —
  drop it if you'd rather keep housekeeping join-only.
- **`daily_booking_counts`** unique `(hotel_id, date)` constraint doubles as
  the required composite index — Postgres builds a unique constraint as a
  unique btree index, so there's no separate plain index needed alongside
  it.
- Foreign keys: tenant-cascade (`hotel_id → hotels`, deleting a hotel
  deletes all its data) is `ON DELETE CASCADE` throughout. References to
  "active" entities that shouldn't silently vanish out from under a booking
  (`bookings.customer_id`, `bookings.room_id`, `rooms.room_type_id`) are
  `ON DELETE RESTRICT` instead.

### Migration

`prisma/migrations/20260101000000_init/migration.sql` — hand-verified by
actually applying it to a real local PostgreSQL 16 instance (all 9 tables,
5 enum types, 13 foreign keys, and every listed index were confirmed to
exist afterward with no errors). It's already in the exact folder structure
`prisma migrate` expects, so it'll be picked up as existing history rather
than regenerated.

### Setup

```bash
npm install
cp .env.example .env    # point DATABASE_URL at your local Postgres
npx prisma generate     # generates the typed Prisma Client
npx prisma migrate dev  # applies the migration above to your database
```

`npx prisma studio` (or `npm run db:studio`) opens a local GUI for browsing
tables once the migration is applied.

No UI or API endpoints touch this schema yet — that's Phase 3+.

import { prisma } from "@/lib/prisma";

/**
 * Multi-tenant query scoping.
 *
 * Every route that touches hotel data should get its Prisma client via
 * `tenantScopedPrisma(session.hotelId)` instead of importing `prisma`
 * directly. This wraps the shared client in a Prisma Client Extension that
 * automatically merges `hotelId` into the `where`/`data` of every query
 * against a tenant-scoped model — so a route can't accidentally leak data
 * across hotels just because a developer forgot a `where: { hotelId }`
 * clause. It's structural enforcement, not a convention you have to
 * remember.
 *
 * WHAT'S AUTOMATICALLY SCOPED:
 * - Reads that take a `where`: findMany, findFirst(OrThrow), count,
 *   aggregate, groupBy — `hotelId` is merged in, and it throws if the
 *   caller explicitly passed a *different* hotelId (a scope violation, not
 *   something to silently overwrite).
 * - Bulk writes: updateMany, deleteMany — same merge-into-`where` behavior.
 * - create / createMany — `hotelId` is stamped onto the row(s) being
 *   inserted.
 *
 * WHAT'S DELIBERATELY *NOT* AUTO-SCOPED — and why:
 * - findUnique / findUniqueOrThrow: Prisma's generated types only allow
 *   unique fields in a `where` here (id, or a `@@unique` combo) — you
 *   can't add an extra `hotelId` filter even if you wanted to, the type
 *   won't allow it. Use `findFirst({ where: { id, hotelId } })` instead
 *   when looking up a tenant-scoped row by id.
 * - update / delete / upsert (single-record): same unique-`where`
 *   restriction as findUnique. For a tenant-scoped single-row mutation,
 *   use `updateMany` / `deleteMany` with `where: { id }` instead (both are
 *   scoped above) — checking `result.count === 1` tells you whether the
 *   row existed *and* belonged to this hotel, which is exactly the
 *   guarantee you want.
 *
 * This convention (updateMany/deleteMany instead of update/delete for
 * tenant-scoped rows) is the trade-off that keeps scoping enforced at the
 * extension level rather than something every call site has to
 * double-check by hand.
 */

const TENANT_SCOPED_MODELS = new Set([
  "RoomType",
  "Room",
  "Employee",
  "Customer",
  "Booking",
  "Housekeeping",
  "RevenueLog",
  "DailyBookingCount",
  "Staff",
]);

const WHERE_SCOPED_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

type PlainObject = Record<string, unknown>;

export function tenantScopedPrisma(hotelId: string) {
  if (!hotelId) {
    throw new Error(
      "tenantScopedPrisma() was called without a hotelId — this almost certainly means a session wasn't checked first."
    );
  }

  return prisma.$extends({
    name: `tenant-scope`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const a = args as PlainObject;

          if (WHERE_SCOPED_OPERATIONS.has(operation)) {
            const existingWhere = (a.where as PlainObject) ?? {};
            if (
              "hotelId" in existingWhere &&
              existingWhere.hotelId !== hotelId
            ) {
              throw new Error(
                `Tenant scope violation: a ${operation} query on ${model} explicitly filtered for a different hotelId than the current session.`
              );
            }
            a.where = { ...existingWhere, hotelId };
          } else if (operation === "create") {
            const data = (a.data as PlainObject) ?? {};
            if ("hotelId" in data && data.hotelId !== hotelId) {
              throw new Error(
                `Tenant scope violation: a create on ${model} targeted a different hotelId than the current session.`
              );
            }
            a.data = { ...data, hotelId };
          } else if (operation === "createMany") {
            const data = (a.data as PlainObject[] | PlainObject) ?? [];
            const rows = Array.isArray(data) ? data : [data];
            a.data = rows.map((row) => {
              if ("hotelId" in row && row.hotelId !== hotelId) {
                throw new Error(
                  `Tenant scope violation: a createMany on ${model} included a row targeting a different hotelId than the current session.`
                );
              }
              return { ...row, hotelId };
            });
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantScopedPrisma = ReturnType<typeof tenantScopedPrisma>;
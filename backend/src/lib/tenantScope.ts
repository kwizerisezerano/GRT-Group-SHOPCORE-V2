import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

/**
 * Every Prisma model carrying a `tenantId` field, derived from the generated
 * data model at startup.
 *
 * This was previously a hand-maintained Set, which failed *open*: adding a
 * model to schema.prisma and forgetting to list it here meant every query
 * against it silently ran unscoped, reading and mutating other tenants' rows
 * with nothing to signal the mistake. Deriving it from the schema makes that
 * class of bug impossible — a new tenant-owned model is scoped the moment it
 * exists.
 */
const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === "tenantId"))
    .map((model) => model.name)
);

export function isTenantScopedModel(model: string): boolean {
  return TENANT_SCOPED_MODELS.has(model);
}

/** Exposed so the test suite can assert the derivation stays honest. */
export function tenantScopedModelNames(): string[] {
  return [...TENANT_SCOPED_MODELS].sort();
}

/**
 * Operations whose `where` clause decides which rows are visible or
 * affected. Constraining `where` is what actually enforces isolation.
 */
const WHERE_SCOPED_OPS: ReadonlySet<string> = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Returns a Prisma client extended so every query against a tenant-scoped
 * model is automatically filtered (reads, where-based writes) or stamped
 * (creates) with `tenantId`. This closes the gap left by Postgres RLS having
 * no MySQL equivalent — see schema.prisma's header comment.
 *
 * Route and service code should never hand-write `where: { tenantId }` or
 * `data: { tenantId }` for these models; take this scoped client instead
 * (see middleware/requireTenant.ts).
 *
 * Known limit — nested writes are not rewritten. A create whose payload
 * contains `{ items: { create: [...] } }` stamps the parent but not the
 * children, because the extension only sees the top-level model. Nested rows
 * on tenant-scoped models must set `tenantId` explicitly or be written in a
 * separate scoped call. A test pins this so the limit stays visible instead
 * of being rediscovered in production.
 */
export function scopedPrisma(tenantId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          // Copy rather than mutate: `args` belongs to the caller, and
          // writing through it leaks scoping into any object they reuse.
          const scoped: Record<string, any> = { ...((args as Record<string, any>) ?? {}) };

          // Compared as a plain string: Prisma's `operation` *type* union is
          // narrower than what it actually dispatches at runtime — it omits
          // createMany, which the integration suite proves does reach this
          // hook. Narrowing to the declared union would silently drop the
          // createMany branch and let bulk inserts write unscoped rows.
          const op: string = operation;

          if (WHERE_SCOPED_OPS.has(op)) {
            scoped.where = { ...(scoped.where ?? {}), tenantId };
          }

          if (op === "create") {
            scoped.data = { ...(scoped.data ?? {}), tenantId };
          }

          if (op === "createMany" || op === "createManyAndReturn") {
            // Prisma accepts a single object here as well as an array. The
            // single-object form used to fall through unstamped, writing a
            // row with no tenant.
            scoped.data = Array.isArray(scoped.data)
              ? scoped.data.map((row: Record<string, unknown>) => ({ ...row, tenantId }))
              : { ...(scoped.data ?? {}), tenantId };
          }

          if (op === "upsert") {
            scoped.create = { ...(scoped.create ?? {}), tenantId };
          }

          return query(scoped);
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof scopedPrisma>;

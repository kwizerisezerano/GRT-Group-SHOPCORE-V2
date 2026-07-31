import { prisma } from "../db/prisma";

/**
 * Prisma model names (PascalCase, as generated) that carry a tenant_id
 * column. There is no way to derive this list from the schema at runtime,
 * so it must be kept in sync by hand: every model added to schema.prisma
 * with a tenantId field needs an entry here too, or queries against it will
 * silently run unscoped.
 */
const TENANT_SCOPED_MODELS = new Set<string>([
  "Profile",
  "TenantMember",
  "UserRole",
  "TenantSubscription",
  "PlatformTenantModuleEntitlement",
  "Brand",
  "Category",
  "Supplier",
  "Product",
  "Customer",
  "Sale",
  "SaleItem",
  "CreditedItem",
  "Purchase",
  "PurchaseItem",
  "ExpiredProduct",
  "Expense",
  "Staff",
  "QaRun",
  "QaScreenshot",
  "QaAuditLog",
  "QaFilterPreset",
  "QaIsolationLeak",
  "QaSetting",
]);

const ARRAY_READ_OPS = new Set(["findMany", "aggregate", "groupBy"]);
const SINGLE_READ_OPS = new Set(["findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count"]);
const MANY_WHERE_WRITE_OPS = new Set(["updateMany", "deleteMany"]);
const SINGLE_WHERE_WRITE_OPS = new Set(["update", "delete", "upsert"]);

/**
 * Returns a Prisma client extended so every query against a tenant-scoped
 * model is automatically filtered/stamped with `tenantId`, closing the gap
 * left by Postgres RLS having no MySQL equivalent (see schema.prisma's
 * header comment). Callers should never need to write `where: { tenantId }`
 * or `data: { tenantId }` by hand again for these models - request this
 * scoped client instead (see middleware/requireTenant.ts).
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

          const scoped: any = args ?? {};

          if (
            ARRAY_READ_OPS.has(operation) ||
            SINGLE_READ_OPS.has(operation) ||
            MANY_WHERE_WRITE_OPS.has(operation) ||
            SINGLE_WHERE_WRITE_OPS.has(operation)
          ) {
            scoped.where = { ...(scoped.where ?? {}), tenantId };
          }

          if (operation === "create") {
            scoped.data = { ...(scoped.data ?? {}), tenantId };
          }

          if (operation === "createMany") {
            scoped.data = Array.isArray(scoped.data)
              ? scoped.data.map((row: any) => ({ ...row, tenantId }))
              : scoped.data;
          }

          if (operation === "upsert") {
            scoped.create = { ...(scoped.create ?? {}), tenantId };
          }

          return query(scoped);
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof scopedPrisma>;

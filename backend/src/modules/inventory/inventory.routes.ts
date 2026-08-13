import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toSnakeCase } from "../../lib/caseMapping";
import { createCrudModule } from "../../lib/crudModuleFactory";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";
import { requireTenant } from "../../middleware/requireTenant";

/**
 * Inventory reference data and the stock ledger.
 *
 * Units are an ordinary catalogue: a tenant's own list of "piece", "kg",
 * "carton" to choose from when describing a product.
 *
 * Stock movements are not. They are the audit trail of every change to stock —
 * written only by the code that actually moves it (lib/stockMovement.ts, inside
 * the transaction that moved it) and never by a client. So this exposes reads
 * and nothing else: a ledger anyone can post to is not a ledger.
 */

const name = z.string().trim().min(1, "Name is required").max(191);

const createUnitSchema = z.object({
  name,
  abbreviation: z.string().trim().max(32).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const unitsRouter = createCrudModule({
  permissions: {
    view: "products.view",
    create: "products.create",
    update: "products.update",
    delete: "products.delete",
  },
  delegate: "unit",
  createSchema: createUnitSchema,
  updateSchema: createUnitSchema.partial(),
  orderBy: { name: "asc" },
  messages: {
    listed: "inventory.unitListed",
    fetched: "inventory.unitFetched",
    created: "inventory.unitCreated",
    updated: "inventory.unitUpdated",
    deleted: "inventory.unitDeleted",
    notFound: "inventory.unitNotFound",
    duplicate: "inventory.unitDuplicate",
  },
});

export const stockMovementsRouter = Router();
stockMovementsRouter.use(requireAuth, requireTenant);

/**
 * An absent filter and a blank one mean the same thing: no filter.
 *
 * A screen with an unselected product dropdown sends `?product_id=`, which is
 * how it says "all products" — and an empty string is not a uuid, so the
 * request came back 400 and the page showed nothing. Blank is normalised to
 * absent before validation rather than after, so the uuid rule only ever sees
 * a value someone actually chose.
 */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * The most rows this endpoint will return in one call.
 *
 * A ledger screen legitimately wants a lot of history at once, so this is
 * generous; it exists to stop one request asking for the whole table.
 */
const MAX_LIMIT = 5_000;

const listQuerySchema = z.object({
  productId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  movementType: z.preprocess(blankToUndefined, z.string().trim().max(32).optional()),
  /*
   * Clamped, not rejected. Asking for more rows than the server will give is
   * not a malformed request — it is a caller who wants as much as it can get,
   * and answering with the maximum is more useful than refusing. Rejecting it
   * meant two screens asking for 5,000 movements got a 400 and rendered
   * nothing at all where the history should have been.
   */
  limit: z.coerce
    .number()
    .int()
    .positive()
    .catch(200)
    .transform((value) => Math.min(value, MAX_LIMIT))
    .default(200),
});

stockMovementsRouter.get(
  "/",
  requirePermission("inventory.view"),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse({
      productId: req.query.productId ?? req.query.product_id,
      movementType: req.query.movementType ?? req.query.movement_type,
      limit: req.query.limit ?? 200,
    });

    const movements = await req.tenantPrisma!.stockMovement.findMany({
      where: {
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.movementType ? { movementType: query.movementType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });

    sendSuccess(res, { messageKey: "inventory.movementListed", data: toSnakeCase(movements) });
  })
);

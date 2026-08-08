import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toSnakeCase } from "../../lib/caseMapping";
import { createCrudModule } from "../../lib/crudModuleFactory";
import { requireAuth } from "../../middleware/auth";
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

const listQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  movementType: z.string().trim().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

stockMovementsRouter.get(
  "/",
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

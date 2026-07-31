import { Request, Router } from "express";
import { ZodTypeAny } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/requireTenant";
import { asyncHandler } from "./asyncHandler";
import { HttpError } from "./httpError";

type CrudModuleOptions = {
  /** Prisma Client property name for this model, e.g. "brand", "category". */
  delegate: string;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  orderBy?: Record<string, "asc" | "desc">;
  /**
   * Optional hook to transform/enrich validated input before it's written
   * (e.g. resolving a display name from a related id). Runs for both create
   * and update.
   */
  beforeWrite?: (input: Record<string, unknown>, req: Request) => Record<string, unknown> | Promise<Record<string, unknown>>;
};

/**
 * Builds a fully-wired tenant-scoped CRUD router (list/get/create/update/
 * delete) for a single Prisma model in a couple of lines. Relies entirely on
 * req.tenantPrisma (see middleware/requireTenant.ts) for tenant isolation -
 * never pass an explicit tenantId filter here, the scoped client already
 * injects it on every operation.
 *
 * Only appropriate for plain master-data CRUD. Anything that mutates stock
 * or drives a multi-step state transition needs bespoke service logic
 * instead (see lib/stockMovement.ts).
 */
export function createCrudModule(options: CrudModuleOptions): Router {
  const router = Router();
  router.use(requireAuth, requireTenant);

  function table(req: Request): any {
    return (req.tenantPrisma as any)[options.delegate];
  }

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const rows = await table(req).findMany({ orderBy: options.orderBy ?? { createdAt: "desc" } });
      res.json({ data: rows });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const row = await table(req).findFirst({ where: { id: req.params.id } });
      if (!row) throw HttpError.notFound();
      res.json({ data: row });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input = options.createSchema.parse(req.body);
      if (options.beforeWrite) input = await options.beforeWrite(input, req);
      const row = await table(req).create({ data: input });
      res.status(201).json({ data: row });
    })
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      let input = options.updateSchema.parse(req.body);
      if (options.beforeWrite) input = await options.beforeWrite(input, req);

      const existing = await table(req).findFirst({ where: { id: req.params.id } });
      if (!existing) throw HttpError.notFound();

      const row = await table(req).update({ where: { id: req.params.id }, data: input });
      res.json({ data: row });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const existing = await table(req).findFirst({ where: { id: req.params.id } });
      if (!existing) throw HttpError.notFound();

      await table(req).delete({ where: { id: req.params.id } });
      res.status(204).send();
    })
  );

  return router;
}

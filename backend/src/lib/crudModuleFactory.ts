import { Prisma } from "@prisma/client";
import { Request, Router } from "express";
import { ZodTypeAny } from "zod";
import { MessageKey } from "../i18n";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/requireTenant";
import { requirePermission } from "../middleware/requirePermission";
import type { Permission } from "./permissions";
import { sendSuccess } from "./apiResponse";
import { toCamelCase, toSnakeCase } from "./caseMapping";
import { asyncHandler } from "./asyncHandler";
import { HttpError } from "./httpError";

type CrudMessages = {
  listed: MessageKey;
  fetched: MessageKey;
  created: MessageKey;
  updated: MessageKey;
  deleted: MessageKey;
  notFound: MessageKey;
  duplicate: MessageKey;
};

type CrudModuleOptions = {
  /** Prisma Client property name for this model, e.g. "brand", "category". */
  delegate: string;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  orderBy?: Record<string, "asc" | "desc">;
  messages: CrudMessages;
  /**
   * Transforms validated input before it is written — resolving a display
   * name from a related id, deriving denormalised columns, encrypting PII.
   * Runs for both create and update; `context.id` is set on update only.
   */
  beforeWrite?: (
    input: Record<string, unknown>,
    req: Request,
    context: { id?: string }
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Shapes a row on the way out — decrypting, hiding internals. */
  serialize?: (row: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Translate the wire format to/from snake_case (see lib/caseMapping.ts).
   * On by default: the frontend consumes snake_case everywhere.
   */
  snakeCaseWire?: boolean;
  /** Runs before delete; the place to refuse when dependants exist. */
  beforeDelete?: (id: string, req: Request) => Promise<void>;
  /**
   * What a caller must be allowed to do to reach each operation.
   *
   * Declared here rather than bolted onto each route so that a module cannot
   * be added with its writes left open by omission — which is exactly how
   * every endpoint in this application ended up callable by every member of a
   * workspace, cashiers included.
   */
  permissions: {
    view: Permission;
    create: Permission;
    update: Permission;
    delete: Permission;
  };
};

/**
 * Names the column(s) a unique-constraint violation was raised on, so the
 * frontend can highlight the offending input rather than just showing a
 * sentence.
 *
 * Prisma reports `meta.target` differently per connector: an array of field
 * names on PostgreSQL, but the *index name* as a single string on MySQL
 * (e.g. "products_tenant_id_sku_key"). Both are handled — reading only the
 * array form silently produced no detail at all on MySQL.
 */
function conflictingFields(
  error: Prisma.PrismaClientKnownRequestError
): { fields: string[] } | null {
  const target = error.meta?.target;

  const raw = Array.isArray(target)
    ? (target as string[])
    : typeof target === "string"
      ? // "<table>_<col>_<col>_key" -> drop the table prefix and the suffix.
        target.replace(/_key$/, "").split("_").slice(1)
      : [];

  const fields = raw
    // tenant_id is on every index here and is never the user's mistake.
    .filter((token) => token !== "tenant" && token !== "id" && token !== "tenant_id")
    // The constraint lives on the blind index or the ciphertext, but the
    // field the user actually filled in is "phone", not "phone_hash".
    .filter((token) => token !== "hash" && token !== "encrypted");

  return fields.length > 0 ? { fields } : null;
}

/**
 * Builds a fully-wired, tenant-scoped CRUD router (list/get/create/update/
 * delete) for one Prisma model.
 *
 * Isolation comes entirely from req.tenantPrisma (middleware/requireTenant.ts)
 * — never pass an explicit tenantId filter here, the scoped client injects it
 * on every operation.
 *
 * Only appropriate for plain master data. Anything that mutates stock or
 * drives a multi-step state transition needs bespoke service logic instead.
 */
export function createCrudModule(options: CrudModuleOptions): Router {
  const router = Router();
  router.use(requireAuth, requireTenant);

  const can = (permission: Permission) => requirePermission(permission);

  const snakeWire = options.snakeCaseWire ?? true;
  const custom = options.serialize ?? ((row: Record<string, unknown>) => row);
  const serialize = (row: Record<string, unknown>) => {
    const shaped = custom(row);
    return snakeWire ? toSnakeCase(shaped) : shaped;
  };
  const readBody = (body: unknown) => (snakeWire ? toCamelCase(body) : body);

  function table(req: Request): any {
    return (req.tenantPrisma as any)[options.delegate];
  }

  /**
   * Turns a unique-constraint violation into a 409 with a readable message.
   * The database is the only thing that can decide this reliably — checking
   * first and inserting after is a race two concurrent requests lose.
   */
  function rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw HttpError.conflict(options.messages.duplicate, {
        code: "duplicate_record",
        details: conflictingFields(error) ?? undefined,
      });
    }
    throw error;
  }

  router.get(
    "/",
    can(options.permissions.view),
    asyncHandler(async (req, res) => {
      const rows: Record<string, unknown>[] = await table(req).findMany({
        orderBy: options.orderBy ?? { createdAt: "desc" },
      });
      sendSuccess(res, { messageKey: options.messages.listed, data: rows.map(serialize) });
    })
  );

  router.get(
    "/:id",
    can(options.permissions.view),
    asyncHandler(async (req, res) => {
      const row = await table(req).findFirst({ where: { id: req.params.id } });
      if (!row) throw HttpError.notFound(options.messages.notFound);
      sendSuccess(res, { messageKey: options.messages.fetched, data: serialize(row) });
    })
  );

  router.post(
    "/",
    can(options.permissions.create),
    asyncHandler(async (req, res) => {
      let input = options.createSchema.parse(readBody(req.body)) as Record<string, unknown>;
      if (options.beforeWrite) input = await options.beforeWrite(input, req, {});

      try {
        const row = await table(req).create({ data: input });
        sendSuccess(res, {
          messageKey: options.messages.created,
          data: serialize(row),
          status: 201,
        });
      } catch (error) {
        rethrow(error);
      }
    })
  );

  router.patch(
    "/:id",
    can(options.permissions.update),
    asyncHandler(async (req, res) => {
      let input = options.updateSchema.parse(readBody(req.body)) as Record<string, unknown>;

      // Existence is checked through the scoped client, so another tenant's
      // id reads as "not found" rather than confirming that it exists.
      const existing = await table(req).findFirst({ where: { id: req.params.id } });
      if (!existing) throw HttpError.notFound(options.messages.notFound);

      if (options.beforeWrite) {
        input = await options.beforeWrite(input, req, { id: req.params.id });
      }

      try {
        const row = await table(req).update({ where: { id: req.params.id }, data: input });
        sendSuccess(res, { messageKey: options.messages.updated, data: serialize(row) });
      } catch (error) {
        rethrow(error);
      }
    })
  );

  router.delete(
    "/:id",
    can(options.permissions.delete),
    asyncHandler(async (req, res) => {
      const existing = await table(req).findFirst({ where: { id: req.params.id } });
      if (!existing) throw HttpError.notFound(options.messages.notFound);

      if (options.beforeDelete) await options.beforeDelete(req.params.id, req);

      await table(req).delete({ where: { id: req.params.id } });
      // 200 with a message rather than 204: requirement 8 asks every response
      // to explain what happened, and a 204 body is discarded by definition.
      sendSuccess(res, { messageKey: options.messages.deleted });
    })
  );

  return router;
}

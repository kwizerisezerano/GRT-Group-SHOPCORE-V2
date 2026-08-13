import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toCamelCase, toSnakeCase } from "../../lib/caseMapping";
import { decryptNullable, encryptNullable } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";
import { requireTenant } from "../../middleware/requireTenant";
import { runInScopedTransaction } from "../../lib/transaction";

/**
 * Branches — the shops, outlets, warehouses and sites a workspace operates
 * from.
 *
 * ## Why this is not built on createCrudModule
 *
 * Every other piece of master data is, and this one nearly was. What stopped
 * it is `is_default`: a workspace has exactly one primary location, and MySQL
 * cannot express "at most one row where this column is true". So something has
 * to maintain the rule, and where that something runs decides whether the rule
 * actually holds.
 *
 * The factory's `beforeWrite` hook runs *before* the write, in its own
 * statement. Clearing the old default there and setting the new one in the
 * create that follows leaves a window: two admins ticking the box at the same
 * moment both clear, then both set, and the workspace ends up with two primary
 * branches — or, if the second write fails its unique-name check, with none.
 *
 * Here the clear and the set are one transaction, so the invariant holds
 * through concurrency and through failure. That is the whole reason for the
 * extra ~150 lines; everything else below mirrors the factory deliberately.
 *
 * The frontend used to do this itself — an `update(...).eq("tenant_id")` to
 * clear, then an insert — which is two round trips and no atomicity at all.
 * It now sends one request and the invariant is the server's problem.
 *
 * ## Encryption
 *
 * A branch phone and email are personal data even though they belong to a
 * place: in practice they are the manager's phone and the manager's inbox. So
 * they are encrypted at rest like customers and suppliers. No blind index —
 * nothing looks a branch up by phone, and an index nobody queries is a key
 * derivation and a column for no benefit.
 */

const branchesRouter = Router();
branchesRouter.use(requireAuth, requireTenant);

/**
 * Branches own their own permission pair rather than borrowing settings'.
 *
 * They nearly borrowed it, and the test caught why that was wrong: a cashier
 * has no `settings.view`, so gating the list on it locked the till out of the
 * one question it must answer before it can sell anything — which shop am I.
 * Reading the branch list is not a settings privilege, so `branches.view` goes
 * to every role. Deciding what shops exist is administrative, so
 * `branches.manage` stops at admin, alongside `settings.update`.
 */
const VIEW = "branches.view" as const;
const MANAGE = "branches.manage" as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value));

const createSchema = z.object({
  name: z
    .string({ required_error: "Branch name is required" })
    .trim()
    .min(1, "Branch name is required")
    .max(191, "Branch name must be 191 characters or fewer"),
  code: optionalText(64),
  manager: optionalText(191),
  phone: optionalText(32),
  email: z
    .string()
    .trim()
    .email("Must be a valid email address")
    .max(191)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  address: optionalText(2000),
  city: optionalText(191),
  type: optionalText(32),
  status: z.enum(["active", "inactive"]).default("active"),
  /*
   * Accepted as a date-only string ("2026-08-11") as well as a full timestamp,
   * because that is what a `<input type="date">` sends. Coercing here rather
   * than in the client keeps every caller — web, desktop, replayed offline
   * queue — on the same rule.
   */
  openingDate: z
    .union([z.string().trim(), z.date(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }),
  operatingHours: optionalText(191),
  taxNumber: optionalText(64),
  notes: optionalText(2000),
  isDefault: z.coerce.boolean().default(false),
});

const updateSchema = createSchema.partial();

type BranchRow = Record<string, unknown>;

/** Encrypts what needs encrypting, touching only keys the caller supplied. */
function toColumns(input: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...input };

  if ("phone" in data) {
    data.phoneEncrypted = encryptNullable(data.phone as string | null);
    delete data.phone;
  }

  if ("email" in data) {
    data.emailEncrypted = encryptNullable(data.email as string | null);
    delete data.email;
  }

  // Maintained by the routes below, never written straight from a payload.
  delete data.isDefault;

  return data;
}

/** Turns a stored row back into the shape the frontend reads. */
function serialize(row: BranchRow): Record<string, unknown> {
  const { phoneEncrypted, emailEncrypted, ...rest } = row;

  return toSnakeCase({
    ...rest,
    phone: decryptNullable(phoneEncrypted as string | null),
    email: decryptNullable(emailEncrypted as string | null),
  });
}

/** A duplicate name is the only unique constraint here, and it is the user's. */
function rethrow(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw HttpError.conflict("branches.duplicate", {
      code: "duplicate_record",
      details: { fields: ["name"] },
    });
  }
  throw error;
}

branchesRouter.get(
  "/",
  requirePermission(VIEW),
  asyncHandler(async (req, res) => {
    const rows = await req.tenantPrisma!.branch.findMany({
      // Default first, then alphabetically: the primary location is the one
      // every screen wants pre-selected, so it should not have to be hunted.
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    sendSuccess(res, { messageKey: "branches.listed", data: rows.map(serialize) });
  })
);

branchesRouter.get(
  "/:id",
  requirePermission(VIEW),
  asyncHandler(async (req, res) => {
    const row = await req.tenantPrisma!.branch.findFirst({ where: { id: req.params.id } });
    if (!row) throw HttpError.notFound("branches.notFound");

    sendSuccess(res, { messageKey: "branches.fetched", data: serialize(row) });
  })
);

branchesRouter.post(
  "/",
  requirePermission(MANAGE),
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(toCamelCase(req.body)) as Record<string, unknown>;
    const wantsDefault = input.isDefault === true;
    const data = toColumns(input);

    try {
      const row = await runInScopedTransaction(req.tenantPrisma!, async (tx) => {
        /*
         * The first branch a workspace creates is its default whether or not
         * anyone ticked the box. Without this a fresh workspace has branches
         * and no primary one, and every screen that asks "which branch am I"
         * gets no answer until somebody notices the checkbox.
         */
        const existing = await tx.branch.count();
        const isDefault = wantsDefault || existing === 0;

        if (isDefault && existing > 0) {
          await tx.branch.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        }

        /*
         * Cast because the generated input type insists on `tenantId`, which
         * this code must never supply: the scoping extension stamps it, and
         * hand-writing it here is exactly the mistake lib/tenantScope.ts
         * exists to make impossible. Zod has already checked the shape.
         */
        return tx.branch.create({ data: { ...data, isDefault } as never });
      });

      sendSuccess(res, { messageKey: "branches.created", data: serialize(row), status: 201 });
    } catch (error) {
      rethrow(error);
    }
  })
);

branchesRouter.patch(
  "/:id",
  requirePermission(MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(toCamelCase(req.body)) as Record<string, unknown>;
    const data = toColumns(input);

    try {
      const row = await runInScopedTransaction(req.tenantPrisma!, async (tx) => {
        // Read through the scoped client, so another workspace's id reads as
        // "not found" rather than confirming that it exists.
        const existing = await tx.branch.findFirst({ where: { id: req.params.id } });
        if (!existing) throw HttpError.notFound("branches.notFound");

        /*
         * `is_default` is one-way through this route: ticking the box promotes
         * this branch, unticking it does nothing. Demoting the default without
         * naming a replacement would leave the workspace with no primary
         * location at all, which is not a state any screen can render — so the
         * only way to move the flag is to promote something else.
         */
        if (input.isDefault === true && !existing.isDefault) {
          await tx.branch.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
          return tx.branch.update({
            where: { id: req.params.id },
            data: { ...data, isDefault: true },
          });
        }

        return tx.branch.update({ where: { id: req.params.id }, data });
      });

      sendSuccess(res, { messageKey: "branches.updated", data: serialize(row) });
    } catch (error) {
      rethrow(error);
    }
  })
);

branchesRouter.delete(
  "/:id",
  requirePermission(MANAGE),
  asyncHandler(async (req, res) => {
    await runInScopedTransaction(req.tenantPrisma!, async (tx) => {
      const existing = await tx.branch.findFirst({ where: { id: req.params.id } });
      if (!existing) throw HttpError.notFound("branches.notFound");

      /*
       * The default branch can be deleted, but only once it is no longer the
       * default — refusing with an explanation beats silently promoting some
       * other branch behind the admin's back, which is the kind of thing
       * nobody notices until stock lands in the wrong shop.
       *
       * The last branch is exempt: deleting it leaves zero branches, and zero
       * is a coherent state (a workspace that has not set any up yet).
       */
      if (existing.isDefault) {
        const others = await tx.branch.count({ where: { id: { not: req.params.id } } });
        if (others > 0) {
          throw HttpError.conflict("branches.defaultInUse", { code: "default_branch" });
        }
      }

      await tx.branch.delete({ where: { id: req.params.id } });
    });

    sendSuccess(res, { messageKey: "branches.deleted" });
  })
);

export { branchesRouter };

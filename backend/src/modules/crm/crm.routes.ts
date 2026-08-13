import { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import {
  decryptNullable,
  emailBlindIndexNullable,
  encrypt,
  encryptNullable,
  phoneBlindIndexNullable,
} from "../../lib/crypto";
import { createCrudModule } from "../../lib/crudModuleFactory";
import { HttpError } from "../../lib/httpError";

/**
 * Customers, suppliers and expenses.
 *
 * Customers and suppliers hold personal data — a name, phone, email and
 * address belonging to a real person — so unlike the product catalogue they
 * are encrypted at rest. The plaintext never reaches a column: beforeWrite
 * encrypts and derives the lookup hashes, serialize decrypts on the way out,
 * and the rest of the module is unchanged. That the same factory handles
 * both an unencrypted and an encrypted resource is the point of putting the
 * transformation in hooks rather than in the routes.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value));

const requiredName = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(191, "Name must be 191 characters or fewer");

const money = z
  .number({ invalid_type_error: "Must be a number" })
  .nonnegative("Cannot be negative")
  .max(99_999_999_999.99, "Value is too large");

// ------------------------------------------------------------------ shared
/**
 * Encrypts the party fields shared by customers and suppliers, and derives
 * the blind indexes the unique constraints are built on.
 *
 * Only touches keys the caller actually supplied, so a PATCH that changes
 * only a phone number does not blank out the email.
 */
function encryptPartyFields(input: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...input };

  if ("name" in data) {
    data.nameEncrypted = encrypt(String(data.name));
    delete data.name;
  }

  if ("phone" in data) {
    const phone = data.phone as string | null;
    data.phoneEncrypted = encryptNullable(phone);
    data.phoneHash = phoneBlindIndexNullable(phone);
    delete data.phone;
  }

  if ("email" in data) {
    const email = data.email as string | null;
    data.emailEncrypted = encryptNullable(email);
    data.emailHash = emailBlindIndexNullable(email);
    delete data.email;
  }

  if ("address" in data) {
    data.addressEncrypted = encryptNullable(data.address as string | null);
    delete data.address;
  }

  return data;
}

/** Turns the stored ciphertext back into the shape the frontend expects. */
function decryptPartyFields(row: Record<string, unknown>): Record<string, unknown> {
  const {
    nameEncrypted,
    phoneEncrypted,
    emailEncrypted,
    addressEncrypted,
    // Hashes are an internal lookup mechanism; they are not the caller's
    // business and leak nothing useful, so they never go out.
    phoneHash,
    emailHash,
    ...rest
  } = row;

  return {
    ...rest,
    name: decryptNullable(nameEncrypted as string | null),
    phone: decryptNullable(phoneEncrypted as string | null),
    email: decryptNullable(emailEncrypted as string | null),
    address: decryptNullable(addressEncrypted as string | null),
  };
}

const partyShape = {
  name: requiredName,
  phone: optionalText(32),
  email: z
    .string()
    .trim()
    .email("Must be a valid email address")
    .max(191)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  address: optionalText(1000),
};

// --------------------------------------------------------------- customers
const createCustomerSchema = z.object({
  ...partyShape,
  loyaltyPoints: z.number().int().min(0).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const customersRouter = createCrudModule({
  permissions: {
    view: "customers.view",
    create: "customers.create",
    update: "customers.update",
    delete: "customers.delete",
  },
  delegate: "customer",
  createSchema: createCustomerSchema,
  updateSchema: createCustomerSchema.partial(),
  orderBy: { createdAt: "desc" },
  beforeWrite: (input) => encryptPartyFields(input),
  serialize: decryptPartyFields,
  messages: {
    listed: "crm.customerListed",
    fetched: "crm.customerFetched",
    created: "crm.customerCreated",
    updated: "crm.customerUpdated",
    deleted: "crm.customerDeleted",
    notFound: "crm.customerNotFound",
    duplicate: "crm.customerDuplicate",
  },
});

// --------------------------------------------------------------- suppliers
const createSupplierSchema = z.object(partyShape);

export const suppliersRouter = createCrudModule({
  permissions: {
    view: "suppliers.view",
    create: "suppliers.create",
    update: "suppliers.update",
    delete: "suppliers.delete",
  },
  delegate: "supplier",
  createSchema: createSupplierSchema,
  updateSchema: createSupplierSchema.partial(),
  orderBy: { createdAt: "desc" },
  beforeWrite: (input) => encryptPartyFields(input),
  serialize: decryptPartyFields,
  async beforeDelete(id: string, req: Request) {
    // Purchases carry a real foreign key to suppliers, so deleting one with
    // history would either fail at the database with an opaque error or
    // orphan the purchase. Refuse it with an explanation instead.
    const purchases = await req.tenantPrisma!.purchase.count({ where: { supplierId: id } });
    if (purchases > 0) {
      throw HttpError.conflict("crm.supplierInUse", {
        code: "record_in_use",
        details: { purchases },
      });
    }
  },
  messages: {
    listed: "crm.supplierListed",
    fetched: "crm.supplierFetched",
    created: "crm.supplierCreated",
    updated: "crm.supplierUpdated",
    deleted: "crm.supplierDeleted",
    notFound: "crm.supplierNotFound",
    duplicate: "crm.supplierDuplicate",
  },
});

// ---------------------------------------------------------------- expenses
const createExpenseSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(191),
  amount: money.default(0),
  category: optionalText(191),
  notes: optionalText(2000),
});

export const expensesRouter = createCrudModule({
  permissions: {
    view: "expenses.view",
    create: "expenses.create",
    update: "expenses.update",
    delete: "expenses.delete",
  },
  delegate: "expense",
  createSchema: createExpenseSchema,
  updateSchema: createExpenseSchema.partial(),
  orderBy: { createdAt: "desc" },
  messages: {
    listed: "crm.expenseListed",
    fetched: "crm.expenseFetched",
    created: "crm.expenseCreated",
    updated: "crm.expenseUpdated",
    deleted: "crm.expenseDeleted",
    notFound: "crm.expenseNotFound",
    duplicate: "crm.expenseDuplicate",
  },
});

export const crmRouter = Router();
crmRouter.use("/customers", customersRouter);
crmRouter.use("/suppliers", suppliersRouter);
crmRouter.use("/expenses", expensesRouter);

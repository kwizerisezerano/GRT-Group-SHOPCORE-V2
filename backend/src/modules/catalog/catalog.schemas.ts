import { z } from "zod";

/**
 * Validation for the product catalogue (requirement 4).
 *
 * Two conventions used throughout:
 *
 * - Optional text is `trim()`ed and empty strings are normalised to null. A
 *   form that submits "" for an untouched field must not write an empty
 *   string where the column means "not set" — and, for SKU/barcode, must not
 *   collide with every other blank one under the unique index.
 * - Update schemas are `.partial()` of create, so PATCH accepts any subset
 *   while every supplied field still gets the same rules as on create.
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

const wholeNumber = z
  .number({ invalid_type_error: "Must be a number" })
  .int("Must be a whole number")
  .min(0, "Cannot be negative");

const uuid = z.string().uuid("Must be a valid id");

// ----------------------------------------------------------------- category
export const createCategorySchema = z.object({
  name: requiredName,
  description: optionalText(2000),
});
export const updateCategorySchema = createCategorySchema.partial();

// -------------------------------------------------------------------- brand
export const createBrandSchema = z.object({
  name: requiredName,
});
export const updateBrandSchema = createBrandSchema.partial();

// ------------------------------------------------------------------ product
export const createProductSchema = z.object({
  name: requiredName,
  sku: optionalText(64),
  barcode: optionalText(64),
  categoryId: uuid.optional().nullable(),
  brandId: uuid.optional().nullable(),
  supplierId: uuid.optional().nullable(),
  costPrice: money.default(0),
  sellingPrice: money.default(0),
  stockQuantity: wholeNumber.default(0),
  minStockLevel: wholeNumber.default(5),
  taxRate: z.number().min(0).max(100, "Tax rate must be between 0 and 100").default(0),
  imageUrl: optionalText(512),
  description: optionalText(5000),
  unit: optionalText(32),
  /*
   * Accepts the stock-derived values the UI sends today as well as the
   * lifecycle ones. out_of_stock/low_stock are recomputed server-side from
   * the actual quantity (see catalog.routes.ts), so whatever a client sends
   * for those is advisory - the stock level decides.
   */
  status: z
    .enum(["active", "inactive", "discontinued", "out_of_stock", "low_stock"])
    .default("active"),
  // Accepts an ISO date string and hands Prisma a Date.
  expiryDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD date"))
    .optional()
    .nullable()
    .transform((value) => (value ? new Date(value) : null)),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;

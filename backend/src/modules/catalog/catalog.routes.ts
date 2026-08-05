import { Request, Router } from "express";
import { createCrudModule } from "../../lib/crudModuleFactory";
import { HttpError } from "../../lib/httpError";
import {
  createBrandSchema,
  createCategorySchema,
  createProductSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateProductSchema,
} from "./catalog.schemas";

/**
 * Product catalogue: categories, brands and products.
 *
 * All three are tenant-scoped master data, so they are built on
 * createCrudModule rather than hand-rolled. The product router adds
 * referential checks and denormalisation that the generic factory cannot
 * know about, through its beforeWrite hook.
 */

/**
 * Refuses to delete a master-data row that products still point at.
 *
 * The schema deliberately does not put a foreign key on products.categoryId
 * (it is a soft reference, nullable, and rows predate the constraint), so
 * without this check a delete would silently orphan every product's
 * category — exactly the "avoid orphan records" failure requirement 2 names.
 */
function refuseWhenReferenced(field: "categoryId" | "brandId", messageKey: Parameters<typeof HttpError.conflict>[0]) {
  return async (id: string, req: Request) => {
    const inUse = await req.tenantPrisma!.product.count({ where: { [field]: id } as never });
    if (inUse > 0) {
      throw HttpError.conflict(messageKey, {
        code: "record_in_use",
        details: { products: inUse },
      });
    }
  };
}

export const categoriesRouter = createCrudModule({
  delegate: "category",
  createSchema: createCategorySchema,
  updateSchema: updateCategorySchema,
  orderBy: { name: "asc" },
  beforeDelete: refuseWhenReferenced("categoryId", "catalog.categoryInUse"),
  messages: {
    listed: "catalog.categoryListed",
    fetched: "catalog.categoryFetched",
    created: "catalog.categoryCreated",
    updated: "catalog.categoryUpdated",
    deleted: "catalog.categoryDeleted",
    notFound: "catalog.categoryNotFound",
    duplicate: "catalog.categoryDuplicate",
  },
});

export const brandsRouter = createCrudModule({
  delegate: "brand",
  createSchema: createBrandSchema,
  updateSchema: updateBrandSchema,
  orderBy: { name: "asc" },
  beforeDelete: refuseWhenReferenced("brandId", "catalog.brandInUse"),
  messages: {
    listed: "catalog.brandListed",
    fetched: "catalog.brandFetched",
    created: "catalog.brandCreated",
    updated: "catalog.brandUpdated",
    deleted: "catalog.brandDeleted",
    notFound: "catalog.brandNotFound",
    duplicate: "catalog.brandDuplicate",
  },
});

export const productsRouter = createCrudModule({
  delegate: "product",
  createSchema: createProductSchema,
  updateSchema: updateProductSchema,
  orderBy: { createdAt: "desc" },
  messages: {
    listed: "catalog.productListed",
    fetched: "catalog.productFetched",
    created: "catalog.productCreated",
    updated: "catalog.productUpdated",
    deleted: "catalog.productDeleted",
    notFound: "catalog.productNotFound",
    duplicate: "catalog.productDuplicate",
  },

  async beforeWrite(input, req, { id }) {
    const db = req.tenantPrisma!;
    const data = { ...input };

    /*
     * categoryId/brandId are the source of truth; the denormalised name
     * columns are derived here and nowhere else, so they cannot drift from
     * the row they describe. Looking the row up through the tenant-scoped
     * client also validates it: another tenant's category id simply does not
     * resolve, so it is rejected rather than silently linked.
     */
    if ("categoryId" in data) {
      if (data.categoryId) {
        const category = await db.category.findFirst({ where: { id: data.categoryId as string } });
        if (!category) {
          throw HttpError.badRequest("catalog.invalidCategory", { code: "invalid_category" });
        }
        data.category = category.name;
        data.categoryName = category.name;
      } else {
        data.category = null;
        data.categoryName = null;
      }
    }

    if ("brandId" in data) {
      if (data.brandId) {
        const brand = await db.brand.findFirst({ where: { id: data.brandId as string } });
        if (!brand) {
          throw HttpError.badRequest("catalog.invalidBrand", { code: "invalid_brand" });
        }
        data.brand = brand.name;
      } else {
        data.brand = null;
      }
    }

    /*
     * The two legacy stock columns are kept in lockstep. `stock`/`minStock`
     * predate `stockQuantity`/`minStockLevel`; the UI still reads the older
     * pair first. Writing both from one input is what stops a product from
     * reporting two different stock levels depending on who asks.
     */
    if ("stockQuantity" in data) data.stock = data.stockQuantity;
    if ("minStockLevel" in data) data.minStock = data.minStockLevel;

    /*
     * Stock status is derived, not trusted. The UI used to compute
     * out_of_stock/low_stock itself before writing, which meant the value
     * was only correct if every client agreed on the rule and nothing else
     * ever changed the quantity. Deriving it here makes the stored status a
     * function of the stored quantity, whatever the caller sent.
     *
     * Explicit lifecycle states (inactive, discontinued) are a deliberate
     * choice about the product rather than a fact about its stock, so they
     * win over the derived value.
     */
    const lifecycle = data.status === "inactive" || data.status === "discontinued";
    if (!lifecycle) {
      const current = id ? await db.product.findFirst({ where: { id } }) : null;

      const quantity = Number(
        data.stockQuantity ?? current?.stockQuantity ?? 0
      );
      const threshold = Number(
        data.minStockLevel ?? current?.minStockLevel ?? 0
      );

      if (quantity <= 0) {
        data.status = "out_of_stock";
      } else if (threshold > 0 && quantity <= threshold) {
        data.status = "low_stock";
      } else {
        data.status = "active";
      }
    }

    return data;
  },
});

export const catalogRouter = Router();
catalogRouter.use("/categories", categoriesRouter);
catalogRouter.use("/brands", brandsRouter);
catalogRouter.use("/products", productsRouter);

-- Catalogue uniqueness (requirement 2: "ensure zero duplication using
-- unique constraints").
--
-- All scoped per tenant, never globally: two businesses on the platform may
-- legitimately stock the same barcode or name their category "Beverages".
-- MySQL allows repeated NULLs in a unique index, so products without a SKU
-- or barcode are unaffected.

-- CreateIndex
CREATE UNIQUE INDEX `brands_tenant_id_name_key` ON `brands`(`tenant_id`, `name`);

-- CreateIndex
CREATE UNIQUE INDEX `categories_tenant_id_name_key` ON `categories`(`tenant_id`, `name`);

-- CreateIndex
CREATE UNIQUE INDEX `products_tenant_id_sku_key` ON `products`(`tenant_id`, `sku`);

-- CreateIndex
CREATE UNIQUE INDEX `products_tenant_id_barcode_key` ON `products`(`tenant_id`, `barcode`);


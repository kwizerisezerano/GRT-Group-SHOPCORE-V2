-- Bring stock_movements under tenant scoping.
--
-- The table had no tenant_id, so it was invisible to the tenant-scoping
-- extension (lib/tenantScope.ts derives its model list from that field's
-- presence). Every read and write ran unscoped: one business could read
-- another's stock history, and nothing stamped ownership on insert.
--
-- The table is empty in every environment, so the column is added NOT NULL
-- directly. If yours is not, populate tenant_id before applying this.

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `tenant_id` CHAR(36) NOT NULL;

-- CreateIndex
CREATE INDEX `stock_movements_tenant_id_idx` ON `stock_movements`(`tenant_id`);

-- CreateIndex
CREATE INDEX `stock_movements_product_id_idx` ON `stock_movements`(`product_id`);

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

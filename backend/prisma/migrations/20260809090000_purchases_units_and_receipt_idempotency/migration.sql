-- Goods receipts and units of measure, on MySQL rather than Supabase.
--
-- Purchases gain the same replay protection sales have. A receipt recorded
-- twice inflates stock exactly as surely as a sale recorded twice deflates it,
-- and a warehouse syncing a day's deliveries after an outage is the case where
-- that happens. `client_request_id` is chosen when the receipt is first
-- attempted and reused for every retry; the unique index is the guarantee.
--
-- `purchase_no` becomes unique per tenant for the same reason invoice numbers
-- are: two receipts sharing a number cannot be reconciled against a supplier's
-- statement.
--
-- `cost_after` records what the product's moving average cost became once the
-- receipt was applied, so a margin figure can be explained later — the number a
-- report used is the number that was true then, not whatever it is now.
--
-- `units` is a new table. The Units page had no backend at all and read from
-- Supabase. Products keep their unit as a plain string: a unit is a label on
-- the product, and pointing it at a row that can be renamed or deleted
-- underneath it buys nothing.

-- AlterTable
ALTER TABLE `purchase_items` ADD COLUMN `cost_after` DECIMAL(14, 2) NULL;

-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `client_request_id` VARCHAR(64) NULL,
    ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `source` VARCHAR(16) NULL DEFAULT 'online';

-- Existing receipts happened as they were recorded. Stated explicitly so
-- reports over `completed_at` do not silently skip everything older.
UPDATE `purchases` SET `source` = 'online' WHERE `source` IS NULL;
UPDATE `purchases` SET `completed_at` = `purchase_date` WHERE `completed_at` IS NULL;

-- Rename duplicates before constraining, so this migration cannot fail partway
-- against existing data and leave the P3009 state documented in
-- docs/LOCAL-DEV.md. The receipt itself really happened; only its number is
-- wrong, so it is renamed rather than deleted.
UPDATE `purchases` `p`
JOIN (
    SELECT `id`,
           ROW_NUMBER() OVER (
               PARTITION BY `tenant_id`, `purchase_no` ORDER BY `created_at`, `id`
           ) AS `rn`
    FROM `purchases`
    WHERE `purchase_no` IS NOT NULL
) `d` ON `d`.`id` = `p`.`id`
SET `p`.`purchase_no` = CONCAT(LEFT(`p`.`purchase_no`, 55), '-D', `d`.`rn`)
WHERE `d`.`rn` > 1;

-- CreateIndex
CREATE UNIQUE INDEX `purchases_tenant_id_purchase_no_key` ON `purchases`(`tenant_id`, `purchase_no`);

-- CreateIndex
CREATE UNIQUE INDEX `purchases_tenant_id_client_request_id_key` ON `purchases`(`tenant_id`, `client_request_id`);

-- CreateTable
CREATE TABLE `units` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `abbreviation` VARCHAR(32) NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `units_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `units_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

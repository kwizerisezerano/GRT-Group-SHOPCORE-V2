-- Make invoice numbers unique, and allocate them from a counter.
--
-- Invoice numbers were derived from "how many sales exist today, plus one".
-- That is correct only while requests arrive one at a time. An integration
-- test putting eight checkouts in flight at once got five distinct numbers for
-- eight sales: every concurrent pair read the same count and both claimed it.
-- Two sales sharing an invoice number is an accounting record that cannot be
-- reconciled.
--
-- The fix is a counter row per tenant per day, incremented inside the sale's
-- own transaction, plus a unique constraint so the database refuses a
-- duplicate even if the allocator is ever wrong again.
--
-- The steps below are ordered so this migration cannot fail partway on a
-- database that already contains duplicates. Adding the unique index first
-- would abort against existing data and leave a failed row in
-- _prisma_migrations, which blocks every later migration with P3009 - the
-- failure mode documented in docs/LOCAL-DEV.md, and not one to inflict again.

-- CreateTable
CREATE TABLE `invoice_counters` (
    `tenant_id` CHAR(36) NOT NULL,
    `period` VARCHAR(16) NOT NULL,
    `last_value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`tenant_id`, `period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoice_counters` ADD CONSTRAINT `invoice_counters_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename any duplicates already recorded, keeping the earliest sale's number
-- and suffixing the rest. Renaming rather than deleting: a duplicate number is
-- a bookkeeping error, but the sale itself really happened and its stock
-- movements are real. `invoice_no` is VARCHAR(64), so the original is trimmed
-- to leave room for the suffix.
UPDATE `sales` `s`
JOIN (
    SELECT `id`,
           ROW_NUMBER() OVER (
               PARTITION BY `tenant_id`, `invoice_no` ORDER BY `created_at`, `id`
           ) AS `rn`
    FROM `sales`
) `d` ON `d`.`id` = `s`.`id`
SET `s`.`invoice_no` = CONCAT(LEFT(`s`.`invoice_no`, 55), '-D', `d`.`rn`)
WHERE `d`.`rn` > 1;

-- DropIndex
-- Superseded by the unique index below, which serves the same lookups.
DROP INDEX `sales_invoice_no_idx` ON `sales`;

-- CreateIndex
-- Per tenant: two businesses may each legitimately have an INV-...-0001.
CREATE UNIQUE INDEX `sales_tenant_id_invoice_no_key` ON `sales`(`tenant_id`, `invoice_no`);

-- Start each counter from the highest number already issued, so numbering
-- continues where it left off. Without this the first sale after deploying
-- would ask for 0001, find it taken, and fail against the constraint just
-- added. Only well-formed INV-YYYYMMDD-N numbers are considered; the renamed
-- duplicates above no longer match, which is correct - they were never
-- legitimately allocated.
INSERT INTO `invoice_counters` (`tenant_id`, `period`, `last_value`)
SELECT `tenant_id`,
       SUBSTRING(`invoice_no`, 5, 8) AS `period`,
       MAX(CAST(SUBSTRING(`invoice_no`, 14) AS UNSIGNED)) AS `last_value`
FROM `sales`
WHERE `invoice_no` REGEXP '^INV-[0-9]{8}-[0-9]+$'
GROUP BY `tenant_id`, SUBSTRING(`invoice_no`, 5, 8);

-- AlterTable
ALTER TABLE `subscription_plans` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `subscription_invoice_counters` (
    `period` VARCHAR(6) NOT NULL,
    `last_value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


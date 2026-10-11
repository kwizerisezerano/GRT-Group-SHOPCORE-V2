-- Receipts for settled subscription payments.
--
-- The subscription_plans line below is unrelated drift, folded in here rather
-- than left to reappear in every future diff: an earlier migration added a DB
-- default for updated_at so it could backfill existing rows. Prisma sets
-- updatedAt on every write itself, so removing the default changes nothing for
-- application traffic.

-- AlterTable
ALTER TABLE `subscription_plans` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `subscription_invoices` (
    `id` CHAR(36) NOT NULL,
    `invoice_no` VARCHAR(32) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `subscription_id` CHAR(36) NULL,
    `transaction_id` CHAR(36) NOT NULL,
    `plan_code` VARCHAR(64) NOT NULL,
    `plan_name` VARCHAR(191) NOT NULL,
    `billing_cycle` VARCHAR(16) NOT NULL,
    `billing_months` INTEGER NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'RWF',
    `payment_method_code` VARCHAR(64) NOT NULL,
    `payment_method_name` VARCHAR(191) NOT NULL,
    `provider_txn_id` VARCHAR(128) NULL,
    `paid_at` DATETIME(3) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `emailed_at` DATETIME(3) NULL,
    `sms_sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subscription_invoices_invoice_no_key`(`invoice_no`),
    UNIQUE INDEX `subscription_invoices_transaction_id_key`(`transaction_id`),
    INDEX `subscription_invoices_tenant_id_issued_at_idx`(`tenant_id`, `issued_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscription_invoices` ADD CONSTRAINT `subscription_invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_invoices` ADD CONSTRAINT `subscription_invoices_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


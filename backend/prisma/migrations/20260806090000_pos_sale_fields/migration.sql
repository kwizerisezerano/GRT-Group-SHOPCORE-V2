-- Fields the POS checkout writes.
--
-- Adds the receipt/EBM/mobile-money/margin columns the point-of-sale screen
-- has always sent, so a sale can be recorded through the API rather than
-- through a dozen un-transacted client-side inserts.
--
-- The customer's phone and tax number are personal data and are treated as
-- such: AES-256-GCM at rest, with a blind index on the phone so a shop can
-- still find a buyer by number. The index is not unique - one person may buy
-- more than once. The mobile-money number is a phone number too and is
-- encrypted; the transaction code is not personal data and stays readable so
-- it can be reconciled against the provider's statement.
--
-- Cost and profit are stored per sale and per line rather than derived on
-- read: cost prices move over time, and a sale's margin is a fact about the
-- moment it happened.

-- AlterTable
ALTER TABLE `sale_items` ADD COLUMN `batch_id` CHAR(36) NULL,
    ADD COLUMN `cost_total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `gross_profit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `unit_cost` DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `change_given` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `cost_total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `customer_phone_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `customer_phone_hash` CHAR(64) NULL,
    ADD COLUMN `customer_tin_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `ebm_invoice_no` VARCHAR(64) NULL,
    ADD COLUMN `ebm_qr_code` TEXT NULL,
    ADD COLUMN `ebm_receipt_no` VARCHAR(64) NULL,
    ADD COLUMN `ebm_status` VARCHAR(32) NULL DEFAULT 'not_configured',
    ADD COLUMN `ebm_synced_at` DATETIME(3) NULL,
    ADD COLUMN `ebm_verification_code` VARCHAR(191) NULL,
    ADD COLUMN `gross_profit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `momo_code` VARCHAR(64) NULL,
    ADD COLUMN `momo_number_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `receipt_no` VARCHAR(64) NULL;

-- CreateIndex
CREATE INDEX `sales_customer_phone_hash_idx` ON `sales`(`customer_phone_hash`);

-- CreateIndex
CREATE INDEX `sales_invoice_no_idx` ON `sales`(`invoice_no`);

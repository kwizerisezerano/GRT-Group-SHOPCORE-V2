-- AlterTable
ALTER TABLE `subscription_plans` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `tin_number` VARCHAR(32) NULL;

-- CreateTable
CREATE TABLE `signed_contracts` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `template_id` CHAR(36) NULL,
    `template_name` VARCHAR(191) NOT NULL,
    `template_version` INTEGER NOT NULL,
    `body` LONGTEXT NOT NULL,
    `signer_name` VARCHAR(191) NOT NULL,
    `signer_email_encrypted` VARCHAR(512) NULL,
    `signature_image` LONGTEXT NOT NULL,
    `stamp_image` LONGTEXT NULL,
    `plan_code` VARCHAR(32) NOT NULL,
    `plan_name` VARCHAR(191) NOT NULL,
    `billing_cycle` VARCHAR(16) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'RWF',
    `signed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `signed_ip` VARCHAR(64) NULL,

    INDEX `signed_contracts_tenant_id_idx`(`tenant_id`),
    INDEX `signed_contracts_template_id_idx`(`template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `signed_contracts` ADD CONSTRAINT `signed_contracts_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signed_contracts` ADD CONSTRAINT `signed_contracts_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `contract_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


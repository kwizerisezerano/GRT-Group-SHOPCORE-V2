-- Branches: the shops, outlets and sites a workspace operates from.
--
-- Only the two statements below are real. `prisma migrate diff` also emitted a
-- dozen `MODIFY ... JSON NULL` lines for unrelated tables: MariaDB reports JSON
-- columns as LONGTEXT, so every diff believes the JSON columns have drifted.
-- They have not, and replaying them would rewrite tables for nothing.

-- CreateTable
CREATE TABLE `branches` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NULL,
    `manager` VARCHAR(191) NULL,
    `phone_encrypted` VARCHAR(512) NULL,
    `email_encrypted` VARCHAR(512) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `type` VARCHAR(32) NULL,
    `status` VARCHAR(32) NULL DEFAULT 'active',
    `opening_date` DATETIME(3) NULL,
    `operating_hours` VARCHAR(191) NULL,
    `tax_number` VARCHAR(64) NULL,
    `notes` TEXT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `branches_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `branches_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

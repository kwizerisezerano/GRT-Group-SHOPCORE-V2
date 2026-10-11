-- AlterTable
ALTER TABLE `contract_templates` ADD COLUMN `provider_signature_image` LONGTEXT NULL,
    ADD COLUMN `provider_signer_name` VARCHAR(191) NULL,
    ADD COLUMN `provider_signer_title` VARCHAR(191) NULL,
    ADD COLUMN `provider_stamp_image` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `signed_contracts` ADD COLUMN `provider_signature_image` LONGTEXT NULL,
    ADD COLUMN `provider_signer_name` VARCHAR(191) NULL,
    ADD COLUMN `provider_signer_title` VARCHAR(191) NULL,
    ADD COLUMN `provider_stamp_image` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `subscription_plans` ALTER COLUMN `updated_at` DROP DEFAULT;


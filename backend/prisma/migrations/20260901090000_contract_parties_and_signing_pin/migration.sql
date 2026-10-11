-- A platform admin's signing PIN: re-entered before ShopCore's own signature
-- or stamp is attached to a contract template.
ALTER TABLE `users`
    ADD COLUMN `signing_pin_hash` VARCHAR(255) NULL,
    ADD COLUMN `signing_pin_set_at` DATETIME(3) NULL,
    ADD COLUMN `signing_pin_failed_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `signing_pin_locked_until` DATETIME(3) NULL;

-- The provider's registered identity on the face of the agreement, plus a
-- record of who attached the signature and when.
ALTER TABLE `contract_templates`
    ADD COLUMN `provider_legal_name` VARCHAR(191) NULL,
    ADD COLUMN `provider_tin` VARCHAR(32) NULL,
    ADD COLUMN `provider_registration_no` VARCHAR(64) NULL,
    ADD COLUMN `provider_address` VARCHAR(255) NULL,
    ADD COLUMN `provider_email` VARCHAR(191) NULL,
    ADD COLUMN `provider_phone` VARCHAR(32) NULL,
    ADD COLUMN `governing_law` VARCHAR(191) NULL,
    ADD COLUMN `signature_attached_by` CHAR(36) NULL,
    ADD COLUMN `signature_attached_at` DATETIME(3) NULL;

-- Both parties' identities, snapshotted onto the signature.
ALTER TABLE `signed_contracts`
    ADD COLUMN `provider_legal_name` VARCHAR(191) NULL,
    ADD COLUMN `provider_tin` VARCHAR(32) NULL,
    ADD COLUMN `provider_registration_no` VARCHAR(64) NULL,
    ADD COLUMN `provider_address` VARCHAR(255) NULL,
    ADD COLUMN `provider_email` VARCHAR(191) NULL,
    ADD COLUMN `provider_phone` VARCHAR(32) NULL,
    ADD COLUMN `governing_law` VARCHAR(191) NULL,
    ADD COLUMN `customer_legal_name` VARCHAR(191) NULL,
    ADD COLUMN `customer_tin` VARCHAR(32) NULL,
    ADD COLUMN `customer_address` VARCHAR(255) NULL,
    ADD COLUMN `customer_phone_encrypted` VARCHAR(512) NULL;

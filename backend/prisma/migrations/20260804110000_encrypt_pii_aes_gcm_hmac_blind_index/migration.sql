-- Encrypt personally identifiable information at rest.
--
-- Replaces every plaintext PII column with an AES-256-GCM ciphertext column
-- (`*_encrypted`) and, where the value must remain searchable or unique, a
-- keyed HMAC-SHA256 blind index (`*_hash`). See src/lib/crypto.ts.
--
-- Uniqueness moves from the plaintext column to the hash:
--   users.email          UNIQUE  ->  users.email_hash            UNIQUE
--   profiles.phone       (none)  ->  profiles.phone_hash         UNIQUE
--   customers/suppliers  (none)  ->  (tenant_id, email_hash)     UNIQUE
--                                    (tenant_id, phone_hash)     UNIQUE
-- Customer/supplier hashes are unique per tenant, not globally: one person
-- may be a customer of several businesses on the platform.
--
-- ----------------------------------------------------------------------
-- DESTRUCTIVE. This DROPs the plaintext columns. Encryption happens in the
-- application, so SQL cannot backfill the new columns on its own.
--
-- An environment holding real data must export the plaintext rows BEFORE
-- applying this, then re-import them through the API (or a script using
-- src/lib/crypto.ts) afterwards. At time of writing no environment holds
-- production data - the live system is still on Supabase, and this MySQL
-- database contains development rows only.
-- ----------------------------------------------------------------------

-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- AlterTable
ALTER TABLE `customers` DROP COLUMN `address`,
    DROP COLUMN `email`,
    DROP COLUMN `name`,
    DROP COLUMN `phone`,
    ADD COLUMN `address_encrypted` TEXT NULL,
    ADD COLUMN `email_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `email_hash` CHAR(64) NULL,
    ADD COLUMN `name_encrypted` VARCHAR(512) NOT NULL,
    ADD COLUMN `phone_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `phone_hash` CHAR(64) NULL;

-- AlterTable
ALTER TABLE `profiles` DROP COLUMN `display_name`,
    DROP COLUMN `phone`,
    ADD COLUMN `display_name_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `phone_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `phone_hash` CHAR(64) NULL;

-- AlterTable
ALTER TABLE `suppliers` DROP COLUMN `address`,
    DROP COLUMN `email`,
    DROP COLUMN `name`,
    DROP COLUMN `phone`,
    ADD COLUMN `address_encrypted` TEXT NULL,
    ADD COLUMN `email_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `email_hash` CHAR(64) NULL,
    ADD COLUMN `name_encrypted` VARCHAR(512) NOT NULL,
    ADD COLUMN `phone_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `phone_hash` CHAR(64) NULL;

-- AlterTable
ALTER TABLE `tenants` DROP COLUMN `contact_email`,
    ADD COLUMN `contact_email_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `contact_email_hash` CHAR(64) NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `display_name`,
    DROP COLUMN `email`,
    ADD COLUMN `display_name_encrypted` VARCHAR(512) NULL,
    ADD COLUMN `email_encrypted` VARCHAR(512) NOT NULL,
    ADD COLUMN `email_hash` CHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `customers_tenant_id_email_hash_key` ON `customers`(`tenant_id`, `email_hash`);

-- CreateIndex
CREATE UNIQUE INDEX `customers_tenant_id_phone_hash_key` ON `customers`(`tenant_id`, `phone_hash`);

-- CreateIndex
CREATE UNIQUE INDEX `profiles_phone_hash_key` ON `profiles`(`phone_hash`);

-- CreateIndex
CREATE UNIQUE INDEX `suppliers_tenant_id_email_hash_key` ON `suppliers`(`tenant_id`, `email_hash`);

-- CreateIndex
CREATE UNIQUE INDEX `suppliers_tenant_id_phone_hash_key` ON `suppliers`(`tenant_id`, `phone_hash`);

-- CreateIndex
CREATE INDEX `tenants_contact_email_hash_idx` ON `tenants`(`contact_email_hash`);

-- CreateIndex
CREATE UNIQUE INDEX `users_email_hash_key` ON `users`(`email_hash`);


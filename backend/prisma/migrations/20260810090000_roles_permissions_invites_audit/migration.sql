-- Roles that actually mean something.
--
-- Until now a role was a label. requireAuth read one off the token and no code
-- anywhere looked at it, so every authenticated member of a workspace could
-- call every endpoint: a cashier could delete products, read cost prices and
-- margins, receive stock, or change what things sell for. The UI hid those
-- screens, which is worth doing but is not security - the API is the boundary,
-- and it had none.
--
-- Three tables, and no new source of truth for the role itself. A member's role
-- stays on tenant_members, which is what /auth/me already reads.
--
--   role_permissions  a workspace's own grants and revocations on top of the
--                     defaults shipped in lib/permissions.ts. Only the
--                     differences are stored, so a workspace that customised
--                     one role still picks up sensible access to modules
--                     shipped later, with no data migration.
--
--   user_invites      an invitation to join in a named role. The token is
--                     stored hashed - an invite link is a credential until it
--                     is used, and a leaked database must not hand out
--                     workspace access. The address is encrypted like every
--                     other, with a blind index so a pending invite can still
--                     be found by the address it went to.
--
--   activity_logs     who changed a role, granted a permission, or removed a
--                     member. Append-only by convention: the API has no update
--                     or delete path.

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `role` VARCHAR(32) NOT NULL,
    `permission` VARCHAR(64) NOT NULL,
    `granted` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `role_permissions_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `role_permissions_tenant_id_role_permission_key`(`tenant_id`, `role`, `permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_invites` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `email_encrypted` VARCHAR(512) NOT NULL,
    `email_hash` CHAR(64) NOT NULL,
    `role` VARCHAR(32) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `invited_by` CHAR(36) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `accepted_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_invites_token_hash_key`(`token_hash`),
    INDEX `user_invites_tenant_id_email_hash_idx`(`tenant_id`, `email_hash`),
    INDEX `user_invites_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `actor_label` VARCHAR(191) NULL,
    `action` VARCHAR(64) NOT NULL,
    `module` VARCHAR(64) NULL,
    `target_id` CHAR(36) NULL,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `activity_logs_tenant_id_module_idx`(`tenant_id`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_invites` ADD CONSTRAINT `user_invites_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

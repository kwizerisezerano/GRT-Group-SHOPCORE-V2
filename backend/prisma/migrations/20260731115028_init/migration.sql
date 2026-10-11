-- =========================================================================
-- ShopCore (V2 branch) MySQL bootstrap migration.
--
-- Per explicit request: this migration DROPS ALL EXISTING DATA in the
-- target schema and recreates every table from scratch. It is intended to
-- run against an empty/dev database only - it is NOT safe to run against a
-- database holding real data, since every DROP below is unconditional and
-- irreversible.
--
-- The DROP block is ordered child-tables-first (leaves before parents), the
-- exact reverse of the CREATE order Prisma generated below (which is itself
-- parent-before-child, i.e. FK-safe). SET FOREIGN_KEY_CHECKS=0 brackets the
-- whole block as well, so the drop order only needs to be "roughly right"
-- for readability - MySQL won't reject an out-of-order drop while checks
-- are disabled.
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Tier 1: internal QA/audit subsystem (leaf tables)
DROP TABLE IF EXISTS `qa_settings`;
DROP TABLE IF EXISTS `qa_isolation_leaks`;
DROP TABLE IF EXISTS `qa_filter_presets`;
DROP TABLE IF EXISTS `qa_audit_log`;
DROP TABLE IF EXISTS `qa_screenshots`;
DROP TABLE IF EXISTS `qa_runs`;

-- Tier 2: staff / expenses / stock tracking (leaf tables)
DROP TABLE IF EXISTS `staff`;
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `stock_movements`;
DROP TABLE IF EXISTS `expired_products`;

-- Tier 3: sales & purchasing line items, then their parent documents
DROP TABLE IF EXISTS `purchase_items`;
DROP TABLE IF EXISTS `purchases`;
DROP TABLE IF EXISTS `credited_items`;
DROP TABLE IF EXISTS `sale_items`;
DROP TABLE IF EXISTS `sales`;

-- Tier 4: core catalog / customer / supplier entities
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `brands`;

-- Tier 5: billing / subscription records
DROP TABLE IF EXISTS `platform_tenant_module_entitlements`;
DROP TABLE IF EXISTS `tenant_subscriptions`;
DROP TABLE IF EXISTS `payment_methods`;
DROP TABLE IF EXISTS `public_subscription_plan_catalog`;
DROP TABLE IF EXISTS `subscription_plan_prices`;
DROP TABLE IF EXISTS `subscription_plans`;

-- Tier 6: legacy workspace tables
DROP TABLE IF EXISTS `workspace_members`;
DROP TABLE IF EXISTS `workspaces`;

-- Tier 7: RBAC / tenant membership
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `tenant_members`;

-- Tier 8: tenant root
DROP TABLE IF EXISTS `tenants`;

-- Tier 9: profile (1:1 with a user)
DROP TABLE IF EXISTS `profiles`;

-- Tier 10: auth / user root
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================================
-- Recreate: every statement below is Prisma-generated from schema.prisma,
-- parent tables before their children, so it applies cleanly with FK checks
-- back on.
-- =========================================================================

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `display_name` VARCHAR(191) NULL,
    `is_platform_admin` BOOLEAN NOT NULL DEFAULT false,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profiles` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NULL,
    `display_name` VARCHAR(512) NULL,
    `phone` VARCHAR(512) NULL,
    `language` VARCHAR(8) NOT NULL DEFAULT 'en',
    `plan_id` CHAR(36) NULL,
    `avatar_url` VARCHAR(512) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `profiles_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenants` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `owner_id` CHAR(36) NULL,
    `contact_email` VARCHAR(191) NULL,
    `slug` VARCHAR(191) NULL,
    `logo_url` VARCHAR(512) NULL,
    `brand_color` VARCHAR(16) NULL DEFAULT '#2563eb',
    `subscription_plan` VARCHAR(64) NULL,
    `subscription_status` VARCHAR(32) NULL,
    `payment_status` VARCHAR(32) NULL,
    `trial_status` VARCHAR(32) NULL,
    `trial_ends_at` DATETIME(3) NULL,
    `onboarding_completed` BOOLEAN NOT NULL DEFAULT false,
    `workspace_status` VARCHAR(32) NULL,
    `billing_cycle` VARCHAR(16) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_members` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'member',
    `is_default` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tenant_members_user_id_tenant_id_key`(`user_id`, `tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NULL,
    `role` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_roles_user_id_tenant_id_role_key`(`user_id`, `tenant_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspaces` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspace_members` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `workspace_id` CHAR(36) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'owner',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subscription_plans_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plan_prices` (
    `id` CHAR(36) NOT NULL,
    `plan_code` VARCHAR(32) NOT NULL,
    `billing_cycle` VARCHAR(16) NOT NULL,
    `billing_months` INTEGER NULL,
    `list_price` DECIMAL(14, 2) NOT NULL,
    `final_price` DECIMAL(14, 2) NOT NULL,
    `discount_percent` DECIMAL(5, 2) NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'RWF',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subscription_plan_prices_plan_code_billing_cycle_key`(`plan_code`, `billing_cycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `public_subscription_plan_catalog` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `features` JSON NULL,
    `limits` JSON NULL,
    `prices` JSON NULL,

    UNIQUE INDEX `public_subscription_plan_catalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `provider` VARCHAR(64) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `supports_recurring` BOOLEAN NOT NULL DEFAULT false,
    `supports_one_time` BOOLEAN NOT NULL DEFAULT true,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'RWF',
    `config` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_methods_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_subscriptions` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `plan_code` VARCHAR(32) NOT NULL,
    `billing_cycle` VARCHAR(16) NOT NULL,
    `billing_months` INTEGER NULL,
    `subscription_amount` DECIMAL(14, 2) NULL,
    `subscription_currency` VARCHAR(8) NULL DEFAULT 'RWF',
    `subscription_discount_percent` DECIMAL(5, 2) NULL,
    `payment_method_code` VARCHAR(32) NULL,
    `subscription_status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `payment_status` VARCHAR(32) NOT NULL DEFAULT 'paid',
    `approval_status` VARCHAR(16) NOT NULL DEFAULT 'approved',
    `requested_by` CHAR(36) NULL,
    `requested_at` DATETIME(3) NULL,
    `approved_by` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `activated_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `current_period_start` DATETIME(3) NULL,
    `current_period_end` DATETIME(3) NULL,
    `trial_ends_at` DATETIME(3) NULL,
    `grace_period_ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_subscriptions_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_tenant_module_entitlements` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `module_key` VARCHAR(64) NOT NULL,
    `module_name` VARCHAR(191) NULL,
    `status` VARCHAR(32) NULL,
    `seats_included` INTEGER NULL,
    `seats_used` INTEGER NULL,
    `usage_count` INTEGER NULL,
    `last_used_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `platform_tenant_module_entitlements_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brands` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `brands_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `categories_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `suppliers_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(64) NULL,
    `sku` VARCHAR(64) NULL,
    `category` VARCHAR(191) NULL,
    `category_id` CHAR(36) NULL,
    `category_name` VARCHAR(191) NULL,
    `brand` VARCHAR(191) NULL,
    `brand_id` CHAR(36) NULL,
    `supplier_id` CHAR(36) NULL,
    `cost_price` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `selling_price` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `min_stock` INTEGER NOT NULL DEFAULT 0,
    `min_stock_level` INTEGER NOT NULL DEFAULT 5,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `image_url` VARCHAR(512) NULL,
    `description` TEXT NULL,
    `unit` VARCHAR(32) NULL DEFAULT 'pcs',
    `status` VARCHAR(32) NULL DEFAULT 'active',
    `expiry_date` DATE NULL,
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `products_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `total_spent` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `loyalty_points` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NULL DEFAULT 'active',
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customers_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `invoice_no` VARCHAR(64) NOT NULL,
    `sale_no` VARCHAR(64) NULL,
    `customer_name` VARCHAR(191) NULL,
    `items` INTEGER NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `tax` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `paid` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `due` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `payment_method` VARCHAR(32) NULL,
    `status` VARCHAR(32) NULL DEFAULT 'completed',
    `branch` VARCHAR(191) NULL,
    `cashier` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `user_id` CHAR(36) NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sales_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `sale_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(64) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `tax` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sale_items_tenant_id_idx`(`tenant_id`),
    INDEX `sale_items_sale_id_idx`(`sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credited_items` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `sale_id` CHAR(36) NULL,
    `product_id` CHAR(36) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `amount_paid` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `remaining_balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `due_date` DATETIME(3) NULL,
    `status` VARCHAR(32) NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credited_items_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchases` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `supplier_id` CHAR(36) NULL,
    `supplier_name` VARCHAR(191) NULL,
    `purchase_no` VARCHAR(64) NULL,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `tax` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NULL DEFAULT 'completed',
    `payment_status` VARCHAR(32) NULL DEFAULT 'paid',
    `notes` TEXT NULL,
    `user_id` CHAR(36) NULL,
    `purchase_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `purchases_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_items` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `purchase_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NULL,
    `product_name` VARCHAR(191) NULL,
    `sku` VARCHAR(64) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchase_items_tenant_id_idx`(`tenant_id`),
    INDEX `purchase_items_purchase_id_idx`(`purchase_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expired_products` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `expiry_date` DATE NULL,
    `status` VARCHAR(32) NULL DEFAULT 'expired',
    `disposal_method` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `expired_products_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` CHAR(36) NOT NULL,
    `product_id` VARCHAR(191) NULL,
    `product_name` VARCHAR(191) NULL,
    `movement_type` VARCHAR(32) NOT NULL,
    `quantity_change` INTEGER NOT NULL,
    `stock_before` INTEGER NULL,
    `stock_after` INTEGER NULL,
    `reference` VARCHAR(191) NULL,
    `reference_id` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `category` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `expenses_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `profile_id` CHAR(36) NULL,
    `position` VARCHAR(191) NULL,
    `salary` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `staff_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qa_runs` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `status` VARCHAR(32) NULL DEFAULT 'pending',
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `qa_runs_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qa_screenshots` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `qa_run_id` CHAR(36) NOT NULL,
    `image_url` VARCHAR(512) NOT NULL,
    `label` VARCHAR(191) NULL,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `qa_screenshots_tenant_id_idx`(`tenant_id`),
    INDEX `qa_screenshots_qa_run_id_idx`(`qa_run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qa_audit_log` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NULL,
    `entity_id` CHAR(36) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `qa_audit_log_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qa_filter_presets` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `filters` JSON NULL,
    `created_by` CHAR(36) NULL,
    `user_id` CHAR(36) NULL,
    `action` VARCHAR(191) NULL,
    `filter_user` VARCHAR(191) NULL,
    `from_date` DATETIME(3) NULL,
    `to_date` DATETIME(3) NULL,
    `search` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `qa_filter_presets_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qa_isolation_leaks` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `detected_by` CHAR(36) NULL,
    `description` TEXT NULL,
    `severity` VARCHAR(16) NULL DEFAULT 'low',
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `run_id` CHAR(36) NULL,
    `table_name` VARCHAR(191) NULL,
    `row_id` CHAR(36) NULL,
    `expected_tenant` CHAR(36) NULL,
    `actual_tenant` CHAR(36) NULL,
    `context` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `qa_isolation_leaks_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qa_settings` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `auto_capture` BOOLEAN NOT NULL DEFAULT false,
    `screenshot_retention_days` INTEGER NOT NULL DEFAULT 30,
    `isolation_enabled` BOOLEAN NOT NULL DEFAULT true,
    `webhook_url` VARCHAR(512) NULL,
    `webhook_enabled` BOOLEAN NOT NULL DEFAULT false,
    `capture_screenshots` BOOLEAN NOT NULL DEFAULT true,
    `diff_threshold` DECIMAL(5, 2) NOT NULL DEFAULT 0.1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `qa_settings_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fkey` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_members` ADD CONSTRAINT `tenant_members_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_members` ADD CONSTRAINT `tenant_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_plan_prices` ADD CONSTRAINT `subscription_plan_prices_plan_code_fkey` FOREIGN KEY (`plan_code`) REFERENCES `subscription_plans`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_payment_method_code_fkey` FOREIGN KEY (`payment_method_code`) REFERENCES `payment_methods`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_tenant_module_entitlements` ADD CONSTRAINT `platform_tenant_module_entitlements_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brands` ADD CONSTRAINT `brands_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credited_items` ADD CONSTRAINT `credited_items_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credited_items` ADD CONSTRAINT `credited_items_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credited_items` ADD CONSTRAINT `credited_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credited_items` ADD CONSTRAINT `credited_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expired_products` ADD CONSTRAINT `expired_products_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expired_products` ADD CONSTRAINT `expired_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_runs` ADD CONSTRAINT `qa_runs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_runs` ADD CONSTRAINT `qa_runs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_screenshots` ADD CONSTRAINT `qa_screenshots_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_screenshots` ADD CONSTRAINT `qa_screenshots_qa_run_id_fkey` FOREIGN KEY (`qa_run_id`) REFERENCES `qa_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_screenshots` ADD CONSTRAINT `qa_screenshots_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_audit_log` ADD CONSTRAINT `qa_audit_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_audit_log` ADD CONSTRAINT `qa_audit_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_filter_presets` ADD CONSTRAINT `qa_filter_presets_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_filter_presets` ADD CONSTRAINT `qa_filter_presets_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_isolation_leaks` ADD CONSTRAINT `qa_isolation_leaks_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_isolation_leaks` ADD CONSTRAINT `qa_isolation_leaks_detected_by_fkey` FOREIGN KEY (`detected_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qa_settings` ADD CONSTRAINT `qa_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

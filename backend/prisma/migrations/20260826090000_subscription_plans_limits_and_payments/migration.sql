-- AlterTable
ALTER TABLE `subscription_plans` ADD COLUMN `badge_text` VARCHAR(64) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `display_order` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `is_popular` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_public` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `tagline` VARCHAR(255) NULL,
    ADD COLUMN `trial_days` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `subscription_plan_limits` (
    `id` CHAR(36) NOT NULL,
    `plan_code` VARCHAR(32) NOT NULL,
    `limit_key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` INTEGER NULL,
    `is_unlimited` BOOLEAN NOT NULL DEFAULT false,
    `unit` VARCHAR(32) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscription_plan_limits_plan_code_idx`(`plan_code`),
    UNIQUE INDEX `subscription_plan_limits_plan_code_limit_key_key`(`plan_code`, `limit_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plan_features` (
    `id` CHAR(36) NOT NULL,
    `plan_code` VARCHAR(32) NOT NULL,
    `feature_key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(64) NOT NULL DEFAULT 'modules',
    `access_level` VARCHAR(16) NOT NULL DEFAULT 'included',
    `display_note` VARCHAR(255) NULL,
    `is_highlighted` BOOLEAN NOT NULL DEFAULT false,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscription_plan_features_plan_code_idx`(`plan_code`),
    UNIQUE INDEX `subscription_plan_features_plan_code_feature_key_key`(`plan_code`, `feature_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_limit_overrides` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `limit_key` VARCHAR(64) NOT NULL,
    `value` INTEGER NULL,
    `is_unlimited` BOOLEAN NOT NULL DEFAULT false,
    `note` VARCHAR(255) NULL,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_limit_overrides_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `tenant_limit_overrides_tenant_id_limit_key_key`(`tenant_id`, `limit_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_transactions` (
    `id` CHAR(36) NOT NULL,
    `reference_id` VARCHAR(64) NOT NULL,
    `tenant_id` CHAR(36) NULL,
    `subscription_id` CHAR(36) NULL,
    `user_id` CHAR(36) NULL,
    `purpose` VARCHAR(32) NOT NULL DEFAULT 'subscription',
    `direction` VARCHAR(16) NOT NULL DEFAULT 'collection',
    `provider` VARCHAR(32) NOT NULL DEFAULT 'lmbtech',
    `provider_txn_id` VARCHAR(128) NULL,
    `payment_method_code` VARCHAR(32) NULL,
    `gateway_method` VARCHAR(32) NULL,
    `payer_phone_encrypted` VARCHAR(512) NULL,
    `payer_email_encrypted` VARCHAR(512) NULL,
    `payer_name_encrypted` VARCHAR(512) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'RWF',
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `status_detail` TEXT NULL,
    `redirect_url` VARCHAR(768) NULL,
    `service_paid` VARCHAR(191) NULL,
    `plan_code` VARCHAR(32) NULL,
    `billing_cycle` VARCHAR(16) NULL,
    `callback_count` INTEGER NOT NULL DEFAULT 0,
    `initiated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `last_callback_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_transactions_reference_id_key`(`reference_id`),
    INDEX `payment_transactions_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `payment_transactions_status_idx`(`status`),
    INDEX `payment_transactions_subscription_id_idx`(`subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_logs` (
    `id` CHAR(36) NOT NULL,
    `transaction_id` CHAR(36) NULL,
    `reference_id` VARCHAR(64) NULL,
    `tenant_id` CHAR(36) NULL,
    `direction` VARCHAR(16) NOT NULL,
    `event` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(32) NOT NULL DEFAULT 'lmbtech',
    `http_status` INTEGER NULL,
    `result_status` VARCHAR(16) NULL,
    `message` TEXT NULL,
    `request_payload` JSON NULL,
    `response_payload` JSON NULL,
    `error_message` TEXT NULL,
    `duration_ms` INTEGER NULL,
    `ip_address` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_logs_transaction_id_created_at_idx`(`transaction_id`, `created_at`),
    INDEX `payment_logs_reference_id_idx`(`reference_id`),
    INDEX `payment_logs_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `payment_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscription_plan_limits` ADD CONSTRAINT `subscription_plan_limits_plan_code_fkey` FOREIGN KEY (`plan_code`) REFERENCES `subscription_plans`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_plan_features` ADD CONSTRAINT `subscription_plan_features_plan_code_fkey` FOREIGN KEY (`plan_code`) REFERENCES `subscription_plans`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_limit_overrides` ADD CONSTRAINT `tenant_limit_overrides_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `tenant_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_logs` ADD CONSTRAINT `payment_logs_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_logs` ADD CONSTRAINT `payment_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


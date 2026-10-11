-- DropForeignKey
ALTER TABLE `subscription_plan_prices` DROP FOREIGN KEY `subscription_plan_prices_plan_code_fkey`;

-- AlterTable
ALTER TABLE `subscription_plans` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `subscription_plan_prices` ADD CONSTRAINT `subscription_plan_prices_plan_code_fkey` FOREIGN KEY (`plan_code`) REFERENCES `subscription_plans`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;


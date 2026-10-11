-- Where a member works, and whether their membership is live.
--
-- The admin screen has offered branch, department and status since it was
-- written, and wrote all three to Supabase against columns this database never
-- had. Every save reported success and stored nothing. These are those columns.

-- AlterTable
ALTER TABLE `tenant_members` ADD COLUMN `branch_id` CHAR(36) NULL,
    ADD COLUMN `department` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'active';

-- AddForeignKey
--
-- SET NULL rather than CASCADE: closing a shop must not delete the people who
-- worked in it. They fall back to workspace-wide until someone reassigns them.
ALTER TABLE `tenant_members` ADD CONSTRAINT `tenant_members_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

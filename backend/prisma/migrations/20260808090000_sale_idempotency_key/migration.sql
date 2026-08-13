-- Make a checkout safe to send twice.
--
-- A till that loses its connection after the server committed a sale, but
-- before the answer got back, has no way to tell "it worked" from "it didn't".
-- Retrying risked a duplicate sale; not retrying risked losing one. Neither is
-- acceptable when the record is money, and it is the normal case for a shop
-- working offline and syncing later.
--
-- `client_request_id` is chosen by the till when a sale is first attempted and
-- reused for every retry of that same sale. The unique index is what makes the
-- guarantee real: a replay cannot insert a second row, so the server answers
-- the retry with the sale it already recorded.
--
-- The sync path previously guarded against duplicates by reading back an
-- invoice number before inserting. That is a check-then-act race - two
-- replays can both read "not found" and both insert - and it keyed on a number
-- the server now allocates itself. A unique constraint has neither problem.
--
-- NULL is exempt from a MySQL unique index, and deliberately so: sales made
-- before this migration, and any caller that does not send a key, are simply
-- not deduplicated rather than colliding with each other.

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `client_request_id` VARCHAR(64) NULL,
    ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `source` VARCHAR(16) NULL DEFAULT 'online';

-- CreateIndex
CREATE UNIQUE INDEX `sales_tenant_id_client_request_id_key` ON `sales`(`tenant_id`, `client_request_id`);

-- Existing sales were all recorded as they happened, and their completion time
-- is their creation time. Stated explicitly so reports over `completed_at` do
-- not silently skip every sale that predates this column.
UPDATE `sales` SET `source` = 'online' WHERE `source` IS NULL;
UPDATE `sales` SET `completed_at` = `created_at` WHERE `completed_at` IS NULL;

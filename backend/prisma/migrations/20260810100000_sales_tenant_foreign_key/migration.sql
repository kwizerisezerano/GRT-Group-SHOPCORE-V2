-- Give `sales` the foreign keys it never had.
--
-- The initial migration created foreign keys for `sale_items` - to its tenant,
-- its sale and its product - but none at all for `sales` itself, even though
-- the schema declares the relations. So a sale was never tied to its tenant by
-- anything the database enforced, and deleting a workspace left its sales
-- behind as rows no query can reach: every read filters by tenant_id, and that
-- tenant no longer exists.
--
-- Found by accident, which is the best way to find this kind of thing. A test
-- deleted its workspace between runs, the orphaned sale kept its invoice
-- number, and the next run's first sale collided with it on the unique index
-- added in 20260807100000. The failure was a duplicate invoice number; the
-- cause was a missing constraint two migrations earlier.
--
-- Requirement 2 asks for referential integrity with no orphans. This is where
-- it was not true.

-- Orphaned sales are deleted, not adopted. A sale whose tenant is gone belongs
-- to nobody, is invisible to every query in the application, and cannot be
-- attributed to a workspace by any means - there is no information left to
-- decide whose it was. `sale_items` cascades from `sales`, so their lines go
-- with them.
DELETE FROM `sales` WHERE `tenant_id` NOT IN (SELECT `id` FROM `tenants`);

-- The same for a user id pointing at nobody, which would otherwise block the
-- second constraint below. Nulled rather than deleted: the sale is real and
-- belongs to its tenant, only the record of who rang it up is lost.
UPDATE `sales` SET `user_id` = NULL
WHERE `user_id` IS NOT NULL AND `user_id` NOT IN (SELECT `id` FROM `users`);

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ON DELETE SET NULL, not CASCADE: removing a cashier from the system must not
-- erase the sales they recorded. The money changed hands whoever has since
-- left.
ALTER TABLE `sales` ADD CONSTRAINT `sales_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

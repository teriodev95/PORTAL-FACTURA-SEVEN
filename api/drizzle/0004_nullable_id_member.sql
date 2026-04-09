-- Sales 850 and 853 from EVO have null idMember.
-- Recreate sales table with nullable id_member.
CREATE TABLE `sales_new` (
	`id_sale` integer PRIMARY KEY NOT NULL,
	`id_member` integer,
	`id_branch` integer NOT NULL,
	`sale_date` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_rfc` text,
	`customer_email` text,
	`items_json` text NOT NULL,
	`total` real NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `sales_new` SELECT * FROM `sales`;
--> statement-breakpoint
DROP TABLE `sales`;
--> statement-breakpoint
ALTER TABLE `sales_new` RENAME TO `sales`;

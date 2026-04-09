-- Drop old facturapi_id index and column, add new columns for SW
-- SQLite doesn't support DROP COLUMN directly, so we recreate the table

CREATE TABLE `invoices_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`evo_sale_id` integer NOT NULL,
	`evo_member_id` integer NOT NULL,
	`customer_name` text NOT NULL,
	`customer_rfc` text NOT NULL,
	`customer_email` text,
	`total` real NOT NULL,
	`status` text DEFAULT 'valid' NOT NULL,
	`cfdi_xml` text,
	`fecha_timbrado` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `invoices_new` (`id`, `uuid`, `evo_sale_id`, `evo_member_id`, `customer_name`, `customer_rfc`, `customer_email`, `total`, `status`, `created_at`)
SELECT `id`, `uuid`, `evo_sale_id`, `evo_member_id`, `customer_name`, `customer_rfc`, `customer_email`, `total`, `status`, `created_at`
FROM `invoices`;
--> statement-breakpoint
DROP TABLE `invoices`;
--> statement-breakpoint
ALTER TABLE `invoices_new` RENAME TO `invoices`;
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_uuid_unique` ON `invoices` (`uuid`);

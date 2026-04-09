CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facturapi_id` text NOT NULL,
	`uuid` text NOT NULL,
	`evo_sale_id` integer NOT NULL,
	`evo_member_id` integer NOT NULL,
	`customer_name` text NOT NULL,
	`customer_rfc` text NOT NULL,
	`customer_email` text,
	`total` real NOT NULL,
	`status` text DEFAULT 'valid' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_facturapi_id_unique` ON `invoices` (`facturapi_id`);
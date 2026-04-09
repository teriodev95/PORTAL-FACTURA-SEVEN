DROP TABLE IF EXISTS `probe_log`;
--> statement-breakpoint
CREATE TABLE `sales` (
	`id_sale` integer PRIMARY KEY NOT NULL,
	`id_member` integer NOT NULL,
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
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_at` text NOT NULL,
	`brt_hour` integer NOT NULL,
	`inside_window` integer NOT NULL,
	`sales_fetched` integer NOT NULL,
	`sales_inserted` integer NOT NULL,
	`sales_updated` integer NOT NULL,
	`pages_requested` integer NOT NULL,
	`rate_limited` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`errors` text,
	`verdict` text NOT NULL
);

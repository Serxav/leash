CREATE TABLE `catalog_searches` (
	`query_key` text PRIMARY KEY NOT NULL,
	`products_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_usage` (
	`month` text PRIMARY KEY NOT NULL,
	`searches` integer NOT NULL
);

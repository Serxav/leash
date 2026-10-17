CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`stage` text NOT NULL,
	`product_id` text NOT NULL,
	`product_source` text NOT NULL,
	`product_title` text NOT NULL,
	`merchant_domain` text,
	`signals_json` text NOT NULL,
	`intent_id` text,
	`created_at` integer NOT NULL
);

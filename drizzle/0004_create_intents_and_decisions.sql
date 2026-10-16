CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`outcome` text NOT NULL,
	`rule_ids_json` text NOT NULL,
	`explanation` text NOT NULL,
	`decided_by` text NOT NULL,
	`policy_version` integer,
	`order_total` text,
	`decided_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`merchant_domain` text NOT NULL,
	`quantity` integer NOT NULL,
	`product_title` text,
	`unit_price` text,
	`currency` text,
	`category` text,
	`agent_reason` text NOT NULL,
	`created_at` integer NOT NULL
);

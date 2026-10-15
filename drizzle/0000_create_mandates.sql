CREATE TABLE `mandates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`setup_token_id` text,
	`paypal_customer_id` text,
	`vault_token_ref` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

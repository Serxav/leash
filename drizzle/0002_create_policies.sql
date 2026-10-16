CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` integer,
	`source_text` text NOT NULL,
	`rules_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policies_user_version` ON `policies` (`user_id`,`version`);
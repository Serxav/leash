CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`intent_id` text,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`initiator` text NOT NULL,
	`status` text NOT NULL,
	`paypal_order_id` text,
	`capture_id` text,
	`refund_id` text,
	`failure_issue` text,
	`debug_id` text,
	`withdrawal_deadline` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

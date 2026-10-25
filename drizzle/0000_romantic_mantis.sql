CREATE TABLE `credit_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `credit_transactions_user_idx` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `sms_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`number` text NOT NULL,
	`group_name` text DEFAULT 'General' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sms_contacts_user_idx` ON `sms_contacts` (`user_id`);--> statement-breakpoint
CREATE INDEX `sms_contacts_group_idx` ON `sms_contacts` (`group_name`);--> statement-breakpoint
CREATE TABLE `sms_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`semaphore_id` integer,
	`recipient` text NOT NULL,
	`message` text NOT NULL,
	`sender_name` text,
	`network` text,
	`status` text DEFAULT 'Queued' NOT NULL,
	`msg_type` text DEFAULT 'Single' NOT NULL,
	`kind` text DEFAULT 'regular' NOT NULL,
	`credits_charged` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`logged_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sms_messages_user_idx` ON `sms_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `sms_messages_status_idx` ON `sms_messages` (`status`);--> statement-breakpoint
CREATE INDEX `sms_messages_semaphore_idx` ON `sms_messages` (`semaphore_id`);--> statement-breakpoint
CREATE TABLE `sms_senders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sms_senders_name_unique` ON `sms_senders` (`name`);--> statement-breakpoint
CREATE TABLE `sms_settings` (
	`k` text PRIMARY KEY NOT NULL,
	`v` text
);
--> statement-breakpoint
CREATE TABLE `topups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`credits_wanted` integer NOT NULL,
	`amount_peso` real NOT NULL,
	`pay_ref` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer
);
--> statement-breakpoint
CREATE INDEX `topups_user_idx` ON `topups` (`user_id`);--> statement-breakpoint
CREATE INDEX `topups_status_idx` ON `topups` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`api_key` text NOT NULL,
	`credits` integer DEFAULT 0 NOT NULL,
	`is_admin` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_key_unique` ON `users` (`api_key`);
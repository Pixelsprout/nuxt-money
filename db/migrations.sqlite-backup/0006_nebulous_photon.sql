CREATE TABLE `akahu_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`akahu_id` text NOT NULL,
	`date` integer NOT NULL,
	`description` text NOT NULL,
	`amount` text NOT NULL,
	`balance` text,
	`type` text,
	`category` text,
	`merchant` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `akahu_account`(`id`) ON UPDATE no action ON DELETE cascade
);

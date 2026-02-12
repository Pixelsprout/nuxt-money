PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transaction_category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#64748b',
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_transaction_category`("id", "user_id", "name", "color", "description", "created_at", "updated_at") SELECT "id", "user_id", "name", "color", "description", "created_at", "updated_at" FROM `transaction_category`;--> statement-breakpoint
DROP TABLE `transaction_category`;--> statement-breakpoint
ALTER TABLE `__new_transaction_category` RENAME TO `transaction_category`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
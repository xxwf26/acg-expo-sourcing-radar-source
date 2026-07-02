ALTER TABLE `entities` ADD `contacts` json;--> statement-breakpoint
ALTER TABLE `entities` ADD `contact_checked_at` timestamp;--> statement-breakpoint
ALTER TABLE `entities` ADD `contact_checked_by` varchar(64);
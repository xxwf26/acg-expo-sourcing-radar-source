CREATE TABLE `sourcing_config` (
	`id` varchar(32) NOT NULL DEFAULT 'default',
	`modules` json,
	`benchmarks` json,
	`scoring_rubric` text,
	`updated_by` varchar(128),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sourcing_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `candidates` ADD `ai_reason` text;
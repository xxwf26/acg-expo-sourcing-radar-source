CREATE TABLE `candidates` (
	`id` varchar(64) NOT NULL,
	`source_id` varchar(64),
	`crawl_run_id` varchar(64),
	`event_id` varchar(64),
	`name` varchar(255) NOT NULL,
	`type` varchar(32) NOT NULL DEFAULT 'creatorKol',
	`region` varchar(128),
	`booth` varchar(255),
	`follower_scale` varchar(255),
	`links` json,
	`reason` text,
	`raw_snippet` text,
	`ai_score` int,
	`dedup_entity_id` varchar(64),
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`reviewed_by` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crawl_runs` (
	`id` varchar(64) NOT NULL,
	`source_id` varchar(64) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'running',
	`raw_text` text,
	`extracted_count` int DEFAULT 0,
	`error` text,
	`started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`finished_at` timestamp,
	CONSTRAINT `crawl_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sources` ADD `url` varchar(1024);--> statement-breakpoint
ALTER TABLE `sources` ADD `strategy` varchar(32) DEFAULT 'static';--> statement-breakpoint
ALTER TABLE `sources` ADD `selector` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `event_id` varchar(64);--> statement-breakpoint
ALTER TABLE `sources` ADD `enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sources` ADD `last_crawled_at` timestamp;--> statement-breakpoint
CREATE INDEX `idx_candidate_status` ON `candidates` (`status`);--> statement-breakpoint
CREATE INDEX `idx_candidate_source` ON `candidates` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_crawlrun_source` ON `crawl_runs` (`source_id`);
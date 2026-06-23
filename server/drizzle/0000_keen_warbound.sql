CREATE TABLE `engagements` (
	`entity_id` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT '待评估',
	`owner` varchar(128),
	`note` text,
	`updated_by` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `engagements_entity_id` PRIMARY KEY(`entity_id`)
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(32) NOT NULL,
	`priority` varchar(8) NOT NULL,
	`score` int DEFAULT 0,
	`events` json,
	`region` varchar(128),
	`booth` varchar(255),
	`follower_scale` varchar(255),
	`follower_tier` varchar(255),
	`follower_note` text,
	`tags` json,
	`angles` json,
	`reason` text,
	`cases` json,
	`visuals` json,
	`links` json,
	`excluded` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`short` varchar(32) NOT NULL,
	`date` varchar(128),
	`month` varchar(32),
	`city` varchar(128),
	`region` varchar(64),
	`venue` varchar(255),
	`status` varchar(64),
	`tags` json,
	`note` text,
	`links` json,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`cadence` varchar(255),
	`fields` varchar(255),
	`links` json,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_engagement_status` ON `engagements` (`status`);--> statement-breakpoint
CREATE INDEX `idx_entity_type` ON `entities` (`type`);--> statement-breakpoint
CREATE INDEX `idx_entity_priority` ON `entities` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_entity_excluded` ON `entities` (`excluded`);--> statement-breakpoint
CREATE INDEX `idx_event_region` ON `events` (`region`);
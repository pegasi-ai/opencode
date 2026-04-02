CREATE TABLE `aiv_event` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`intent` text,
	`work_type` text,
	`location` text,
	`scope_files` integer,
	`scope_modules` integer,
	`previous_work_type` text,
	`metadata` text,
	`time_created` integer NOT NULL DEFAULT (unixepoch() * 1000),
	`time_updated` integer NOT NULL DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `aiv_event_session_idx` ON `aiv_event` (`session_id`);
--> statement-breakpoint
CREATE INDEX `aiv_event_session_time_idx` ON `aiv_event` (`session_id`, `time_created`);
--> statement-breakpoint
CREATE INDEX `aiv_event_type_idx` ON `aiv_event` (`type`);
--> statement-breakpoint
CREATE TABLE `aiv_state` (
	`session_id` text PRIMARY KEY,
	`intent` text,
	`work_type` text,
	`location` text,
	`scope_files` integer NOT NULL DEFAULT 0,
	`scope_modules` integer NOT NULL DEFAULT 0,
	`strategy_changes` integer NOT NULL DEFAULT 0,
	`time_created` integer NOT NULL DEFAULT (unixepoch() * 1000),
	`time_updated` integer NOT NULL DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);

DROP INDEX IF EXISTS `aiv_event_session_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `aiv_event_type_idx`;
--> statement-breakpoint
CREATE INDEX `aiv_state_time_updated_idx` ON `aiv_state` (`time_updated`);

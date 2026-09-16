-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `user_follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_blocks` (
	`user_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comment_mentions` (
	`comment_id` text NOT NULL,
	`mentioned_user_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xp_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`work_id` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mihon_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_type` text NOT NULL,
	`scopes` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked` integer NOT NULL,
	`device_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`work_id` text,
	`chapter_id` text,
	`target_user_id` text,
	`comment_id` text,
	`reason` text NOT NULL,
	`details` text,
	`status` text NOT NULL,
	`assigned_to` text,
	`resolution_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_achievements` (
	`user_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`icon` text NOT NULL,
	`badge_color` text NOT NULL,
	`xp_reward` integer NOT NULL,
	`condition_type` text NOT NULL,
	`condition_value` integer NOT NULL,
	`is_secret` integer NOT NULL,
	`order_index` integer NOT NULL,
	`created_at` text NOT NULL,
	`rarity` text NOT NULL,
	`reward_item_id` text
);
--> statement-breakpoint
CREATE TABLE `chapter_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shop_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`kind` text NOT NULL,
	`price_xp` integer NOT NULL,
	`is_animated` integer NOT NULL,
	`asset_url` text NOT NULL,
	`style_data` text NOT NULL,
	`min_level` integer NOT NULL,
	`is_active` integer NOT NULL,
	`order_index` integer NOT NULL,
	`created_at` text NOT NULL,
	`rarity` text NOT NULL,
	`status` text NOT NULL,
	`thumbnail_url` text
);
--> statement-breakpoint
CREATE TABLE `member_inventory` (
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`acquired_at` text NOT NULL,
	`origin` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_staff_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`priority_boost` integer NOT NULL,
	`reason` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`cancelled_by` text,
	`cancelled_at` text,
	`cancel_reason` text,
	`last_error` text,
	`last_attempt_at` text,
	`next_attempt_at` text,
	`attempt_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`code` text NOT NULL,
	`role` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`used_by` text,
	`revoked` integer NOT NULL,
	`created_at` text NOT NULL,
	`invited_user_id` text,
	`position_id` text,
	`status` text NOT NULL,
	`revoked_at` text,
	`declined_at` text
);
--> statement-breakpoint
CREATE TABLE `importer_chapter_manifest` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`chapter_number` real NOT NULL,
	`chapter_sort_key` integer NOT NULL,
	`chapter_title` text,
	`status` text NOT NULL,
	`selected_source` text,
	`available_sources` text NOT NULL,
	`page_count` integer,
	`last_checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_work_health` (
	`work_id` text NOT NULL,
	`health_status` text NOT NULL,
	`total_known_chapters` integer NOT NULL,
	`total_imported_chapters` integer NOT NULL,
	`missing_start` integer NOT NULL,
	`first_chapter_number` real,
	`latest_chapter_number` real,
	`gaps` text NOT NULL,
	`unresolved_gaps` text NOT NULL,
	`providers_summary` text NOT NULL,
	`last_reconciled_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_project_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text NOT NULL,
	`user_id` text NOT NULL,
	`message` text,
	`status` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`rejection_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_partner_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scan_name` text NOT NULL,
	`scan_slug` text NOT NULL,
	`description` text,
	`discord` text,
	`fluxer` text,
	`website` text,
	`sample_links` text,
	`status` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`rejection_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_staff_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`old_state` text,
	`new_state` text,
	`reason` text,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_transfer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`responded_at` text
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_key` text NOT NULL,
	`mime` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`storage_ready` integer NOT NULL,
	`purpose` text NOT NULL,
	`storage_pool_id` text,
	`storage_shard_id` text,
	`bot_reference` text,
	`access_class` text,
	`status` text,
	`pending_delete_at` text,
	`scan_id` text,
	`chapter_id` text
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`chapter_id` text NOT NULL,
	`position` integer NOT NULL,
	`media_id` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`user_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`next_page` integer NOT NULL,
	`accepted_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`work_id` text NOT NULL,
	`chapter_id` text,
	`parent_id` text,
	`body` text NOT NULL,
	`removed` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`work_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_tags` (
	`work_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`system_generated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comment_likes` (
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `access_roles` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`suspended` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library` (
	`user_id` text NOT NULL,
	`work_id` text NOT NULL,
	`status` text NOT NULL,
	`favorite` integer NOT NULL,
	`following` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading` (
	`user_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`page` integer NOT NULL,
	`max_page` integer NOT NULL,
	`completed_at` text,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_id` text,
	`created_at` text NOT NULL,
	`metadata` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `editor_invites` (
	`email` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_chapter_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_chapter_id` text NOT NULL,
	`chapter_id` text,
	`work_mapping_id` text NOT NULL,
	`chapter_number` real NOT NULL,
	`page_count` integer NOT NULL,
	`status` text NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_page_provider` integer NOT NULL,
	`work_id` text,
	`chapter_sort_key` real,
	`is_gap` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_scans` (
	`work_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`is_primary` integer NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chapter_scans` (
	`chapter_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`number` real NOT NULL,
	`title` text NOT NULL,
	`published_at` text,
	`source_id` text,
	`created_at` text NOT NULL,
	`origin` text NOT NULL,
	`views_total` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`enabled` integer NOT NULL,
	`rate_limit_per_second` real NOT NULL,
	`sync_interval_minutes` integer NOT NULL,
	`last_sync_at` text,
	`config` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`status` text NOT NULL,
	`cooldown_until` text,
	`blocked_reason` text,
	`blocked_details` text NOT NULL,
	`last_health_check_at` text
);
--> statement-breakpoint
CREATE TABLE `importer_work_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_work_id` text NOT NULL,
	`work_id` text,
	`source_slug` text NOT NULL,
	`source_title` text NOT NULL,
	`sync_status` text NOT NULL,
	`metadata` text NOT NULL,
	`last_synced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`confidence_score` real,
	`is_primary` integer,
	`match_method` text,
	`frozen_by` text,
	`frozen_at` text,
	`freeze_reason` text
);
--> statement-breakpoint
CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`aliases` text NOT NULL,
	`synopsis` text NOT NULL,
	`description` text NOT NULL,
	`author` text NOT NULL,
	`artist` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`year` integer,
	`age_rating` integer NOT NULL,
	`published` integer NOT NULL,
	`featured` integer NOT NULL,
	`cover_id` text,
	`source_id` text,
	`updated_at` text NOT NULL,
	`created_at` text NOT NULL,
	`search_text` text NOT NULL,
	`metadata_provenance` text NOT NULL,
	`content_rating` text NOT NULL,
	`views_total` integer NOT NULL,
	`latest_chapter_published_at` text
);
--> statement-breakpoint
CREATE TABLE `chapter_views` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`work_id` text NOT NULL,
	`user_id` text,
	`anonymous_hash` text,
	`origin` text NOT NULL,
	`viewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`task_type` text NOT NULL,
	`source` text NOT NULL,
	`priority` integer NOT NULL,
	`payload` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer NOT NULL,
	`max_attempts` integer NOT NULL,
	`locked_by` text,
	`locked_at` text,
	`lease_expires_at` text,
	`next_run_at` text NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`chapter_sort_key` real,
	`last_recovered_error` text,
	`recovered_at` text,
	`last_error_at` text,
	`retry_reason` text,
	`progress_current` integer,
	`progress_total` integer,
	`progress_stage` text,
	`cancel_requested` integer NOT NULL,
	`cancelled_by` text,
	`cancelled_at` text,
	`cancel_reason` text,
	`paused_by` text,
	`paused_at` text,
	`pause_reason` text
);
--> statement-breakpoint
CREATE TABLE `importer_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`cursor_value` text,
	`last_checked_at` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_telemetry` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`rss_mb` integer NOT NULL,
	`heap_used_mb` integer NOT NULL,
	`heap_total_mb` integer NOT NULL,
	`external_mb` integer NOT NULL,
	`array_buffers_mb` integer NOT NULL,
	`event_loop_lag_ms` integer NOT NULL,
	`concurrency` integer NOT NULL,
	`active_jobs` integer NOT NULL,
	`cycle_action` text NOT NULL,
	`cycle_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importer_job_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`source` text NOT NULL,
	`work_id` text,
	`chapter_id` text,
	`chapter_number` real NOT NULL,
	`page_count` integer NOT NULL,
	`total_bytes` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`download_ms` integer NOT NULL,
	`upload_ms` integer NOT NULL,
	`db_ms` integer NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text NOT NULL,
	`avatar_id` text,
	`xp` integer NOT NULL,
	`created_at` text NOT NULL,
	`is_test` integer NOT NULL,
	`age_status` text NOT NULL,
	`blur_nsfw` integer NOT NULL,
	`equipped_title_id` text,
	`equipped_badge_id` text,
	`manual_title` integer NOT NULL,
	`manual_badge` integer NOT NULL,
	`banner_id` text,
	`banner_position` text NOT NULL,
	`avatar_frame_id` text,
	`name_color` text,
	`equipped_medal_id` text,
	`equipped_comment_banner_id` text,
	`is_onboarded` integer NOT NULL,
	`equipped_banner_id` text,
	`privacy_show_achievements` integer NOT NULL,
	`privacy_show_cosmetics` integer NOT NULL,
	`featured_achievement_id` text,
	`privacy_show_favorites` integer NOT NULL,
	`privacy_show_reading_history` integer NOT NULL,
	`avatar_crop` text,
	`banner_crop` text,
	`privacy_show_scans` integer NOT NULL,
	`privacy_scan_mode` text NOT NULL,
	`admin_hide_scan_badges` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_shard_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`pool_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`strategy` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_shard_group_members` (
	`group_id` text NOT NULL,
	`shard_id` text NOT NULL,
	`weight` integer NOT NULL,
	`priority` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_records` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`storage_pool_id` text,
	`storage_shard_id` text,
	`backend` text NOT NULL,
	`bot_reference` text NOT NULL,
	`channel_id` text,
	`message_id` text,
	`file_id` text,
	`unique_file_id` text,
	`checksum` text,
	`size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`scan_id` text,
	`work_id` text,
	`chapter_id` text,
	`uploaded_by` text,
	`access_class` text NOT NULL,
	`status` text NOT NULL,
	`pending_delete_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`storage_shard_id` text NOT NULL,
	`role` text NOT NULL,
	`bot_reference` text NOT NULL,
	`channel_id` text,
	`message_id` text,
	`file_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_storage_usage` (
	`scan_id` text NOT NULL,
	`pages` integer NOT NULL,
	`bytes` integer NOT NULL,
	`uploads` integer NOT NULL,
	`failures` integer NOT NULL,
	`active_uploads` integer NOT NULL,
	`throughput` real NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `control_plane_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`backup_id` text NOT NULL,
	`schema_version` text NOT NULL,
	`record_counts` text NOT NULL,
	`checksum` text NOT NULL,
	`data_payload` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_pools` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`display_name` text NOT NULL,
	`purpose` text NOT NULL,
	`reserved` integer NOT NULL,
	`enabled` integer NOT NULL,
	`overflow_allowed` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_shards` (
	`id` text PRIMARY KEY NOT NULL,
	`pool_id` text NOT NULL,
	`backend` text NOT NULL,
	`bot_reference` text NOT NULL,
	`channel_id` text NOT NULL,
	`display_name` text NOT NULL,
	`enabled` integer NOT NULL,
	`reserved` integer NOT NULL,
	`owner_scan_id` text,
	`write_status` text NOT NULL,
	`read_status` text NOT NULL,
	`active_uploads` integer NOT NULL,
	`queue_depth` integer NOT NULL,
	`recent_successes` integer NOT NULL,
	`recent_failures` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	`throughput` real NOT NULL,
	`error_rate` real NOT NULL,
	`cooldown_until` text,
	`weight` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`assigned_chapters_count` integer NOT NULL,
	`assigned_pages_count` integer NOT NULL,
	`last_selected_at` text,
	`recent_bytes` integer,
	`recent_writes` integer,
	`recent_chapters` integer,
	`last_write_at` text,
	`last_success_at` text,
	`last_failure_at` text
);
--> statement-breakpoint
CREATE TABLE `scan_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`opening_id` text NOT NULL,
	`position_id` text NOT NULL,
	`user_id` text NOT NULL,
	`experience` text NOT NULL,
	`availability` text NOT NULL,
	`presentation` text NOT NULL,
	`portfolio_url` text,
	`contact_info` text NOT NULL,
	`status` text NOT NULL,
	`internal_notes` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`icon` text,
	`display_order` integer NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_member_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position_id` text NOT NULL,
	`is_primary` integer NOT NULL,
	`created_at` text NOT NULL,
	`is_public` integer NOT NULL,
	`hidden_by_admin` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_recruitment_openings` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`position_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`requirements` text NOT NULL,
	`language` text NOT NULL,
	`experience_level` text NOT NULL,
	`availability` text NOT NULL,
	`slots` integer,
	`notes` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_staff_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`is_pinned` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`removed` integer NOT NULL,
	`pinned` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_comment_likes` (
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_comment_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`logo_id` text,
	`banner_id` text,
	`website` text NOT NULL,
	`discord` text NOT NULL,
	`fluxer` text NOT NULL,
	`is_official` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`display_preposition` text NOT NULL,
	`pause_uploads` integer NOT NULL,
	`pause_recruitment` integer NOT NULL,
	`emergency_mode` integer NOT NULL,
	`emergency_reason` text,
	`status_reason` text,
	`bio` text,
	`pinned_items` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_members` (
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`is_public` integer NOT NULL,
	`hidden_by_admin` integer NOT NULL,
	`availability_status` text NOT NULL,
	`availability_message` text,
	`availability_updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_slug_history` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`old_slug` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_global_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text,
	`scan_name` text,
	`admin_id` text,
	`action` text NOT NULL,
	`reason` text,
	`metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_work_uploaders` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_workflow_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`color` text,
	`display_order` integer NOT NULL,
	`is_active` integer NOT NULL,
	`required` integer NOT NULL,
	`created_at` text NOT NULL,
	`dependencies` text NOT NULL,
	`position_id` text,
	`allowed_position_ids` text,
	`requires_output` integer NOT NULL,
	`output_type` text NOT NULL,
	`dependency_operator` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text,
	`chapter_id` text,
	`stage_id` text,
	`title` text NOT NULL,
	`description` text,
	`assigned_to` text,
	`created_by` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`due_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_task_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`from_user_id` text,
	`to_user_id` text NOT NULL,
	`transferred_by` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_recruitment_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`opening_id` text NOT NULL,
	`question` text NOT NULL,
	`question_type` text NOT NULL,
	`options` text,
	`required` integer NOT NULL,
	`display_order` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_application_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`question_id` text NOT NULL,
	`answer` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`platform` text NOT NULL,
	`webhook_url` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer NOT NULL,
	`notify_events` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_wiki_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content` text NOT NULL,
	`category` text NOT NULL,
	`is_pinned` integer NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_glossary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text NOT NULL,
	`source_term` text NOT NULL,
	`preferred_translation` text NOT NULL,
	`category` text NOT NULL,
	`notes` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_references` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text NOT NULL,
	`title` text NOT NULL,
	`ref_type` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_checklist_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`required` integer NOT NULL,
	`display_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_onboarding_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`title` text NOT NULL,
	`position_id` text,
	`items` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_member_onboarding` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`completed_items` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_pipeline_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`stages` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_chapter_qc_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`production_chapter_id` text,
	`chapter_id` text,
	`page_number` integer NOT NULL,
	`issue_type` text NOT NULL,
	`description` text NOT NULL,
	`assigned_to` text,
	`status` text NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_qc_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`display_order` integer NOT NULL,
	`is_private` integer NOT NULL,
	`allowed_roles` text NOT NULL,
	`is_archived` integer NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`channel_id` text,
	`production_chapter_id` text,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`mentions` text NOT NULL,
	`pinned` integer NOT NULL,
	`reply_to_id` text,
	`thread_count` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_edited` integer NOT NULL,
	`edited_at` text,
	`deleted_at` text,
	`deleted_by` text
);
--> statement-breakpoint
CREATE TABLE `scan_message_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`parent_message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`is_resolved` integer NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_channel_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`preference` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`deep_link` text,
	`is_read` integer NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`direct_mentions` integer NOT NULL,
	`role_mentions` integer NOT NULL,
	`tasks` integer NOT NULL,
	`chapters_waiting` integer NOT NULL,
	`comments` integer NOT NULL,
	`general_activity` integer NOT NULL,
	`email_enabled` integer NOT NULL,
	`email_frequency` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text,
	`recipient_user_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`subject` text NOT NULL,
	`html_body` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer NOT NULL,
	`last_error` text,
	`idempotency_key` text,
	`scheduled_at` text NOT NULL,
	`sent_at` text,
	`created_at` text NOT NULL,
	`provider_message_id` text,
	`delivery_status` text NOT NULL,
	`notification_id` text,
	`priority` text NOT NULL,
	`claimed_at` text,
	`claimed_by` text,
	`lease_expires_at` text,
	`cancellation_reason` text,
	`cancelled_by` text,
	`cancelled_at` text,
	`send_started_at` text,
	`provider_request_key` text,
	`reconciled_at` text,
	`reconciliation_notes` text
);
--> statement-breakpoint
CREATE TABLE `scan_wiki_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`version_number` integer NOT NULL,
	`author_id` text,
	`change_summary` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_tutorial_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tutorial_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`updated_by` text,
	`change_summary` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_tutorial_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`tutorial_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`is_favorite` integer NOT NULL,
	`read_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_academy_tutorials` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`is_published` integer NOT NULL,
	`target_position_id` text,
	`display_order` integer NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`status` text NOT NULL,
	`mandatory_for_roles` text
);
--> statement-breakpoint
CREATE TABLE `scan_production_files` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text,
	`production_chapter_id` text,
	`stage_id` text,
	`file_name` text NOT NULL,
	`byte_size` integer NOT NULL,
	`mime_type` text,
	`file_key` text NOT NULL,
	`provider` text NOT NULL,
	`version` integer NOT NULL,
	`uploaded_by` text,
	`is_current` integer NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`stage_slug` text,
	`input_files` text NOT NULL,
	`is_stale` integer NOT NULL,
	`stale_reason` text,
	`storage_pool_id` text,
	`storage_shard_id` text,
	`bot_reference` text,
	`telegram_file_id` text,
	`sha256` text
);
--> statement-breakpoint
CREATE TABLE `scan_mural_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`post_type` text NOT NULL,
	`is_pinned` integer NOT NULL,
	`pinned_at` text,
	`pinned_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_mural_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_comment_id` text,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_mural_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text,
	`comment_id` text,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`context_type` text NOT NULL,
	`context_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`original_filename` text NOT NULL,
	`safe_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`checksum` text,
	`storage_reference` text NOT NULL,
	`storage_provider` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_production_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text NOT NULL,
	`chapter_number` real NOT NULL,
	`chapter_title` text,
	`target_chapter_id` text,
	`status` text NOT NULL,
	`template` text NOT NULL,
	`checklist_state` text NOT NULL,
	`current_stage_slug` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`chapter_label` text,
	`chapter_type` text NOT NULL,
	`chapter_sort_key` real NOT NULL,
	`priority` text NOT NULL,
	`due_at` text,
	`publication_version` integer NOT NULL,
	`published_snapshot` text NOT NULL,
	`pause_reason` text,
	`cancel_reason` text
);
--> statement-breakpoint
CREATE TABLE `scan_chapter_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`chapter_id` text,
	`stage_id` text NOT NULL,
	`status` text NOT NULL,
	`assigned_to` text,
	`due_at` text,
	`notes` text,
	`completed_at` text,
	`completed_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`production_chapter_id` text,
	`claimed_at` text,
	`last_activity_at` text,
	`previous_assigned_to` text,
	`rejection_reason` text,
	`return_to_stage_id` text,
	`is_override` integer NOT NULL,
	`override_reason` text,
	`override_by` text,
	`override_action` text,
	`skip_reason` text,
	`skipped_by` text,
	`notified_available` integer NOT NULL,
	`availability_version` integer NOT NULL,
	`availability_reason` text NOT NULL,
	`qc_assignee_id` text
);
--> statement-breakpoint
CREATE TABLE `scan_work_workflow_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`work_id` text NOT NULL,
	`template` text NOT NULL,
	`custom_stages` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_chapter_timeline` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`production_chapter_id` text NOT NULL,
	`stage_id` text,
	`stage_slug` text,
	`event_type` text NOT NULL,
	`user_id` text,
	`user_name` text,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chapter_credit_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`production_chapter_id` text,
	`publication_version` integer NOT NULL,
	`scan_id` text,
	`scan_name_snapshot` text NOT NULL,
	`scan_slug_snapshot` text NOT NULL,
	`stage_name` text NOT NULL,
	`stage_slug` text NOT NULL,
	`position_name` text,
	`user_id` text,
	`display_name_snapshot` text NOT NULL,
	`avatar_id_snapshot` text,
	`role_order` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_channel_read_states` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_message_id` text,
	`last_read_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_pipeline_stage_seen` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`chapter_stage_id` text NOT NULL,
	`production_chapter_id` text NOT NULL,
	`stage_slug` text NOT NULL,
	`availability_version` integer NOT NULL,
	`seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`href` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	`actor_user_id` text,
	`title` text,
	`type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`priority` text NOT NULL,
	`scan_id` text,
	`context` text
);
--> statement-breakpoint
CREATE TABLE `scan_message_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`mention_type` text NOT NULL,
	`target_user_id` text,
	`target_role_id` text,
	`mention_text` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scan_id` text,
	`work_id` text NOT NULL,
	`chapter_id` text,
	`pool_key` text NOT NULL,
	`status` text NOT NULL,
	`total_pages` integer NOT NULL,
	`uploaded_pages` integer NOT NULL,
	`failed_pages` integer NOT NULL,
	`pages_metadata` text NOT NULL,
	`error_message` text,
	`paused_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` text PRIMARY KEY,
	`email` text,
	`encrypted_password` text,
	`created_at` text
);

*/
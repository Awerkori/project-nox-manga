export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_roles: {
        Row: {
          role: string
          suspended: boolean
          user_id: string
        }
        Insert: {
          role?: string
          suspended?: boolean
          user_id: string
        }
        Update: {
          role?: string
          suspended?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          badge_color: string
          category: string
          condition_type: string
          condition_value: number
          created_at: string
          description: string
          icon: string
          id: string
          is_secret: boolean
          order_index: number
          rarity: string
          reward_item_id: string | null
          title: string
          xp_reward: number
        }
        Insert: {
          badge_color?: string
          category: string
          condition_type: string
          condition_value?: number
          created_at?: string
          description: string
          icon?: string
          id: string
          is_secret?: boolean
          order_index?: number
          rarity?: string
          reward_item_id?: string | null
          title: string
          xp_reward?: number
        }
        Update: {
          badge_color?: string
          category?: string
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_secret?: boolean
          order_index?: number
          rarity?: string
          reward_item_id?: string | null
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_reactions: {
        Row: {
          chapter_id: string
          created_at: string
          emoji: string
          id: string
          visitor_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          emoji: string
          id?: string
          visitor_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          emoji?: string
          id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_reactions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_scans: {
        Row: {
          chapter_id: string
          created_at: string
          scan_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          scan_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_scans_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_scans_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_views: {
        Row: {
          anonymous_hash: string | null
          chapter_id: string
          id: string
          origin: string
          user_id: string | null
          viewed_at: string
          work_id: string
        }
        Insert: {
          anonymous_hash?: string | null
          chapter_id: string
          id?: string
          origin?: string
          user_id?: string | null
          viewed_at?: string
          work_id: string
        }
        Update: {
          anonymous_hash?: string | null
          chapter_id?: string
          id?: string
          origin?: string
          user_id?: string | null
          viewed_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_views_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_views_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          id: string
          number: number
          origin: string
          published_at: string | null
          source_id: string | null
          title: string
          views_total: number
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          number: number
          origin?: string
          published_at?: string | null
          source_id?: string | null
          title?: string
          views_total?: number
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: number
          origin?: string
          published_at?: string | null
          source_id?: string | null
          title?: string
          views_total?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          user_id: string
        }
        Update: {
          comment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          chapter_id: string | null
          created_at: string
          id: string
          parent_id: string | null
          removed: boolean
          updated_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          body: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          removed?: boolean
          updated_at?: string
          user_id: string
          work_id: string
        }
        Update: {
          body?: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          removed?: boolean
          updated_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      control_plane_backups: {
        Row: {
          backup_id: string
          checksum: string
          created_at: string
          data_payload: Json | null
          id: string
          record_counts: Json
          schema_version: string
        }
        Insert: {
          backup_id: string
          checksum: string
          created_at?: string
          data_payload?: Json | null
          id?: string
          record_counts: Json
          schema_version: string
        }
        Update: {
          backup_id?: string
          checksum?: string
          created_at?: string
          data_payload?: Json | null
          id?: string
          record_counts?: Json
          schema_version?: string
        }
        Relationships: []
      }
      editor_invites: {
        Row: {
          created_at: string
          created_by: string
          email: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
        }
        Relationships: [
          {
            foreignKeyName: "editor_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_chapter_manifest: {
        Row: {
          available_sources: Json
          chapter_number: number
          chapter_sort_key: number
          chapter_title: string | null
          id: string
          last_checked_at: string
          page_count: number | null
          selected_source: string | null
          status: string
          work_id: string
        }
        Insert: {
          available_sources?: Json
          chapter_number: number
          chapter_sort_key: number
          chapter_title?: string | null
          id?: string
          last_checked_at?: string
          page_count?: number | null
          selected_source?: string | null
          status: string
          work_id: string
        }
        Update: {
          available_sources?: Json
          chapter_number?: number
          chapter_sort_key?: number
          chapter_title?: string | null
          id?: string
          last_checked_at?: string
          page_count?: number | null
          selected_source?: string | null
          status?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_chapter_manifest_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_chapter_mappings: {
        Row: {
          chapter_id: string | null
          chapter_number: number
          chapter_sort_key: number | null
          created_at: string
          id: string
          is_gap: boolean
          is_page_provider: boolean
          last_error: string | null
          page_count: number
          source: string
          source_chapter_id: string
          status: string
          updated_at: string
          work_id: string | null
          work_mapping_id: string
        }
        Insert: {
          chapter_id?: string | null
          chapter_number: number
          chapter_sort_key?: number | null
          created_at?: string
          id?: string
          is_gap?: boolean
          is_page_provider?: boolean
          last_error?: string | null
          page_count?: number
          source: string
          source_chapter_id: string
          status?: string
          updated_at?: string
          work_id?: string | null
          work_mapping_id: string
        }
        Update: {
          chapter_id?: string | null
          chapter_number?: number
          chapter_sort_key?: number | null
          created_at?: string
          id?: string
          is_gap?: boolean
          is_page_provider?: boolean
          last_error?: string | null
          page_count?: number
          source?: string
          source_chapter_id?: string
          status?: string
          updated_at?: string
          work_id?: string | null
          work_mapping_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_chapter_mappings_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_chapter_mappings_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "importer_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_chapter_mappings_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_chapter_mappings_work_mapping_id_fkey"
            columns: ["work_mapping_id"]
            isOneToOne: false
            referencedRelation: "importer_work_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_checkpoints: {
        Row: {
          created_at: string
          cursor_value: string | null
          id: string
          last_checked_at: string
          metadata: Json
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor_value?: string | null
          id?: string
          last_checked_at?: string
          metadata?: Json
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor_value?: string | null
          id?: string
          last_checked_at?: string
          metadata?: Json
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_checkpoints_source_fkey"
            columns: ["source"]
            isOneToOne: true
            referencedRelation: "importer_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_job_metrics: {
        Row: {
          chapter_id: string | null
          chapter_number: number
          created_at: string
          db_ms: number
          download_ms: number
          duration_ms: number
          error_message: string | null
          id: string
          page_count: number
          source: string
          status: string
          total_bytes: number
          upload_ms: number
          work_id: string | null
          worker_id: string
        }
        Insert: {
          chapter_id?: string | null
          chapter_number: number
          created_at?: string
          db_ms?: number
          download_ms?: number
          duration_ms: number
          error_message?: string | null
          id?: string
          page_count: number
          source: string
          status: string
          total_bytes?: number
          upload_ms?: number
          work_id?: string | null
          worker_id: string
        }
        Update: {
          chapter_id?: string | null
          chapter_number?: number
          created_at?: string
          db_ms?: number
          download_ms?: number
          duration_ms?: number
          error_message?: string | null
          id?: string
          page_count?: number
          source?: string
          status?: string
          total_bytes?: number
          upload_ms?: number
          work_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_job_metrics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_job_metrics_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_queue: {
        Row: {
          attempts: number
          cancel_reason: string | null
          cancel_requested: boolean
          cancelled_at: string | null
          cancelled_by: string | null
          chapter_sort_key: number | null
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          last_error_at: string | null
          last_recovered_error: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_run_at: string
          pause_reason: string | null
          paused_at: string | null
          paused_by: string | null
          payload: Json
          priority: number
          progress_current: number | null
          progress_stage: string | null
          progress_total: number | null
          recovered_at: string | null
          retry_reason: string | null
          source: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          cancel_reason?: string | null
          cancel_requested?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          chapter_sort_key?: number | null
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_recovered_error?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_run_at?: string
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          payload?: Json
          priority?: number
          progress_current?: number | null
          progress_stage?: string | null
          progress_total?: number | null
          recovered_at?: string | null
          retry_reason?: string | null
          source: string
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          cancel_reason?: string | null
          cancel_requested?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          chapter_sort_key?: number | null
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_recovered_error?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_run_at?: string
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          payload?: Json
          priority?: number
          progress_current?: number | null
          progress_stage?: string | null
          progress_total?: number | null
          recovered_at?: string | null
          retry_reason?: string | null
          source?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_queue_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_queue_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_queue_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "importer_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_sources: {
        Row: {
          base_url: string
          blocked_details: Json
          blocked_reason: string | null
          config: Json
          cooldown_until: string | null
          created_at: string
          enabled: boolean
          id: string
          last_health_check_at: string | null
          last_sync_at: string | null
          name: string
          rate_limit_per_second: number
          status: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          base_url: string
          blocked_details?: Json
          blocked_reason?: string | null
          config?: Json
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          id: string
          last_health_check_at?: string | null
          last_sync_at?: string | null
          name: string
          rate_limit_per_second?: number
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          base_url?: string
          blocked_details?: Json
          blocked_reason?: string | null
          config?: Json
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_health_check_at?: string | null
          last_sync_at?: string | null
          name?: string
          rate_limit_per_second?: number
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      importer_staff_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_state: string | null
          old_state: string | null
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_state?: string | null
          old_state?: string | null
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_state?: string | null
          old_state?: string | null
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_staff_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_staff_requests: {
        Row: {
          attempt_count: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string | null
          priority_boost: number
          reason: string | null
          requested_by: string
          status: string
          updated_at: string
          work_id: string
        }
        Insert: {
          attempt_count?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          priority_boost?: number
          reason?: string | null
          requested_by: string
          status?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          attempt_count?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          priority_boost?: number
          reason?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_staff_requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_staff_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_staff_requests_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_telemetry: {
        Row: {
          active_jobs: number
          array_buffers_mb: number
          concurrency: number
          created_at: string
          cycle_action: string
          cycle_reason: string | null
          event_loop_lag_ms: number
          external_mb: number
          heap_total_mb: number
          heap_used_mb: number
          id: string
          rss_mb: number
          worker_id: string
        }
        Insert: {
          active_jobs: number
          array_buffers_mb: number
          concurrency: number
          created_at?: string
          cycle_action: string
          cycle_reason?: string | null
          event_loop_lag_ms: number
          external_mb: number
          heap_total_mb: number
          heap_used_mb: number
          id?: string
          rss_mb: number
          worker_id: string
        }
        Update: {
          active_jobs?: number
          array_buffers_mb?: number
          concurrency?: number
          created_at?: string
          cycle_action?: string
          cycle_reason?: string | null
          event_loop_lag_ms?: number
          external_mb?: number
          heap_total_mb?: number
          heap_used_mb?: number
          id?: string
          rss_mb?: number
          worker_id?: string
        }
        Relationships: []
      }
      importer_work_health: {
        Row: {
          created_at: string
          first_chapter_number: number | null
          gaps: Json
          health_status: string
          last_reconciled_at: string
          latest_chapter_number: number | null
          missing_start: boolean
          providers_summary: Json
          total_imported_chapters: number
          total_known_chapters: number
          unresolved_gaps: Json
          updated_at: string
          work_id: string
        }
        Insert: {
          created_at?: string
          first_chapter_number?: number | null
          gaps?: Json
          health_status: string
          last_reconciled_at?: string
          latest_chapter_number?: number | null
          missing_start?: boolean
          providers_summary?: Json
          total_imported_chapters?: number
          total_known_chapters?: number
          unresolved_gaps?: Json
          updated_at?: string
          work_id: string
        }
        Update: {
          created_at?: string
          first_chapter_number?: number | null
          gaps?: Json
          health_status?: string
          last_reconciled_at?: string
          latest_chapter_number?: number | null
          missing_start?: boolean
          providers_summary?: Json
          total_imported_chapters?: number
          total_known_chapters?: number
          unresolved_gaps?: Json
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "importer_work_health_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_work_mappings: {
        Row: {
          confidence_score: number | null
          created_at: string
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by: string | null
          id: string
          is_primary: boolean | null
          last_synced_at: string | null
          match_method: string | null
          metadata: Json
          source: string
          source_slug: string
          source_title: string
          source_work_id: string
          sync_status: string
          updated_at: string
          work_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          is_primary?: boolean | null
          last_synced_at?: string | null
          match_method?: string | null
          metadata?: Json
          source: string
          source_slug: string
          source_title: string
          source_work_id: string
          sync_status?: string
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          is_primary?: boolean | null
          last_synced_at?: string | null
          match_method?: string | null
          metadata?: Json
          source?: string
          source_slug?: string
          source_title?: string
          source_work_id?: string
          sync_status?: string
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importer_work_mappings_frozen_by_fkey"
            columns: ["frozen_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_work_mappings_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "importer_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importer_work_mappings_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      library: {
        Row: {
          favorite: boolean
          following: boolean
          status: string
          updated_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          favorite?: boolean
          following?: boolean
          status?: string
          updated_at?: string
          user_id: string
          work_id: string
        }
        Update: {
          favorite?: boolean
          following?: boolean
          status?: string
          updated_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          user_id: string
          work_id: string
        }
        Insert: {
          user_id: string
          work_id: string
        }
        Update: {
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          access_class: string | null
          bot_reference: string | null
          bytes: number
          chapter_id: string | null
          created_at: string
          created_by: string
          height: number
          id: string
          mime: string
          pending_delete_at: string | null
          provider: string
          provider_key: string
          purpose: string
          scan_id: string | null
          sha256: string
          status: string | null
          storage_pool_id: string | null
          storage_ready: boolean
          storage_shard_id: string | null
          width: number
        }
        Insert: {
          access_class?: string | null
          bot_reference?: string | null
          bytes: number
          chapter_id?: string | null
          created_at?: string
          created_by: string
          height: number
          id?: string
          mime: string
          pending_delete_at?: string | null
          provider: string
          provider_key: string
          purpose?: string
          scan_id?: string | null
          sha256: string
          status?: string | null
          storage_pool_id?: string | null
          storage_ready?: boolean
          storage_shard_id?: string | null
          width: number
        }
        Update: {
          access_class?: string | null
          bot_reference?: string | null
          bytes?: number
          chapter_id?: string | null
          created_at?: string
          created_by?: string
          height?: number
          id?: string
          mime?: string
          pending_delete_at?: string | null
          provider?: string
          provider_key?: string
          purpose?: string
          scan_id?: string | null
          sha256?: string
          status?: string | null
          storage_pool_id?: string | null
          storage_ready?: boolean
          storage_shard_id?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_storage_pool_id_fkey"
            columns: ["storage_pool_id"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_storage_shard_id_fkey"
            columns: ["storage_shard_id"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]
          },
        ]
      }
      media_locations: {
        Row: {
          bot_reference: string
          channel_id: string | null
          created_at: string
          file_id: string
          id: string
          media_id: string
          message_id: string | null
          role: string
          status: string
          storage_shard_id: string
        }
        Insert: {
          bot_reference?: string
          channel_id?: string | null
          created_at?: string
          file_id: string
          id?: string
          media_id: string
          message_id?: string | null
          role?: string
          status?: string
          storage_shard_id: string
        }
        Update: {
          bot_reference?: string
          channel_id?: string | null
          created_at?: string
          file_id?: string
          id?: string
          media_id?: string
          message_id?: string | null
          role?: string
          status?: string
          storage_shard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_locations_storage_shard_id_fkey"
            columns: ["storage_shard_id"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]
          },
        ]
      }
      media_records: {
        Row: {
          access_class: string
          backend: string
          bot_reference: string
          channel_id: string | null
          chapter_id: string | null
          checksum: string | null
          created_at: string
          file_id: string | null
          id: string
          message_id: string | null
          mime_type: string
          pending_delete_at: string | null
          purpose: string
          scan_id: string | null
          size: number
          status: string
          storage_pool_id: string | null
          storage_shard_id: string | null
          unique_file_id: string | null
          uploaded_by: string | null
          work_id: string | null
        }
        Insert: {
          access_class?: string
          backend?: string
          bot_reference?: string
          channel_id?: string | null
          chapter_id?: string | null
          checksum?: string | null
          created_at?: string
          file_id?: string | null
          id: string
          message_id?: string | null
          mime_type: string
          pending_delete_at?: string | null
          purpose: string
          scan_id?: string | null
          size?: number
          status?: string
          storage_pool_id?: string | null
          storage_shard_id?: string | null
          unique_file_id?: string | null
          uploaded_by?: string | null
          work_id?: string | null
        }
        Update: {
          access_class?: string
          backend?: string
          bot_reference?: string
          channel_id?: string | null
          chapter_id?: string | null
          checksum?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string
          pending_delete_at?: string | null
          purpose?: string
          scan_id?: string | null
          size?: number
          status?: string
          storage_pool_id?: string | null
          storage_shard_id?: string | null
          unique_file_id?: string | null
          uploaded_by?: string | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_records_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_records_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_records_storage_pool_id_fkey"
            columns: ["storage_pool_id"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_records_storage_shard_id_fkey"
            columns: ["storage_shard_id"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_records_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      member_achievements: {
        Row: {
          achievement_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_inventory: {
        Row: {
          acquired_at: string
          item_id: string
          origin: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          item_id: string
          origin?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          item_id?: string
          origin?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          age_status: string
          avatar_crop: Json | null
          avatar_frame_id: string | null
          avatar_id: string | null
          banner_crop: Json | null
          banner_id: string | null
          banner_position: string
          bio: string
          blur_nsfw: boolean
          created_at: string
          display_name: string
          equipped_badge_id: string | null
          equipped_banner_id: string | null
          equipped_comment_banner_id: string | null
          equipped_medal_id: string | null
          equipped_title_id: string | null
          featured_achievement_id: string | null
          id: string
          is_onboarded: boolean
          is_test: boolean
          manual_badge: boolean
          manual_title: boolean
          name_color: string | null
          privacy_show_achievements: boolean
          privacy_show_cosmetics: boolean
          privacy_show_favorites: boolean
          privacy_show_reading_history: boolean
          username: string
          xp: number
        }
        Insert: {
          age_status?: string
          avatar_crop?: Json | null
          avatar_frame_id?: string | null
          avatar_id?: string | null
          banner_crop?: Json | null
          banner_id?: string | null
          banner_position?: string
          bio?: string
          blur_nsfw?: boolean
          created_at?: string
          display_name: string
          equipped_badge_id?: string | null
          equipped_banner_id?: string | null
          equipped_comment_banner_id?: string | null
          equipped_medal_id?: string | null
          equipped_title_id?: string | null
          featured_achievement_id?: string | null
          id: string
          is_onboarded?: boolean
          is_test?: boolean
          manual_badge?: boolean
          manual_title?: boolean
          name_color?: string | null
          privacy_show_achievements?: boolean
          privacy_show_cosmetics?: boolean
          privacy_show_favorites?: boolean
          privacy_show_reading_history?: boolean
          username: string
          xp?: number
        }
        Update: {
          age_status?: string
          avatar_crop?: Json | null
          avatar_frame_id?: string | null
          avatar_id?: string | null
          banner_crop?: Json | null
          banner_id?: string | null
          banner_position?: string
          bio?: string
          blur_nsfw?: boolean
          created_at?: string
          display_name?: string
          equipped_badge_id?: string | null
          equipped_banner_id?: string | null
          equipped_comment_banner_id?: string | null
          equipped_medal_id?: string | null
          equipped_title_id?: string | null
          featured_achievement_id?: string | null
          id?: string
          is_onboarded?: boolean
          is_test?: boolean
          manual_badge?: boolean
          manual_title?: boolean
          name_color?: string | null
          privacy_show_achievements?: boolean
          privacy_show_cosmetics?: boolean
          privacy_show_favorites?: boolean
          privacy_show_reading_history?: boolean
          username?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "members_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_featured_achievement_id_fkey"
            columns: ["featured_achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      mihon_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          expires_at: string
          id: string
          revoked: boolean
          scopes: string[]
          token_hash: string
          token_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          expires_at: string
          id?: string
          revoked?: boolean
          scopes?: string[]
          token_hash: string
          token_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          expires_at?: string
          id?: string
          revoked?: boolean
          scopes?: string[]
          token_hash?: string
          token_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mihon_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          href: string
          id: string
          kind: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key: string
          href: string
          id?: string
          kind: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          href?: string
          id?: string
          kind?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          chapter_id: string
          height: number
          media_id: string
          position: number
          width: number
        }
        Insert: {
          chapter_id: string
          height: number
          media_id: string
          position: number
          width: number
        }
        Update: {
          chapter_id?: string
          height?: number
          media_id?: string
          position?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      reading: {
        Row: {
          chapter_id: string
          completed_at: string | null
          max_page: number
          page: number
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          completed_at?: string | null
          max_page?: number
          page?: number
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          completed_at?: string | null
          max_page?: number
          page?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_sessions: {
        Row: {
          accepted_at: string
          chapter_id: string
          next_page: number
          user_id: string
        }
        Insert: {
          accepted_at?: string
          chapter_id: string
          next_page?: number
          user_id: string
        }
        Update: {
          accepted_at?: string
          chapter_id?: string
          next_page?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assigned_to: string | null
          chapter_id: string | null
          comment_id: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_notes: string | null
          status: string
          target_type: string
          target_user_id: string | null
          updated_at: string
          work_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          chapter_id?: string | null
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution_notes?: string | null
          status?: string
          target_type: string
          target_user_id?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          chapter_id?: string | null
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_notes?: string | null
          status?: string
          target_type?: string
          target_user_id?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          revoked: boolean
          role: string
          scan_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          revoked?: boolean
          role: string
          scan_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          revoked?: boolean
          role?: string
          scan_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_invites_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_members: {
        Row: {
          created_at: string
          role: string
          scan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          scan_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          scan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_members_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_partner_requests: {
        Row: {
          created_at: string
          description: string | null
          discord: string | null
          fluxer: string | null
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sample_links: string | null
          scan_name: string
          scan_slug: string
          status: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discord?: string | null
          fluxer?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_links?: string | null
          scan_name: string
          scan_slug: string
          status?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discord?: string | null
          fluxer?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_links?: string | null
          scan_name?: string
          scan_slug?: string
          status?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_partner_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_partner_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_project_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scan_id: string
          status: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_id: string
          status?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_id?: string
          status?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_project_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_project_requests_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_project_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_project_requests_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_storage_usage: {
        Row: {
          active_uploads: number
          bytes: number
          failures: number
          pages: number
          scan_id: string
          throughput: number
          updated_at: string
          uploads: number
        }
        Insert: {
          active_uploads?: number
          bytes?: number
          failures?: number
          pages?: number
          scan_id: string
          throughput?: number
          updated_at?: string
          uploads?: number
        }
        Update: {
          active_uploads?: number
          bytes?: number
          failures?: number
          pages?: number
          scan_id?: string
          throughput?: number
          updated_at?: string
          uploads?: number
        }
        Relationships: [
          {
            foreignKeyName: "scan_storage_usage_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_transfer_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          responded_at: string | null
          scan_id: string
          status: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          responded_at?: string | null
          scan_id: string
          status?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          responded_at?: string | null
          scan_id?: string
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_transfer_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_transfer_requests_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_transfer_requests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          banner_id: string | null
          created_at: string
          description: string
          discord: string
          fluxer: string
          id: string
          is_official: boolean
          logo_id: string | null
          name: string
          slug: string
          status: string
          updated_at: string
          website: string
        }
        Insert: {
          banner_id?: string | null
          created_at?: string
          description?: string
          discord?: string
          fluxer?: string
          id?: string
          is_official?: boolean
          logo_id?: string | null
          name: string
          slug: string
          status?: string
          updated_at?: string
          website?: string
        }
        Update: {
          banner_id?: string | null
          created_at?: string
          description?: string
          discord?: string
          fluxer?: string
          id?: string
          is_official?: boolean
          logo_id?: string | null
          name?: string
          slug?: string
          status?: string
          updated_at?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_logo_id_fkey"
            columns: ["logo_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          asset_url: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_animated: boolean
          kind: string
          min_level: number
          name: string
          order_index: number
          price_xp: number
          rarity: string
          status: string
          style_data: Json
          thumbnail_url: string | null
        }
        Insert: {
          asset_url?: string
          created_at?: string
          description?: string
          id: string
          is_active?: boolean
          is_animated?: boolean
          kind: string
          min_level?: number
          name: string
          order_index?: number
          price_xp: number
          rarity?: string
          status?: string
          style_data?: Json
          thumbnail_url?: string | null
        }
        Update: {
          asset_url?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_animated?: boolean
          kind?: string
          min_level?: number
          name?: string
          order_index?: number
          price_xp?: number
          rarity?: string
          status?: string
          style_data?: Json
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      storage_pools: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          key: string
          overflow_allowed: boolean
          purpose: string
          reserved: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          key: string
          overflow_allowed?: boolean
          purpose: string
          reserved?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          key?: string
          overflow_allowed?: boolean
          purpose?: string
          reserved?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      storage_shard_group_members: {
        Row: {
          group_id: string
          priority: number
          shard_id: string
          weight: number
        }
        Insert: {
          group_id: string
          priority?: number
          shard_id: string
          weight?: number
        }
        Update: {
          group_id?: string
          priority?: number
          shard_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "storage_shard_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "storage_shard_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_shard_group_members_shard_id_fkey"
            columns: ["shard_id"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_shard_groups: {
        Row: {
          created_at: string
          id: string
          pool_id: string
          scope_id: string
          scope_type: string
          strategy: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pool_id: string
          scope_id: string
          scope_type?: string
          strategy?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pool_id?: string
          scope_id?: string
          scope_type?: string
          strategy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_shard_groups_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_shards: {
        Row: {
          active_uploads: number
          backend: string
          bot_reference: string
          channel_id: string
          cooldown_until: string | null
          created_at: string
          display_name: string
          enabled: boolean
          error_rate: number
          id: string
          latency_ms: number
          owner_scan_id: string | null
          pool_id: string
          queue_depth: number
          read_status: string
          recent_failures: number
          recent_successes: number
          reserved: boolean
          throughput: number
          updated_at: string
          weight: number
          write_status: string
        }
        Insert: {
          active_uploads?: number
          backend?: string
          bot_reference: string
          channel_id: string
          cooldown_until?: string | null
          created_at?: string
          display_name: string
          enabled?: boolean
          error_rate?: number
          id?: string
          latency_ms?: number
          owner_scan_id?: string | null
          pool_id: string
          queue_depth?: number
          read_status?: string
          recent_failures?: number
          recent_successes?: number
          reserved?: boolean
          throughput?: number
          updated_at?: string
          weight?: number
          write_status?: string
        }
        Update: {
          active_uploads?: number
          backend?: string
          bot_reference?: string
          channel_id?: string
          cooldown_until?: string | null
          created_at?: string
          display_name?: string
          enabled?: boolean
          error_rate?: number
          id?: string
          latency_ms?: number
          owner_scan_id?: string | null
          pool_id?: string
          queue_depth?: number
          read_status?: string
          recent_failures?: number
          recent_successes?: number
          reserved?: boolean
          throughput?: number
          updated_at?: string
          weight?: number
          write_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_shards_owner_scan_id_fkey"
            columns: ["owner_scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_shards_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          kind: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          kind?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          blocked_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          blocked_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      work_scans: {
        Row: {
          created_at: string
          is_primary: boolean
          scan_id: string
          status: string
          work_id: string
        }
        Insert: {
          created_at?: string
          is_primary?: boolean
          scan_id: string
          status?: string
          work_id: string
        }
        Update: {
          created_at?: string
          is_primary?: boolean
          scan_id?: string
          status?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_scans_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_scans_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tags: {
        Row: {
          system_generated: boolean
          tag_id: string
          work_id: string
        }
        Insert: {
          system_generated?: boolean
          tag_id: string
          work_id: string
        }
        Update: {
          system_generated?: boolean
          tag_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tags_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          age_rating: number
          aliases: string[]
          artist: string
          author: string
          content_rating: string
          cover_id: string | null
          created_at: string
          description: string
          featured: boolean
          id: string
          kind: string
          metadata_provenance: Json
          published: boolean
          search_text: string
          slug: string
          source_id: string | null
          status: string
          synopsis: string
          title: string
          updated_at: string
          views_total: number
          year: number | null
        }
        Insert: {
          age_rating?: number
          aliases?: string[]
          artist?: string
          author?: string
          content_rating?: string
          cover_id?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          kind?: string
          metadata_provenance?: Json
          published?: boolean
          search_text?: string
          slug: string
          source_id?: string | null
          status?: string
          synopsis?: string
          title: string
          updated_at?: string
          views_total?: number
          year?: number | null
        }
        Update: {
          age_rating?: number
          aliases?: string[]
          artist?: string
          author?: string
          content_rating?: string
          cover_id?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          kind?: string
          metadata_provenance?: Json
          published?: boolean
          search_text?: string
          slug?: string
          source_id?: string | null
          status?: string
          synopsis?: string
          title?: string
          updated_at?: string
          views_total?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "works_cover_id_fkey"
            columns: ["cover_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_awards: {
        Row: {
          amount: number
          chapter_id: string
          created_at: string
          id: string
          source: string
          user_id: string
          work_id: string
        }
        Insert: {
          amount?: number
          chapter_id: string
          created_at?: string
          id?: string
          source?: string
          user_id: string
          work_id: string
        }
        Update: {
          amount?: number
          chapter_id?: string
          created_at?: string
          id?: string
          source?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_awards_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_awards_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buy_shop_item: { Args: { p_item_id: string }; Returns: Json }
      can_manage_scan_members: {
        Args: { p_scan_id: string; p_user_id?: string }
        Returns: boolean
      }
      can_manage_scan_works: {
        Args: { p_scan_id: string; p_user_id?: string }
        Returns: boolean
      }
      cancel_scan_partner_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      cancel_scan_project_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      cancel_scan_transfer_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      claim_chapter_xp: {
        Args: { p_chapter_id: string; p_source?: string }
        Returns: Json
      }
      claim_editor_invite: { Args: never; Returns: boolean }
      claim_scan_invite: { Args: { p_code: string }; Returns: Json }
      commit_media_record: {
        Args: {
          p_id: string
          p_message_id?: string
          p_provider_key: string
          p_shard_id: string
          p_unique_file_id?: string
        }
        Returns: undefined
      }
      create_scan_invite: {
        Args: { p_hours?: number; p_role?: string; p_scan_id: string }
        Returns: Json
      }
      current_role: { Args: never; Returns: string }
      editor_action: { Args: { p_action: string; p_data: Json }; Returns: Json }
      equip_cosmetic_item: {
        Args: { p_item_id: string; p_kind: string }
        Returns: Json
      }
      execute_control_plane_backup: { Args: never; Returns: string }
      get_chapter_reactions: {
        Args: { p_chapter_id: string; p_visitor_id?: string }
        Returns: Json
      }
      grant_member_cosmetic: {
        Args: { p_item_id: string; p_origin?: string; p_user: string }
        Returns: boolean
      }
      importer_acquire_job: {
        Args: {
          p_lease_duration?: string
          p_source?: string
          p_worker_id: string
        }
        Returns: {
          attempts: number
          chapter_sort_key: number
          dedupe_key: string
          id: string
          last_error: string
          lease_expires_at: string
          locked_at: string
          locked_by: string
          max_attempts: number
          next_run_at: string
          payload: Json
          priority: number
          source: string
          status: string
          task_type: string
        }[]
      }
      importer_cancel_staff_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      importer_check_publication_barrier: {
        Args: { p_target_sort_key: number; p_work_id: string }
        Returns: {
          blocking_count: number
          blocking_sort_keys: number[]
          can_publish: boolean
          reason: string
        }[]
      }
      importer_prioritize_work: {
        Args: {
          p_force_replace?: boolean
          p_reason?: string
          p_work_id: string
        }
        Returns: Json
      }
      importer_prune_telemetry: {
        Args: { p_job_metrics_days?: number; p_telemetry_hours?: number }
        Returns: undefined
      }
      importer_recover_stalled_leases: {
        Args: never
        Returns: {
          failed_count: number
          recovered_count: number
        }[]
      }
      importer_release_job: {
        Args: {
          p_error?: string
          p_job_id: string
          p_retry_delay?: string
          p_status: string
          p_worker_id: string
        }
        Returns: boolean
      }
      importer_renew_lease: {
        Args: {
          p_job_id: string
          p_lease_duration?: string
          p_worker_id: string
        }
        Returns: boolean
      }
      importer_request_reconciliation: {
        Args: { p_work_id: string }
        Returns: Json
      }
      importer_staff_cancel_job: {
        Args: { p_actor_id?: string; p_job_id: string; p_reason?: string }
        Returns: Json
      }
      importer_staff_freeze_work: {
        Args: { p_actor_id?: string; p_reason?: string; p_work_id: string }
        Returns: Json
      }
      importer_staff_pause_job: {
        Args: { p_actor_id?: string; p_job_id: string; p_reason?: string }
        Returns: Json
      }
      importer_staff_postpone_job: {
        Args: { p_actor_id?: string; p_delay: string; p_job_id: string }
        Returns: Json
      }
      importer_staff_resume_job: {
        Args: { p_actor_id?: string; p_job_id: string }
        Returns: Json
      }
      importer_staff_unfreeze_work: {
        Args: { p_actor_id?: string; p_work_id: string }
        Returns: Json
      }
      invite_editor: { Args: { p_email: string }; Returns: undefined }
      is_editor: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_scan_member: {
        Args: { p_scan_id: string; p_user_id?: string }
        Returns: boolean
      }
      member_action: { Args: { p_action: string; p_data: Json }; Returns: Json }
      member_public_profile_stats: {
        Args: { p_user: string }
        Returns: {
          achievements_total: number
          achievements_unlocked: number
          chapters_read: number
          completed_works: number
          cosmetics_count: number
          favorites: number
          total_works: number
        }[]
      }
      member_public_stats: {
        Args: { p_user: string }
        Returns: {
          chapters_read: number
          completed_works: number
          favorites: number
        }[]
      }
      owner_action: { Args: { p_action: string; p_data: Json }; Returns: Json }
      public_chapter: { Args: { p_id: string }; Returns: boolean }
      public_settings: {
        Args: never
        Returns: {
          key: string
          value: string
        }[]
      }
      purchase_shop_item: { Args: { p_item_id: string }; Returns: Json }
      quarantine_media_record: {
        Args: { p_grace_days?: number; p_id: string }
        Returns: undefined
      }
      record_chapter_view: {
        Args: {
          p_anon_hash?: string
          p_chapter_id: string
          p_origin?: string
          p_user_id?: string
        }
        Returns: Json
      }
      record_shard_upload_result: {
        Args: {
          p_bytes?: number
          p_error_code?: number
          p_latency_ms?: number
          p_retry_after?: number
          p_shard_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      record_shard_upload_start: {
        Args: { p_shard_id: string }
        Returns: undefined
      }
      request_scan_ownership_transfer: {
        Args: { p_scan_id: string; p_target_user_id: string }
        Returns: Json
      }
      reserve_media: {
        Args: {
          p_bytes: number
          p_height: number
          p_id: string
          p_mime: string
          p_provider: string
          p_purpose?: string
          p_sha256: string
          p_user: string
          p_width: number
        }
        Returns: undefined
      }
      respond_scan_ownership_transfer: {
        Args: { p_accept: boolean; p_request_id: string }
        Returns: Json
      }
      review_scan_partner_request: {
        Args: { p_action: string; p_reason?: string; p_request_id: string }
        Returns: Json
      }
      review_scan_project_request: {
        Args: { p_action: string; p_reason?: string; p_request_id: string }
        Returns: Json
      }
      revoke_editor_invite: { Args: { p_email: string }; Returns: undefined }
      select_optimal_storage_shard: {
        Args: { p_chapter_id?: string; p_pool_key: string; p_scan_id?: string }
        Returns: {
          backend: string
          bot_reference: string
          channel_id: string
          display_name: string
          is_overflow: boolean
          pool_id: string
          shard_id: string
          write_status: string
        }[]
      }
      set_featured_achievement: {
        Args: { p_achievement_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      toggle_chapter_reaction: {
        Args: { p_chapter_id: string; p_emoji: string; p_visitor_id: string }
        Returns: Json
      }
      toggle_follow_user: { Args: { p_target_user_id: string }; Returns: Json }
      transfer_scan_ownership: {
        Args: { p_new_owner_id: string; p_scan_id: string }
        Returns: Json
      }
      update_work_scan_status: {
        Args: { p_scan_id: string; p_status: string; p_work_id: string }
        Returns: Json
      }
      work_metrics: {
        Args: { p_work: string }
        Returns: {
          favorites: number
          likes: number
          readers: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

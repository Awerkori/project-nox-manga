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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
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
          id: string
          chapter_id: string
          visitor_id: string
          user_id: string | null
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          visitor_id: string
          user_id?: string | null
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string
          visitor_id?: string
          user_id?: string | null
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_reactions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          }
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
          chapter_sort_key: number | null
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_run_at: string
          payload: Json
          priority: number
          source: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          chapter_sort_key?: number | null
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_run_at?: string
          payload?: Json
          priority?: number
          source: string
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          chapter_sort_key?: number | null
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_run_at?: string
          payload?: Json
          priority?: number
          source?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
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
          config: Json
          cooldown_until: string | null
          created_at: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          name: string
          rate_limit_per_second: number
          status: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          base_url: string
          config?: Json
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          id: string
          last_sync_at?: string | null
          name: string
          rate_limit_per_second?: number
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          base_url?: string
          config?: Json
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          name?: string
          rate_limit_per_second?: number
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      importer_staff_requests: {
        Row: {
          created_at: string
          id: string
          priority_boost: number
          reason: string | null
          requested_by: string
          status: string
          updated_at: string
          work_id: string
          cancelled_by: string | null
          cancelled_at: string | null
          cancel_reason: string | null
          last_error: string | null
          last_attempt_at: string | null
          next_attempt_at: string | null
          attempt_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          priority_boost?: number
          reason?: string | null
          requested_by: string
          status?: string
          updated_at?: string
          work_id: string
          cancelled_by?: string | null
          cancelled_at?: string | null
          cancel_reason?: string | null
          last_error?: string | null
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          attempt_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          priority_boost?: number
          reason?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
          work_id?: string
          cancelled_by?: string | null
          cancelled_at?: string | null
          cancel_reason?: string | null
          last_error?: string | null
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          attempt_count?: number
        }
        Relationships: [
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
      importer_work_mappings: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
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
          created_at?: string
          id?: string
          last_synced_at?: string | null
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
          created_at?: string
          id?: string
          last_synced_at?: string | null
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
          bytes: number
          created_at: string
          created_by: string
          height: number
          id: string
          mime: string
          provider: string
          provider_key: string
          purpose: string
          sha256: string
          storage_ready: boolean
          width: number
        }
        Insert: {
          bytes: number
          created_at?: string
          created_by: string
          height: number
          id?: string
          mime: string
          provider: string
          provider_key: string
          purpose?: string
          sha256: string
          storage_ready?: boolean
          width: number
        }
        Update: {
          bytes?: number
          created_at?: string
          created_by?: string
          height?: number
          id?: string
          mime?: string
          provider?: string
          provider_key?: string
          purpose?: string
          sha256?: string
          storage_ready?: boolean
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          age_status: string
          avatar_id: string | null
          bio: string
          blur_nsfw: boolean
          created_at: string
          display_name: string
          equipped_badge_id: string | null
          equipped_title_id: string | null
          id: string
          is_test: boolean
          username: string
          xp: number
        }
        Insert: {
          age_status?: string
          avatar_id?: string | null
          bio?: string
          blur_nsfw?: boolean
          created_at?: string
          display_name: string
          equipped_badge_id?: string | null
          equipped_title_id?: string | null
          id: string
          is_test?: boolean
          username: string
          xp?: number
        }
        Update: {
          age_status?: string
          avatar_id?: string | null
          bio?: string
          blur_nsfw?: boolean
          created_at?: string
          display_name?: string
          equipped_badge_id?: string | null
          equipped_title_id?: string | null
          id?: string
          is_test?: boolean
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
      claim_chapter_xp: {
        Args: { p_chapter_id: string; p_source?: string }
        Returns: Json
      }
      claim_editor_invite: { Args: never; Returns: boolean }
      current_role: { Args: never; Returns: string }
      editor_action: { Args: { p_action: string; p_data: Json }; Returns: Json }
      get_chapter_reactions: {
        Args: { p_chapter_id: string; p_visitor_id: string }
        Returns: Json
      }
      toggle_chapter_reaction: {
        Args: { p_chapter_id: string; p_visitor_id: string; p_emoji: string }
        Returns: Json
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
        Args: { p_reason?: string; p_work_id: string }
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
      invite_editor: { Args: { p_email: string }; Returns: undefined }
      is_editor: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      member_action: { Args: { p_action: string; p_data: Json }; Returns: Json }
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
      revoke_editor_invite: { Args: { p_email: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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

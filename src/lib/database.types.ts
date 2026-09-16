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
  public: {Tables: {
      access_roles: {
        Row: {
          role: string
          suspended: boolean
          userId: string}
        Insert: {role?: string
          suspended?: boolean
          userId: string}
        Update: {role?: string
          suspended?: boolean
          userId?: string}
        Relationships: [
          {foreignKeyName: "access_roles_user_id_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      achievements: {Row: {
          badgeColor: string
          category: string
          conditionType: string
          conditionValue: number
          createdAt: string
          description: string
          icon: string
          id: string
          isSecret: boolean
          orderIndex: number
          rarity: string
          rewardItemId: string | null
          title: string
          xpReward: number}
        Insert: {badgeColor?: string
          category: string
          conditionType: string
          conditionValue?: number
          createdAt?: string
          description: string
          icon?: string
          id: string
          isSecret?: boolean
          orderIndex?: number
          rarity?: string
          rewardItemId?: string | null
          title: string
          xpReward?: number}
        Update: {badgeColor?: string
          category?: string
          conditionType?: string
          conditionValue?: number
          createdAt?: string
          description?: string
          icon?: string
          id?: string
          isSecret?: boolean
          orderIndex?: number
          rarity?: string
          rewardItemId?: string | null
          title?: string
          xpReward?: number}
        Relationships: []
      }
      audit_log: {Row: {
          action: string
          actorId: string | null
          createdAt: string
          id: number
          metadata: Json
          targetId: string | null}
        Insert: {action: string
          actorId?: string | null
          createdAt?: string
          id?: never
          metadata?: Json
          targetId?: string | null}
        Update: {action?: string
          actorId?: string | null
          createdAt?: string
          id?: never
          metadata?: Json
          targetId?: string | null}
        Relationships: [
          {foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      chapter_reactions: {Row: {
          chapterId: string
          createdAt: string
          emoji: string
          id: string
          visitorId: string}
        Insert: {chapterId: string
          createdAt?: string
          emoji: string
          id?: string
          visitorId: string}
        Update: {chapterId?: string
          createdAt?: string
          emoji?: string
          id?: string
          visitorId?: string}
        Relationships: [
          {foreignKeyName: "chapter_reactions_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
        ]
      }
      chapter_scans: {Row: {
          chapterId: string
          createdAt: string
          scanId: string}
        Insert: {chapterId: string
          createdAt?: string
          scanId: string}
        Update: {chapterId?: string
          createdAt?: string
          scanId?: string}
        Relationships: [
          {foreignKeyName: "chapter_scans_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "chapter_scans_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
        ]
      }
      chapter_views: {Row: {
          anonymousHash: string | null
          chapterId: string
          id: string
          origin: string
          userId: string | null
          viewedAt: string
          workId: string}
        Insert: {anonymousHash?: string | null
          chapterId: string
          id?: string
          origin?: string
          userId?: string | null
          viewedAt?: string
          workId: string}
        Update: {anonymousHash?: string | null
          chapterId?: string
          id?: string
          origin?: string
          userId?: string | null
          viewedAt?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "chapter_views_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "chapter_views_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "chapter_views_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      chapters: {Row: {
          createdAt: string
          id: string
          number: number
          origin: string
          publishedAt: string | null
          sourceId: string | null
          title: string
          viewsTotal: number
          workId: string}
        Insert: {createdAt?: string
          id?: string
          number: number
          origin?: string
          publishedAt?: string | null
          sourceId?: string | null
          title?: string
          viewsTotal?: number
          workId: string}
        Update: {createdAt?: string
          id?: string
          number?: number
          origin?: string
          publishedAt?: string | null
          sourceId?: string | null
          title?: string
          viewsTotal?: number
          workId?: string}
        Relationships: [
          {foreignKeyName: "chapters_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      comment_likes: {Row: {
          commentId: string
          userId: string}
        Insert: {commentId: string
          userId: string}
        Update: {commentId?: string
          userId?: string}
        Relationships: [
          {foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["commentId"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]},
          {foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      comment_mentions: {Row: {
          commentId: string
          createdAt: string
          mentionedUserId: string}
        Insert: {commentId: string
          createdAt?: string
          mentionedUserId: string}
        Update: {commentId?: string
          createdAt?: string
          mentionedUserId?: string}
        Relationships: [
          {foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["commentId"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]},
          {foreignKeyName: "comment_mentions_mentioned_user_id_fkey"
            columns: ["mentionedUserId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      comments: {Row: {
          body: string
          chapterId: string | null
          createdAt: string
          id: string
          parentId: string | null
          removed: boolean
          updatedAt: string
          userId: string
          workId: string}
        Insert: {body: string
          chapterId?: string | null
          createdAt?: string
          id?: string
          parentId?: string | null
          removed?: boolean
          updatedAt?: string
          userId: string
          workId: string}
        Update: {body?: string
          chapterId?: string | null
          createdAt?: string
          id?: string
          parentId?: string | null
          removed?: boolean
          updatedAt?: string
          userId?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "comments_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "comments_parent_id_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]},
          {foreignKeyName: "comments_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "comments_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      control_plane_backups: {Row: {
          backupId: string
          checksum: string
          createdAt: string
          dataPayload: Json | null
          id: string
          recordCounts: Json
          schemaVersion: string}
        Insert: {backupId: string
          checksum: string
          createdAt?: string
          dataPayload?: Json | null
          id?: string
          recordCounts: Json
          schemaVersion: string}
        Update: {backupId?: string
          checksum?: string
          createdAt?: string
          dataPayload?: Json | null
          id?: string
          recordCounts?: Json
          schemaVersion?: string}
        Relationships: []
      }
      editor_invites: {Row: {
          createdAt: string
          createdBy: string
          email: string}
        Insert: {createdAt?: string
          createdBy: string
          email: string}
        Update: {createdAt?: string
          createdBy?: string
          email?: string}
        Relationships: [
          {foreignKeyName: "editor_invites_created_by_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      importer_chapter_manifest: {Row: {
          availableSources: Json
          chapterNumber: number
          chapterSortKey: number
          chapterTitle: string | null
          id: string
          lastCheckedAt: string
          pageCount: number | null
          selectedSource: string | null
          status: string
          workId: string}
        Insert: {availableSources?: Json
          chapterNumber: number
          chapterSortKey: number
          chapterTitle?: string | null
          id?: string
          lastCheckedAt?: string
          pageCount?: number | null
          selectedSource?: string | null
          status: string
          workId: string}
        Update: {availableSources?: Json
          chapterNumber?: number
          chapterSortKey?: number
          chapterTitle?: string | null
          id?: string
          lastCheckedAt?: string
          pageCount?: number | null
          selectedSource?: string | null
          status?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "importer_chapter_manifest_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      importer_chapter_mappings: {Row: {
          chapterId: string | null
          chapterNumber: number
          chapterSortKey: number | null
          createdAt: string
          id: string
          isGap: boolean
          isPageProvider: boolean
          lastError: string | null
          pageCount: number
          source: string
          sourceChapterId: string
          status: string
          updatedAt: string
          workId: string | null
          workMappingId: string}
        Insert: {chapterId?: string | null
          chapterNumber: number
          chapterSortKey?: number | null
          createdAt?: string
          id?: string
          isGap?: boolean
          isPageProvider?: boolean
          lastError?: string | null
          pageCount?: number
          source: string
          sourceChapterId: string
          status?: string
          updatedAt?: string
          workId?: string | null
          workMappingId: string}
        Update: {chapterId?: string | null
          chapterNumber?: number
          chapterSortKey?: number | null
          createdAt?: string
          id?: string
          isGap?: boolean
          isPageProvider?: boolean
          lastError?: string | null
          pageCount?: number
          source?: string
          sourceChapterId?: string
          status?: string
          updatedAt?: string
          workId?: string | null
          workMappingId?: string}
        Relationships: [
          {foreignKeyName: "importer_chapter_mappings_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {
            foreignKeyName: "importer_chapter_mappings_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "importer_sources"
            referencedColumns: ["id"]
          },
          {foreignKeyName: "importer_chapter_mappings_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
          {foreignKeyName: "importer_chapter_mappings_work_mapping_id_fkey"
            columns: ["workMappingId"]
            isOneToOne: false
            referencedRelation: "importer_work_mappings"
            referencedColumns: ["id"]},
        ]
      }
      importer_checkpoints: {Row: {
          createdAt: string
          cursorValue: string | null
          id: string
          lastCheckedAt: string
          metadata: Json
          source: string
          updatedAt: string}
        Insert: {createdAt?: string
          cursorValue?: string | null
          id?: string
          lastCheckedAt?: string
          metadata?: Json
          source: string
          updatedAt?: string}
        Update: {createdAt?: string
          cursorValue?: string | null
          id?: string
          lastCheckedAt?: string
          metadata?: Json
          source?: string
          updatedAt?: string}
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
      importer_job_metrics: {Row: {
          chapterId: string | null
          chapterNumber: number
          createdAt: string
          dbMs: number
          downloadMs: number
          durationMs: number
          errorMessage: string | null
          id: string
          pageCount: number
          source: string
          status: string
          totalBytes: number
          uploadMs: number
          workId: string | null
          workerId: string}
        Insert: {chapterId?: string | null
          chapterNumber: number
          createdAt?: string
          dbMs?: number
          downloadMs?: number
          durationMs: number
          errorMessage?: string | null
          id?: string
          pageCount: number
          source: string
          status: string
          totalBytes?: number
          uploadMs?: number
          workId?: string | null
          workerId: string}
        Update: {chapterId?: string | null
          chapterNumber?: number
          createdAt?: string
          dbMs?: number
          downloadMs?: number
          durationMs?: number
          errorMessage?: string | null
          id?: string
          pageCount?: number
          source?: string
          status?: string
          totalBytes?: number
          uploadMs?: number
          workId?: string | null
          workerId?: string}
        Relationships: [
          {foreignKeyName: "importer_job_metrics_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "importer_job_metrics_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      importer_queue: {Row: {
          attempts: number
          cancelReason: string | null
          cancelRequested: boolean
          cancelledAt: string | null
          cancelledBy: string | null
          chapterSortKey: number | null
          createdAt: string
          dedupeKey: string
          id: string
          lastError: string | null
          lastErrorAt: string | null
          lastRecoveredError: string | null
          leaseExpiresAt: string | null
          lockedAt: string | null
          lockedBy: string | null
          maxAttempts: number
          nextRunAt: string
          pauseReason: string | null
          pausedAt: string | null
          pausedBy: string | null
          payload: Json
          priority: number
          progressCurrent: number | null
          progressStage: string | null
          progressTotal: number | null
          recoveredAt: string | null
          retryReason: string | null
          source: string
          status: string
          taskType: string
          updatedAt: string}
        Insert: {attempts?: number
          cancelReason?: string | null
          cancelRequested?: boolean
          cancelledAt?: string | null
          cancelledBy?: string | null
          chapterSortKey?: number | null
          createdAt?: string
          dedupeKey: string
          id?: string
          lastError?: string | null
          lastErrorAt?: string | null
          lastRecoveredError?: string | null
          leaseExpiresAt?: string | null
          lockedAt?: string | null
          lockedBy?: string | null
          maxAttempts?: number
          nextRunAt?: string
          pauseReason?: string | null
          pausedAt?: string | null
          pausedBy?: string | null
          payload?: Json
          priority?: number
          progressCurrent?: number | null
          progressStage?: string | null
          progressTotal?: number | null
          recoveredAt?: string | null
          retryReason?: string | null
          source: string
          status?: string
          taskType: string
          updatedAt?: string}
        Update: {attempts?: number
          cancelReason?: string | null
          cancelRequested?: boolean
          cancelledAt?: string | null
          cancelledBy?: string | null
          chapterSortKey?: number | null
          createdAt?: string
          dedupeKey?: string
          id?: string
          lastError?: string | null
          lastErrorAt?: string | null
          lastRecoveredError?: string | null
          leaseExpiresAt?: string | null
          lockedAt?: string | null
          lockedBy?: string | null
          maxAttempts?: number
          nextRunAt?: string
          pauseReason?: string | null
          pausedAt?: string | null
          pausedBy?: string | null
          payload?: Json
          priority?: number
          progressCurrent?: number | null
          progressStage?: string | null
          progressTotal?: number | null
          recoveredAt?: string | null
          retryReason?: string | null
          source?: string
          status?: string
          taskType?: string
          updatedAt?: string}
        Relationships: [
          {foreignKeyName: "importer_queue_cancelled_by_fkey"
            columns: ["cancelledBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "importer_queue_paused_by_fkey"
            columns: ["pausedBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {
            foreignKeyName: "importer_queue_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "importer_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      importer_sources: {Row: {
          baseUrl: string
          blockedDetails: Json
          blockedReason: string | null
          config: Json
          cooldownUntil: string | null
          createdAt: string
          enabled: boolean
          id: string
          lastHealthCheckAt: string | null
          lastSyncAt: string | null
          name: string
          rateLimitPerSecond: number
          status: string
          syncIntervalMinutes: number
          updatedAt: string}
        Insert: {baseUrl: string
          blockedDetails?: Json
          blockedReason?: string | null
          config?: Json
          cooldownUntil?: string | null
          createdAt?: string
          enabled?: boolean
          id: string
          lastHealthCheckAt?: string | null
          lastSyncAt?: string | null
          name: string
          rateLimitPerSecond?: number
          status?: string
          syncIntervalMinutes?: number
          updatedAt?: string}
        Update: {baseUrl?: string
          blockedDetails?: Json
          blockedReason?: string | null
          config?: Json
          cooldownUntil?: string | null
          createdAt?: string
          enabled?: boolean
          id?: string
          lastHealthCheckAt?: string | null
          lastSyncAt?: string | null
          name?: string
          rateLimitPerSecond?: number
          status?: string
          syncIntervalMinutes?: number
          updatedAt?: string}
        Relationships: []
      }
      importer_staff_audit: {Row: {
          action: string
          actorId: string | null
          createdAt: string
          id: string
          metadata: Json
          newState: string | null
          oldState: string | null
          reason: string | null
          targetId: string
          targetType: string}
        Insert: {action: string
          actorId?: string | null
          createdAt?: string
          id?: string
          metadata?: Json
          newState?: string | null
          oldState?: string | null
          reason?: string | null
          targetId: string
          targetType: string}
        Update: {action?: string
          actorId?: string | null
          createdAt?: string
          id?: string
          metadata?: Json
          newState?: string | null
          oldState?: string | null
          reason?: string | null
          targetId?: string
          targetType?: string}
        Relationships: [
          {foreignKeyName: "importer_staff_audit_actor_id_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      importer_staff_requests: {Row: {
          attemptCount: number
          cancelReason: string | null
          cancelledAt: string | null
          cancelledBy: string | null
          createdAt: string
          id: string
          lastAttemptAt: string | null
          lastError: string | null
          nextAttemptAt: string | null
          priorityBoost: number
          reason: string | null
          requestedBy: string
          status: string
          updatedAt: string
          workId: string}
        Insert: {attemptCount?: number
          cancelReason?: string | null
          cancelledAt?: string | null
          cancelledBy?: string | null
          createdAt?: string
          id?: string
          lastAttemptAt?: string | null
          lastError?: string | null
          nextAttemptAt?: string | null
          priorityBoost?: number
          reason?: string | null
          requestedBy: string
          status?: string
          updatedAt?: string
          workId: string}
        Update: {attemptCount?: number
          cancelReason?: string | null
          cancelledAt?: string | null
          cancelledBy?: string | null
          createdAt?: string
          id?: string
          lastAttemptAt?: string | null
          lastError?: string | null
          nextAttemptAt?: string | null
          priorityBoost?: number
          reason?: string | null
          requestedBy?: string
          status?: string
          updatedAt?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "importer_staff_requests_cancelled_by_fkey"
            columns: ["cancelledBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "importer_staff_requests_requested_by_fkey"
            columns: ["requestedBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "importer_staff_requests_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      importer_telemetry: {Row: {
          activeJobs: number
          arrayBuffersMb: number
          concurrency: number
          createdAt: string
          cycleAction: string
          cycleReason: string | null
          eventLoopLagMs: number
          externalMb: number
          heapTotalMb: number
          heapUsedMb: number
          id: string
          rssMb: number
          workerId: string}
        Insert: {activeJobs: number
          arrayBuffersMb: number
          concurrency: number
          createdAt?: string
          cycleAction: string
          cycleReason?: string | null
          eventLoopLagMs: number
          externalMb: number
          heapTotalMb: number
          heapUsedMb: number
          id?: string
          rssMb: number
          workerId: string}
        Update: {activeJobs?: number
          arrayBuffersMb?: number
          concurrency?: number
          createdAt?: string
          cycleAction?: string
          cycleReason?: string | null
          eventLoopLagMs?: number
          externalMb?: number
          heapTotalMb?: number
          heapUsedMb?: number
          id?: string
          rssMb?: number
          workerId?: string}
        Relationships: []
      }
      importer_work_health: {Row: {
          createdAt: string
          firstChapterNumber: number | null
          gaps: Json
          healthStatus: string
          lastReconciledAt: string
          latestChapterNumber: number | null
          missingStart: boolean
          providersSummary: Json
          totalImportedChapters: number
          totalKnownChapters: number
          unresolvedGaps: Json
          updatedAt: string
          workId: string}
        Insert: {createdAt?: string
          firstChapterNumber?: number | null
          gaps?: Json
          healthStatus: string
          lastReconciledAt?: string
          latestChapterNumber?: number | null
          missingStart?: boolean
          providersSummary?: Json
          totalImportedChapters?: number
          totalKnownChapters?: number
          unresolvedGaps?: Json
          updatedAt?: string
          workId: string}
        Update: {createdAt?: string
          firstChapterNumber?: number | null
          gaps?: Json
          healthStatus?: string
          lastReconciledAt?: string
          latestChapterNumber?: number | null
          missingStart?: boolean
          providersSummary?: Json
          totalImportedChapters?: number
          totalKnownChapters?: number
          unresolvedGaps?: Json
          updatedAt?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "importer_work_health_work_id_fkey"
            columns: ["workId"]
            isOneToOne: true
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      importer_work_mappings: {Row: {
          confidenceScore: number | null
          createdAt: string
          freezeReason: string | null
          frozenAt: string | null
          frozenBy: string | null
          id: string
          isPrimary: boolean | null
          lastSyncedAt: string | null
          matchMethod: string | null
          metadata: Json
          source: string
          sourceSlug: string
          sourceTitle: string
          sourceWorkId: string
          syncStatus: string
          updatedAt: string
          workId: string | null}
        Insert: {confidenceScore?: number | null
          createdAt?: string
          freezeReason?: string | null
          frozenAt?: string | null
          frozenBy?: string | null
          id?: string
          isPrimary?: boolean | null
          lastSyncedAt?: string | null
          matchMethod?: string | null
          metadata?: Json
          source: string
          sourceSlug: string
          sourceTitle: string
          sourceWorkId: string
          syncStatus?: string
          updatedAt?: string
          workId?: string | null}
        Update: {confidenceScore?: number | null
          createdAt?: string
          freezeReason?: string | null
          frozenAt?: string | null
          frozenBy?: string | null
          id?: string
          isPrimary?: boolean | null
          lastSyncedAt?: string | null
          matchMethod?: string | null
          metadata?: Json
          source?: string
          sourceSlug?: string
          sourceTitle?: string
          sourceWorkId?: string
          syncStatus?: string
          updatedAt?: string
          workId?: string | null}
        Relationships: [
          {foreignKeyName: "importer_work_mappings_frozen_by_fkey"
            columns: ["frozenBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {
            foreignKeyName: "importer_work_mappings_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "importer_sources"
            referencedColumns: ["id"]
          },
          {foreignKeyName: "importer_work_mappings_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      library: {Row: {
          favorite: boolean
          following: boolean
          status: string
          updatedAt: string
          userId: string
          workId: string}
        Insert: {favorite?: boolean
          following?: boolean
          status?: string
          updatedAt?: string
          userId: string
          workId: string}
        Update: {favorite?: boolean
          following?: boolean
          status?: string
          updatedAt?: string
          userId?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "library_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "library_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      likes: {Row: {
          userId: string
          workId: string}
        Insert: {userId: string
          workId: string}
        Update: {userId?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "likes_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "likes_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      media: {Row: {
          accessClass: string | null
          botReference: string | null
          bytes: number
          chapterId: string | null
          createdAt: string
          createdBy: string
          height: number
          id: string
          mime: string
          pendingDeleteAt: string | null
          provider: string
          providerKey: string
          purpose: string
          scanId: string | null
          sha256: string
          status: string | null
          storagePoolId: string | null
          storageReady: boolean
          storageShardId: string | null
          width: number}
        Insert: {accessClass?: string | null
          botReference?: string | null
          bytes: number
          chapterId?: string | null
          createdAt?: string
          createdBy: string
          height: number
          id?: string
          mime: string
          pendingDeleteAt?: string | null
          provider: string
          providerKey: string
          purpose?: string
          scanId?: string | null
          sha256: string
          status?: string | null
          storagePoolId?: string | null
          storageReady?: boolean
          storageShardId?: string | null
          width: number}
        Update: {accessClass?: string | null
          botReference?: string | null
          bytes?: number
          chapterId?: string | null
          createdAt?: string
          createdBy?: string
          height?: number
          id?: string
          mime?: string
          pendingDeleteAt?: string | null
          provider?: string
          providerKey?: string
          purpose?: string
          scanId?: string | null
          sha256?: string
          status?: string | null
          storagePoolId?: string | null
          storageReady?: boolean
          storageShardId?: string | null
          width?: number}
        Relationships: [
          {foreignKeyName: "media_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_created_by_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_storage_pool_id_fkey"
            columns: ["storagePoolId"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_storage_shard_id_fkey"
            columns: ["storageShardId"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]},
        ]
      }
      media_locations: {Row: {
          botReference: string
          channelId: string | null
          createdAt: string
          fileId: string
          id: string
          mediaId: string
          messageId: string | null
          role: string
          status: string
          storageShardId: string}
        Insert: {botReference?: string
          channelId?: string | null
          createdAt?: string
          fileId: string
          id?: string
          mediaId: string
          messageId?: string | null
          role?: string
          status?: string
          storageShardId: string}
        Update: {botReference?: string
          channelId?: string | null
          createdAt?: string
          fileId?: string
          id?: string
          mediaId?: string
          messageId?: string | null
          role?: string
          status?: string
          storageShardId?: string}
        Relationships: [
          {foreignKeyName: "media_locations_storage_shard_id_fkey"
            columns: ["storageShardId"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]},
        ]
      }
      media_records: {Row: {
          accessClass: string
          backend: string
          botReference: string
          channelId: string | null
          chapterId: string | null
          checksum: string | null
          createdAt: string
          fileId: string | null
          id: string
          messageId: string | null
          mimeType: string
          pendingDeleteAt: string | null
          purpose: string
          scanId: string | null
          size: number
          status: string
          storagePoolId: string | null
          storageShardId: string | null
          uniqueFileId: string | null
          uploadedBy: string | null
          workId: string | null}
        Insert: {accessClass?: string
          backend?: string
          botReference?: string
          channelId?: string | null
          chapterId?: string | null
          checksum?: string | null
          createdAt?: string
          fileId?: string | null
          id: string
          messageId?: string | null
          mimeType: string
          pendingDeleteAt?: string | null
          purpose: string
          scanId?: string | null
          size?: number
          status?: string
          storagePoolId?: string | null
          storageShardId?: string | null
          uniqueFileId?: string | null
          uploadedBy?: string | null
          workId?: string | null}
        Update: {accessClass?: string
          backend?: string
          botReference?: string
          channelId?: string | null
          chapterId?: string | null
          checksum?: string | null
          createdAt?: string
          fileId?: string | null
          id?: string
          messageId?: string | null
          mimeType?: string
          pendingDeleteAt?: string | null
          purpose?: string
          scanId?: string | null
          size?: number
          status?: string
          storagePoolId?: string | null
          storageShardId?: string | null
          uniqueFileId?: string | null
          uploadedBy?: string | null
          workId?: string | null}
        Relationships: [
          {foreignKeyName: "media_records_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_records_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_records_storage_pool_id_fkey"
            columns: ["storagePoolId"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_records_storage_shard_id_fkey"
            columns: ["storageShardId"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]},
          {foreignKeyName: "media_records_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      member_achievements: {Row: {
          achievementId: string
          unlockedAt: string
          userId: string}
        Insert: {achievementId: string
          unlockedAt?: string
          userId: string}
        Update: {achievementId?: string
          unlockedAt?: string
          userId?: string}
        Relationships: [
          {foreignKeyName: "member_achievements_achievement_id_fkey"
            columns: ["achievementId"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]},
          {foreignKeyName: "member_achievements_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      member_inventory: {Row: {
          acquiredAt: string
          itemId: string
          origin: string
          userId: string}
        Insert: {acquiredAt?: string
          itemId: string
          origin?: string
          userId: string}
        Update: {acquiredAt?: string
          itemId?: string
          origin?: string
          userId?: string}
        Relationships: [
          {foreignKeyName: "member_inventory_item_id_fkey"
            columns: ["itemId"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]},
          {foreignKeyName: "member_inventory_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      members: {Row: {
          ageStatus: string
          avatarCrop: Json | null
          avatarFrameId: string | null
          avatarId: string | null
          bannerCrop: Json | null
          bannerId: string | null
          bannerPosition: string
          bio: string
          blurNsfw: boolean
          createdAt: string
          displayName: string
          equippedBadgeId: string | null
          equippedBannerId: string | null
          equippedCommentBannerId: string | null
          equippedMedalId: string | null
          equippedTitleId: string | null
          featuredAchievementId: string | null
          id: string
          isOnboarded: boolean
          isTest: boolean
          manualBadge: boolean
          manualTitle: boolean
          nameColor: string | null
          privacyShowAchievements: boolean
          privacyShowCosmetics: boolean
          privacyShowFavorites: boolean
          privacyShowReadingHistory: boolean
          username: string
          xp: number}
        Insert: {ageStatus?: string
          avatarCrop?: Json | null
          avatarFrameId?: string | null
          avatarId?: string | null
          bannerCrop?: Json | null
          bannerId?: string | null
          bannerPosition?: string
          bio?: string
          blurNsfw?: boolean
          createdAt?: string
          displayName: string
          equippedBadgeId?: string | null
          equippedBannerId?: string | null
          equippedCommentBannerId?: string | null
          equippedMedalId?: string | null
          equippedTitleId?: string | null
          featuredAchievementId?: string | null
          id: string
          isOnboarded?: boolean
          isTest?: boolean
          manualBadge?: boolean
          manualTitle?: boolean
          nameColor?: string | null
          privacyShowAchievements?: boolean
          privacyShowCosmetics?: boolean
          privacyShowFavorites?: boolean
          privacyShowReadingHistory?: boolean
          username: string
          xp?: number}
        Update: {ageStatus?: string
          avatarCrop?: Json | null
          avatarFrameId?: string | null
          avatarId?: string | null
          bannerCrop?: Json | null
          bannerId?: string | null
          bannerPosition?: string
          bio?: string
          blurNsfw?: boolean
          createdAt?: string
          displayName?: string
          equippedBadgeId?: string | null
          equippedBannerId?: string | null
          equippedCommentBannerId?: string | null
          equippedMedalId?: string | null
          equippedTitleId?: string | null
          featuredAchievementId?: string | null
          id?: string
          isOnboarded?: boolean
          isTest?: boolean
          manualBadge?: boolean
          manualTitle?: boolean
          nameColor?: string | null
          privacyShowAchievements?: boolean
          privacyShowCosmetics?: boolean
          privacyShowFavorites?: boolean
          privacyShowReadingHistory?: boolean
          username?: string
          xp?: number}
        Relationships: [
          {foreignKeyName: "members_avatar_id_fkey"
            columns: ["avatarId"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]},
          {foreignKeyName: "members_banner_id_fkey"
            columns: ["bannerId"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]},
          {foreignKeyName: "members_featured_achievement_id_fkey"
            columns: ["featuredAchievementId"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]},
        ]
      }
      mihon_tokens: {Row: {
          createdAt: string
          deviceName: string | null
          expiresAt: string
          id: string
          revoked: boolean
          scopes: string[]
          tokenHash: string
          tokenType: string
          userId: string}
        Insert: {createdAt?: string
          deviceName?: string | null
          expiresAt: string
          id?: string
          revoked?: boolean
          scopes?: string[]
          tokenHash: string
          tokenType?: string
          userId: string}
        Update: {createdAt?: string
          deviceName?: string | null
          expiresAt?: string
          id?: string
          revoked?: boolean
          scopes?: string[]
          tokenHash?: string
          tokenType?: string
          userId?: string}
        Relationships: [
          {foreignKeyName: "mihon_tokens_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      notifications: {Row: {
          body: string
          createdAt: string
          dedupeKey: string
          href: string
          id: string
          kind: string
          readAt: string | null
          userId: string}
        Insert: {body: string
          createdAt?: string
          dedupeKey: string
          href: string
          id?: string
          kind: string
          readAt?: string | null
          userId: string}
        Update: {body?: string
          createdAt?: string
          dedupeKey?: string
          href?: string
          id?: string
          kind?: string
          readAt?: string | null
          userId?: string}
        Relationships: [
          {foreignKeyName: "notifications_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      pages: {Row: {
          chapterId: string
          height: number
          mediaId: string
          position: number
          width: number}
        Insert: {chapterId: string
          height: number
          mediaId: string
          position: number
          width: number}
        Update: {chapterId?: string
          height?: number
          mediaId?: string
          position?: number
          width?: number}
        Relationships: [
          {foreignKeyName: "pages_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "pages_media_id_fkey"
            columns: ["mediaId"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]},
        ]
      }
      reading: {Row: {
          chapterId: string
          completedAt: string | null
          maxPage: number
          page: number
          startedAt: string
          updatedAt: string
          userId: string}
        Insert: {chapterId: string
          completedAt?: string | null
          maxPage?: number
          page?: number
          startedAt?: string
          updatedAt?: string
          userId: string}
        Update: {chapterId?: string
          completedAt?: string | null
          maxPage?: number
          page?: number
          startedAt?: string
          updatedAt?: string
          userId?: string}
        Relationships: [
          {foreignKeyName: "reading_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "reading_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      reading_sessions: {Row: {
          acceptedAt: string
          chapterId: string
          nextPage: number
          userId: string}
        Insert: {acceptedAt?: string
          chapterId: string
          nextPage?: number
          userId: string}
        Update: {acceptedAt?: string
          chapterId?: string
          nextPage?: number
          userId?: string}
        Relationships: [
          {foreignKeyName: "reading_sessions_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "reading_sessions_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      reports: {Row: {
          assignedTo: string | null
          chapterId: string | null
          commentId: string | null
          createdAt: string
          details: string | null
          id: string
          reason: string
          reporterId: string
          resolutionNotes: string | null
          status: string
          targetType: string
          targetUserId: string | null
          updatedAt: string
          workId: string | null}
        Insert: {assignedTo?: string | null
          chapterId?: string | null
          commentId?: string | null
          createdAt?: string
          details?: string | null
          id?: string
          reason: string
          reporterId: string
          resolutionNotes?: string | null
          status?: string
          targetType: string
          targetUserId?: string | null
          updatedAt?: string
          workId?: string | null}
        Update: {assignedTo?: string | null
          chapterId?: string | null
          commentId?: string | null
          createdAt?: string
          details?: string | null
          id?: string
          reason?: string
          reporterId?: string
          resolutionNotes?: string | null
          status?: string
          targetType?: string
          targetUserId?: string | null
          updatedAt?: string
          workId?: string | null}
        Relationships: [
          {foreignKeyName: "reports_assigned_to_fkey"
            columns: ["assignedTo"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "reports_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "reports_comment_id_fkey"
            columns: ["commentId"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]},
          {foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporterId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "reports_target_user_id_fkey"
            columns: ["targetUserId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "reports_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      scan_invites: {Row: {
          code: string
          createdAt: string
          createdBy: string
          expiresAt: string
          id: string
          revoked: boolean
          role: string
          scanId: string
          usedAt: string | null
          usedBy: string | null}
        Insert: {code: string
          createdAt?: string
          createdBy: string
          expiresAt: string
          id?: string
          revoked?: boolean
          role: string
          scanId: string
          usedAt?: string | null
          usedBy?: string | null}
        Update: {code?: string
          createdAt?: string
          createdBy?: string
          expiresAt?: string
          id?: string
          revoked?: boolean
          role?: string
          scanId?: string
          usedAt?: string | null
          usedBy?: string | null}
        Relationships: [
          {foreignKeyName: "scan_invites_created_by_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_invites_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_invites_used_by_fkey"
            columns: ["usedBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      scan_members: {Row: {
          createdAt: string
          role: string
          scanId: string
          userId: string}
        Insert: {createdAt?: string
          role?: string
          scanId: string
          userId: string}
        Update: {createdAt?: string
          role?: string
          scanId?: string
          userId?: string}
        Relationships: [
          {foreignKeyName: "scan_members_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_members_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      scan_partner_requests: {Row: {
          createdAt: string
          description: string | null
          discord: string | null
          fluxer: string | null
          id: string
          rejectionReason: string | null
          reviewedAt: string | null
          reviewedBy: string | null
          sampleLinks: string | null
          scanName: string
          scanSlug: string
          status: string
          userId: string
          website: string | null}
        Insert: {createdAt?: string
          description?: string | null
          discord?: string | null
          fluxer?: string | null
          id?: string
          rejectionReason?: string | null
          reviewedAt?: string | null
          reviewedBy?: string | null
          sampleLinks?: string | null
          scanName: string
          scanSlug: string
          status?: string
          userId: string
          website?: string | null}
        Update: {createdAt?: string
          description?: string | null
          discord?: string | null
          fluxer?: string | null
          id?: string
          rejectionReason?: string | null
          reviewedAt?: string | null
          reviewedBy?: string | null
          sampleLinks?: string | null
          scanName?: string
          scanSlug?: string
          status?: string
          userId?: string
          website?: string | null}
        Relationships: [
          {foreignKeyName: "scan_partner_requests_reviewed_by_fkey"
            columns: ["reviewedBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_partner_requests_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      scan_project_requests: {Row: {
          createdAt: string
          id: string
          message: string | null
          rejectionReason: string | null
          reviewedAt: string | null
          reviewedBy: string | null
          scanId: string
          status: string
          userId: string
          workId: string}
        Insert: {createdAt?: string
          id?: string
          message?: string | null
          rejectionReason?: string | null
          reviewedAt?: string | null
          reviewedBy?: string | null
          scanId: string
          status?: string
          userId: string
          workId: string}
        Update: {createdAt?: string
          id?: string
          message?: string | null
          rejectionReason?: string | null
          reviewedAt?: string | null
          reviewedBy?: string | null
          scanId?: string
          status?: string
          userId?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "scan_project_requests_reviewed_by_fkey"
            columns: ["reviewedBy"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_project_requests_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_project_requests_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_project_requests_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      scan_storage_usage: {Row: {
          activeUploads: number
          bytes: number
          failures: number
          pages: number
          scanId: string
          throughput: number
          updatedAt: string
          uploads: number}
        Insert: {activeUploads?: number
          bytes?: number
          failures?: number
          pages?: number
          scanId: string
          throughput?: number
          updatedAt?: string
          uploads?: number}
        Update: {activeUploads?: number
          bytes?: number
          failures?: number
          pages?: number
          scanId?: string
          throughput?: number
          updatedAt?: string
          uploads?: number}
        Relationships: [
          {foreignKeyName: "scan_storage_usage_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: true
            referencedRelation: "scans"
            referencedColumns: ["id"]},
        ]
      }
      scan_transfer_requests: {Row: {
          createdAt: string
          fromUserId: string
          id: string
          respondedAt: string | null
          scanId: string
          status: string
          toUserId: string}
        Insert: {createdAt?: string
          fromUserId: string
          id?: string
          respondedAt?: string | null
          scanId: string
          status?: string
          toUserId: string}
        Update: {createdAt?: string
          fromUserId?: string
          id?: string
          respondedAt?: string | null
          scanId?: string
          status?: string
          toUserId?: string}
        Relationships: [
          {foreignKeyName: "scan_transfer_requests_from_user_id_fkey"
            columns: ["fromUserId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_transfer_requests_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "scan_transfer_requests_to_user_id_fkey"
            columns: ["toUserId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      scans: {Row: {
          bannerId: string | null
          createdAt: string
          description: string
          discord: string
          fluxer: string
          id: string
          isOfficial: boolean
          logoId: string | null
          name: string
          slug: string
          status: string
          updatedAt: string
          website: string}
        Insert: {bannerId?: string | null
          createdAt?: string
          description?: string
          discord?: string
          fluxer?: string
          id?: string
          isOfficial?: boolean
          logoId?: string | null
          name: string
          slug: string
          status?: string
          updatedAt?: string
          website?: string}
        Update: {bannerId?: string | null
          createdAt?: string
          description?: string
          discord?: string
          fluxer?: string
          id?: string
          isOfficial?: boolean
          logoId?: string | null
          name?: string
          slug?: string
          status?: string
          updatedAt?: string
          website?: string}
        Relationships: [
          {foreignKeyName: "scans_banner_id_fkey"
            columns: ["bannerId"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]},
          {foreignKeyName: "scans_logo_id_fkey"
            columns: ["logoId"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]},
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
      shop_items: {Row: {
          assetUrl: string
          createdAt: string
          description: string
          id: string
          isActive: boolean
          isAnimated: boolean
          kind: string
          minLevel: number
          name: string
          orderIndex: number
          priceXp: number
          rarity: string
          status: string
          styleData: Json
          thumbnailUrl: string | null}
        Insert: {assetUrl?: string
          createdAt?: string
          description?: string
          id: string
          isActive?: boolean
          isAnimated?: boolean
          kind: string
          minLevel?: number
          name: string
          orderIndex?: number
          priceXp: number
          rarity?: string
          status?: string
          styleData?: Json
          thumbnailUrl?: string | null}
        Update: {assetUrl?: string
          createdAt?: string
          description?: string
          id?: string
          isActive?: boolean
          isAnimated?: boolean
          kind?: string
          minLevel?: number
          name?: string
          orderIndex?: number
          priceXp?: number
          rarity?: string
          status?: string
          styleData?: Json
          thumbnailUrl?: string | null}
        Relationships: []
      }
      storage_pools: {Row: {
          createdAt: string
          displayName: string
          enabled: boolean
          id: string
          key: string
          overflowAllowed: boolean
          purpose: string
          reserved: boolean
          updatedAt: string}
        Insert: {createdAt?: string
          displayName: string
          enabled?: boolean
          id?: string
          key: string
          overflowAllowed?: boolean
          purpose: string
          reserved?: boolean
          updatedAt?: string}
        Update: {createdAt?: string
          displayName?: string
          enabled?: boolean
          id?: string
          key?: string
          overflowAllowed?: boolean
          purpose?: string
          reserved?: boolean
          updatedAt?: string}
        Relationships: []
      }
      storage_shard_group_members: {Row: {
          groupId: string
          priority: number
          shardId: string
          weight: number}
        Insert: {groupId: string
          priority?: number
          shardId: string
          weight?: number}
        Update: {groupId?: string
          priority?: number
          shardId?: string
          weight?: number}
        Relationships: [
          {foreignKeyName: "storage_shard_group_members_group_id_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "storage_shard_groups"
            referencedColumns: ["id"]},
          {foreignKeyName: "storage_shard_group_members_shard_id_fkey"
            columns: ["shardId"]
            isOneToOne: false
            referencedRelation: "storage_shards"
            referencedColumns: ["id"]},
        ]
      }
      storage_shard_groups: {Row: {
          createdAt: string
          id: string
          poolId: string
          scopeId: string
          scopeType: string
          strategy: string
          updatedAt: string}
        Insert: {createdAt?: string
          id?: string
          poolId: string
          scopeId: string
          scopeType?: string
          strategy?: string
          updatedAt?: string}
        Update: {createdAt?: string
          id?: string
          poolId?: string
          scopeId?: string
          scopeType?: string
          strategy?: string
          updatedAt?: string}
        Relationships: [
          {foreignKeyName: "storage_shard_groups_pool_id_fkey"
            columns: ["poolId"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]},
        ]
      }
      storage_shards: {Row: {
          activeUploads: number
          backend: string
          botReference: string
          channelId: string
          cooldownUntil: string | null
          createdAt: string
          displayName: string
          enabled: boolean
          errorRate: number
          id: string
          latencyMs: number
          ownerScanId: string | null
          poolId: string
          queueDepth: number
          readStatus: string
          recentFailures: number
          recentSuccesses: number
          reserved: boolean
          throughput: number
          updatedAt: string
          weight: number
          writeStatus: string}
        Insert: {activeUploads?: number
          backend?: string
          botReference: string
          channelId: string
          cooldownUntil?: string | null
          createdAt?: string
          displayName: string
          enabled?: boolean
          errorRate?: number
          id?: string
          latencyMs?: number
          ownerScanId?: string | null
          poolId: string
          queueDepth?: number
          readStatus?: string
          recentFailures?: number
          recentSuccesses?: number
          reserved?: boolean
          throughput?: number
          updatedAt?: string
          weight?: number
          writeStatus?: string}
        Update: {activeUploads?: number
          backend?: string
          botReference?: string
          channelId?: string
          cooldownUntil?: string | null
          createdAt?: string
          displayName?: string
          enabled?: boolean
          errorRate?: number
          id?: string
          latencyMs?: number
          ownerScanId?: string | null
          poolId?: string
          queueDepth?: number
          readStatus?: string
          recentFailures?: number
          recentSuccesses?: number
          reserved?: boolean
          throughput?: number
          updatedAt?: string
          weight?: number
          writeStatus?: string}
        Relationships: [
          {foreignKeyName: "storage_shards_owner_scan_id_fkey"
            columns: ["ownerScanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "storage_shards_pool_id_fkey"
            columns: ["poolId"]
            isOneToOne: false
            referencedRelation: "storage_pools"
            referencedColumns: ["id"]},
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
      user_blocks: {Row: {
          blockedId: string
          createdAt: string
          userId: string}
        Insert: {blockedId: string
          createdAt?: string
          userId: string}
        Update: {blockedId?: string
          createdAt?: string
          userId?: string}
        Relationships: [
          {foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blockedId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "user_blocks_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      user_follows: {Row: {
          createdAt: string
          followerId: string
          followingId: string}
        Insert: {createdAt?: string
          followerId: string
          followingId: string}
        Update: {createdAt?: string
          followerId?: string
          followingId?: string}
        Relationships: [
          {foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["followerId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "user_follows_following_id_fkey"
            columns: ["followingId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
        ]
      }
      work_scans: {Row: {
          createdAt: string
          isPrimary: boolean
          scanId: string
          status: string
          workId: string}
        Insert: {createdAt?: string
          isPrimary?: boolean
          scanId: string
          status?: string
          workId: string}
        Update: {createdAt?: string
          isPrimary?: boolean
          scanId?: string
          status?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "work_scans_scan_id_fkey"
            columns: ["scanId"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]},
          {foreignKeyName: "work_scans_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      work_tags: {Row: {
          systemGenerated: boolean
          tagId: string
          workId: string}
        Insert: {systemGenerated?: boolean
          tagId: string
          workId: string}
        Update: {systemGenerated?: boolean
          tagId?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "work_tags_tag_id_fkey"
            columns: ["tagId"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]},
          {foreignKeyName: "work_tags_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
        ]
      }
      works: {Row: {
          ageRating: number
          aliases: string[]
          artist: string
          author: string
          contentRating: string
          coverId: string | null
          createdAt: string
          description: string
          featured: boolean
          id: string
          kind: string
          metadataProvenance: Json
          published: boolean
          searchText: string
          slug: string
          sourceId: string | null
          status: string
          synopsis: string
          title: string
          updatedAt: string
          viewsTotal: number
          year: number | null}
        Insert: {ageRating?: number
          aliases?: string[]
          artist?: string
          author?: string
          contentRating?: string
          coverId?: string | null
          createdAt?: string
          description?: string
          featured?: boolean
          id?: string
          kind?: string
          metadataProvenance?: Json
          published?: boolean
          searchText?: string
          slug: string
          sourceId?: string | null
          status?: string
          synopsis?: string
          title: string
          updatedAt?: string
          viewsTotal?: number
          year?: number | null}
        Update: {ageRating?: number
          aliases?: string[]
          artist?: string
          author?: string
          contentRating?: string
          coverId?: string | null
          createdAt?: string
          description?: string
          featured?: boolean
          id?: string
          kind?: string
          metadataProvenance?: Json
          published?: boolean
          searchText?: string
          slug?: string
          sourceId?: string | null
          status?: string
          synopsis?: string
          title?: string
          updatedAt?: string
          viewsTotal?: number
          year?: number | null}
        Relationships: [
          {foreignKeyName: "works_cover_id_fkey"
            columns: ["coverId"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]},
        ]
      }
      xp_awards: {Row: {
          amount: number
          chapterId: string
          createdAt: string
          id: string
          source: string
          userId: string
          workId: string}
        Insert: {amount?: number
          chapterId: string
          createdAt?: string
          id?: string
          source?: string
          userId: string
          workId: string}
        Update: {amount?: number
          chapterId?: string
          createdAt?: string
          id?: string
          source?: string
          userId?: string
          workId?: string}
        Relationships: [
          {foreignKeyName: "xp_awards_chapter_id_fkey"
            columns: ["chapterId"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]},
          {foreignKeyName: "xp_awards_user_id_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]},
          {foreignKeyName: "xp_awards_work_id_fkey"
            columns: ["workId"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]},
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
        Returns: {attempts: number
          chapterSortKey: number
          dedupeKey: string
          id: string
          lastError: string
          leaseExpiresAt: string
          lockedAt: string
          lockedBy: string
          maxAttempts: number
          nextRunAt: string
          payload: Json
          priority: number
          source: string
          status: string
          taskType: string}[]
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
        Returns: {backend: string
          botReference: string
          channelId: string
          displayName: string
          is_overflow: boolean
          poolId: string
          shardId: string
          writeStatus: string}[]
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

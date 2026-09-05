export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      access_roles: {
        Row: {
          role: string;
          suspended: boolean;
          user_id: string;
        };
        Insert: {
          role?: string;
          suspended?: boolean;
          user_id: string;
        };
        Update: {
          role?: string;
          suspended?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'access_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: number;
          target_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          target_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          target_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      chapters: {
        Row: {
          created_at: string;
          id: string;
          number: number;
          published_at: string | null;
          source_id: string | null;
          title: string;
          work_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          number: number;
          published_at?: string | null;
          source_id?: string | null;
          title?: string;
          work_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          number?: number;
          published_at?: string | null;
          source_id?: string | null;
          title?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chapters_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          }
        ];
      };
      comment_likes: {
        Row: {
          comment_id: string;
          user_id: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comment_likes_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comment_likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      comments: {
        Row: {
          body: string;
          chapter_id: string | null;
          created_at: string;
          id: string;
          parent_id: string | null;
          removed: boolean;
          updated_at: string;
          user_id: string;
          work_id: string;
        };
        Insert: {
          body: string;
          chapter_id?: string | null;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          removed?: boolean;
          updated_at?: string;
          user_id: string;
          work_id: string;
        };
        Update: {
          body?: string;
          chapter_id?: string | null;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          removed?: boolean;
          updated_at?: string;
          user_id?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_chapter_id_fkey';
            columns: ['chapter_id'];
            isOneToOne: false;
            referencedRelation: 'chapters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          }
        ];
      };
      library: {
        Row: {
          favorite: boolean;
          following: boolean;
          status: string;
          updated_at: string;
          user_id: string;
          work_id: string;
        };
        Insert: {
          favorite?: boolean;
          following?: boolean;
          status?: string;
          updated_at?: string;
          user_id: string;
          work_id: string;
        };
        Update: {
          favorite?: boolean;
          following?: boolean;
          status?: string;
          updated_at?: string;
          user_id?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'library_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'library_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          }
        ];
      };
      likes: {
        Row: {
          user_id: string;
          work_id: string;
        };
        Insert: {
          user_id: string;
          work_id: string;
        };
        Update: {
          user_id?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          }
        ];
      };
      media: {
        Row: {
          bytes: number;
          created_at: string;
          created_by: string;
          height: number;
          id: string;
          mime: string;
          provider: string;
          provider_key: string;
          sha256: string;
          width: number;
        };
        Insert: {
          bytes: number;
          created_at?: string;
          created_by: string;
          height: number;
          id?: string;
          mime: string;
          provider: string;
          provider_key: string;
          sha256: string;
          width: number;
        };
        Update: {
          bytes?: number;
          created_at?: string;
          created_by?: string;
          height?: number;
          id?: string;
          mime?: string;
          provider?: string;
          provider_key?: string;
          sha256?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'media_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      members: {
        Row: {
          avatar_id: string | null;
          bio: string;
          created_at: string;
          display_name: string;
          id: string;
          username: string;
          xp: number;
        };
        Insert: {
          avatar_id?: string | null;
          bio?: string;
          created_at?: string;
          display_name: string;
          id: string;
          username: string;
          xp?: number;
        };
        Update: {
          avatar_id?: string | null;
          bio?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          username?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'members_avatar_id_fkey';
            columns: ['avatar_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          }
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          dedupe_key: string;
          href: string;
          id: string;
          kind: string;
          read_at: string | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          dedupe_key: string;
          href: string;
          id?: string;
          kind: string;
          read_at?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          dedupe_key?: string;
          href?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      pages: {
        Row: {
          chapter_id: string;
          height: number;
          media_id: string;
          position: number;
          width: number;
        };
        Insert: {
          chapter_id: string;
          height: number;
          media_id: string;
          position: number;
          width: number;
        };
        Update: {
          chapter_id?: string;
          height?: number;
          media_id?: string;
          position?: number;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pages_chapter_id_fkey';
            columns: ['chapter_id'];
            isOneToOne: false;
            referencedRelation: 'chapters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pages_media_id_fkey';
            columns: ['media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          }
        ];
      };
      reading: {
        Row: {
          chapter_id: string;
          completed_at: string | null;
          max_page: number;
          page: number;
          started_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chapter_id: string;
          completed_at?: string | null;
          max_page?: number;
          page?: number;
          started_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chapter_id?: string;
          completed_at?: string | null;
          max_page?: number;
          page?: number;
          started_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reading_chapter_id_fkey';
            columns: ['chapter_id'];
            isOneToOne: false;
            referencedRelation: 'chapters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reading_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      reading_sessions: {
        Row: {
          accepted_at: string;
          chapter_id: string;
          next_page: number;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          chapter_id: string;
          next_page?: number;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          chapter_id?: string;
          next_page?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reading_sessions_chapter_id_fkey';
            columns: ['chapter_id'];
            isOneToOne: false;
            referencedRelation: 'chapters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reading_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      settings: {
        Row: {
          key: string;
          value: string;
        };
        Insert: {
          key: string;
          value: string;
        };
        Update: {
          key?: string;
          value?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          kind: string;
          name: string;
          slug: string;
        };
        Insert: {
          id?: string;
          kind?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          kind?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      work_tags: {
        Row: {
          tag_id: string;
          work_id: string;
        };
        Insert: {
          tag_id: string;
          work_id: string;
        };
        Update: {
          tag_id?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_tags_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          }
        ];
      };
      works: {
        Row: {
          age_rating: number;
          aliases: string[];
          artist: string;
          author: string;
          cover_id: string | null;
          created_at: string;
          description: string;
          featured: boolean;
          id: string;
          kind: string;
          published: boolean;
          slug: string;
          source_id: string | null;
          status: string;
          synopsis: string;
          title: string;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          age_rating?: number;
          aliases?: string[];
          artist?: string;
          author?: string;
          cover_id?: string | null;
          created_at?: string;
          description?: string;
          featured?: boolean;
          id?: string;
          kind?: string;
          published?: boolean;
          slug: string;
          source_id?: string | null;
          status?: string;
          synopsis?: string;
          title: string;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          age_rating?: number;
          aliases?: string[];
          artist?: string;
          author?: string;
          cover_id?: string | null;
          created_at?: string;
          description?: string;
          featured?: boolean;
          id?: string;
          kind?: string;
          published?: boolean;
          slug?: string;
          source_id?: string | null;
          status?: string;
          synopsis?: string;
          title?: string;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'works_cover_id_fkey';
            columns: ['cover_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_role: { Args: never; Returns: string };
      editor_action: { Args: { p_action: string; p_data: Json }; Returns: Json };
      is_editor: { Args: never; Returns: boolean };
      is_member: { Args: never; Returns: boolean };
      is_owner: { Args: never; Returns: boolean };
      member_action: { Args: { p_action: string; p_data: Json }; Returns: Json };
      owner_action: { Args: { p_action: string; p_data: Json }; Returns: Json };
      public_chapter: { Args: { p_id: string }; Returns: boolean };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {}
  }
} as const;

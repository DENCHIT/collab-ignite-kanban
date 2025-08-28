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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      board_members: {
        Row: {
          board_id: string
          created_at: string
          display_name: string
          email: string
          id: string
          joined_at: string
          role: string
          updated_at: string
        }
        Insert: {
          board_id: string
          created_at?: string
          display_name: string
          email: string
          id?: string
          joined_at?: string
          role?: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          joined_at?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_board_member_board"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          item_type: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          item_type?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          item_type?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      boards_secrets: {
        Row: {
          board_id: string
          created_at: string
          id: string
          passcode_hash: string
          passcode_plain: string | null
          salt: string
          updated_at: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          passcode_hash: string
          passcode_plain?: string | null
          salt?: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          passcode_hash?: string
          passcode_plain?: string | null
          salt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_secrets_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: true
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          admin_digest: Database["public"]["Enums"]["digest_frequency"]
          assigned: boolean
          created_at: string
          email: string
          id: string
          items_moved: boolean
          mentions: boolean
          new_board_members: boolean
          new_items: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_digest?: Database["public"]["Enums"]["digest_frequency"]
          assigned?: boolean
          created_at?: string
          email: string
          id?: string
          items_moved?: boolean
          mentions?: boolean
          new_board_members?: boolean
          new_items?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_digest?: Database["public"]["Enums"]["digest_frequency"]
          assigned?: boolean
          created_at?: string
          email?: string
          id?: string
          items_moved?: boolean
          mentions?: boolean
          new_board_members?: boolean
          new_items?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          assignees: Json
          blocked_reason: string | null
          board_id: string
          checklist: Json
          comments: Json
          created_at: string
          creator_name: string
          description: string | null
          history: Json
          id: string
          last_activity_at: string
          score: number
          status: string
          title: string
          updated_at: string
          voters: Json
          watchers: Json
        }
        Insert: {
          assignees?: Json
          blocked_reason?: string | null
          board_id: string
          checklist?: Json
          comments?: Json
          created_at?: string
          creator_name: string
          description?: string | null
          history?: Json
          id?: string
          last_activity_at?: string
          score?: number
          status?: string
          title: string
          updated_at?: string
          voters?: Json
          watchers?: Json
        }
        Update: {
          assignees?: Json
          blocked_reason?: string | null
          board_id?: string
          checklist?: Json
          comments?: Json
          created_at?: string
          creator_name?: string
          description?: string | null
          history?: Json
          id?: string
          last_activity_at?: string
          score?: number
          status?: string
          title?: string
          updated_at?: string
          voters?: Json
          watchers?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ideas_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          message: string
          read: boolean
          type: string
          updated_at: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          message: string
          read?: boolean
          type: string
          updated_at?: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          message?: string
          read?: boolean
          type?: string
          updated_at?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          created_at?: string
          email: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_board_member: {
        Args: { _display_name: string; _email: string; _slug: string }
        Returns: boolean
      }
      get_accessible_boards: {
        Args: Record<PropertyKey, never>
        Returns: {
          board_id: string
          created_at: string
          created_by_email: string
          idea_count: number
          item_type: string
          member_count: number
          name: string
          passcode: string
          slug: string
          vote_count: number
        }[]
      }
      get_boards_admin_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          board_id: string
          created_at: string
          idea_count: number
          item_type: string
          member_count: number
          name: string
          passcode: string
          slug: string
          vote_count: number
        }[]
      }
      get_manager_activity: {
        Args: Record<PropertyKey, never>
        Returns: {
          assigned_at: string
          assistant_count: number
          boards_created: number
          display_name: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          total_ideas: number
          total_members: number
          total_votes: number
        }[]
      }
      get_my_boards: {
        Args: Record<PropertyKey, never>
        Returns: {
          board_id: string
          board_name: string
          board_slug: string
          item_type: string
          joined_at: string
          role: string
        }[]
      }
      get_user_role: {
        Args: { _user_email: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_email: string
        }
        Returns: boolean
      }
      init_profile_for_current_user: {
        Args: Record<PropertyKey, never> | { _display_name?: string }
        Returns: string
      }
      is_board_manager: {
        Args: { _board_slug: string; _user_email: string }
        Returns: boolean
      }
      is_board_member: {
        Args: { _board_slug: string; _user_email: string }
        Returns: boolean
      }
      set_board_passcode: {
        Args: { _board_id: string; _passcode: string }
        Returns: boolean
      }
      user_is_board_member: {
        Args: { _board_id: string; _user_email: string }
        Returns: boolean
      }
      verify_board_passcode: {
        Args: { _passcode: string; _slug: string }
        Returns: boolean
      }
      verify_board_passcode_secure: {
        Args: { _passcode: string; _slug: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager"
      digest_frequency: "off" | "daily" | "weekly"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager"],
      digest_frequency: ["off", "daily", "weekly"],
    },
  },
} as const

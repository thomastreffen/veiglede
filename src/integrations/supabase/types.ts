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
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          id: string
          requested_at: string
          restore_before: string
          restore_token: string
          restored_at: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          restore_before?: string
          restore_token?: string
          restored_at?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          restore_before?: string
          restore_token?: string
          restored_at?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_prefs: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          trip_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          trip_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          trip_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_accounts: {
        Row: {
          business_name: string
          category: string
          contact_name: string
          created_at: string
          id: string
          logo_url: string | null
          org_number: string | null
          partner_id: string | null
          status: string
          user_id: string
          website: string | null
        }
        Insert: {
          business_name: string
          category: string
          contact_name: string
          created_at?: string
          id?: string
          logo_url?: string | null
          org_number?: string | null
          partner_id?: string | null
          status?: string
          user_id: string
          website?: string | null
        }
        Update: {
          business_name?: string
          category?: string
          contact_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          org_number?: string | null
          partner_id?: string | null
          status?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_accounts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_campaigns: {
        Row: {
          budget_nok: number
          cpm_rate: number
          created_at: string
          ends_at: string
          id: string
          name: string
          partner_account_id: string
          partner_id: string | null
          pricing_model: string
          starts_at: string
          status: string
        }
        Insert: {
          budget_nok: number
          cpm_rate?: number
          created_at?: string
          ends_at: string
          id?: string
          name: string
          partner_account_id: string
          partner_id?: string | null
          pricing_model?: string
          starts_at: string
          status?: string
        }
        Update: {
          budget_nok?: number
          cpm_rate?: number
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          partner_account_id?: string
          partner_id?: string | null
          pricing_model?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_campaigns_partner_account_id_fkey"
            columns: ["partner_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_campaigns_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invoices: {
        Row: {
          amount_nok: number
          campaign_id: string | null
          clicks: number
          created_at: string
          email_sent_at: string | null
          id: string
          impressions: number
          paid_at: string | null
          paid_method: string | null
          partner_account_id: string
          period_end: string
          period_start: string
          status: string
          stripe_receipt_url: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_nok?: number
          campaign_id?: string | null
          clicks?: number
          created_at?: string
          email_sent_at?: string | null
          id?: string
          impressions?: number
          paid_at?: string | null
          paid_method?: string | null
          partner_account_id: string
          period_end: string
          period_start: string
          status?: string
          stripe_receipt_url?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_nok?: number
          campaign_id?: string | null
          clicks?: number
          created_at?: string
          email_sent_at?: string | null
          id?: string
          impressions?: number
          paid_at?: string | null
          paid_method?: string | null
          partner_account_id?: string
          period_end?: string
          period_start?: string
          status?: string
          stripe_receipt_url?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_invoices_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "partner_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invoices_partner_account_id_fkey"
            columns: ["partner_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          category: string
          clicks: number
          clicks_this_month: number
          created_at: string
          description: string | null
          id: string
          impressions: number
          impressions_this_month: number
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          region: string | null
          website: string | null
        }
        Insert: {
          category: string
          clicks?: number
          clicks_this_month?: number
          created_at?: string
          description?: string | null
          id?: string
          impressions?: number
          impressions_this_month?: number
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          region?: string | null
          website?: string | null
        }
        Update: {
          category?: string
          clicks?: number
          clicks_this_month?: number
          created_at?: string
          description?: string | null
          id?: string
          impressions?: number
          impressions_this_month?: number
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          region?: string | null
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          is_public: boolean
          onboarded_at: string | null
          role: string
          show_garage: boolean
          show_stats: boolean
          show_trips: boolean
          theme: string
          updated_at: string
          username: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_active?: boolean
          is_public?: boolean
          onboarded_at?: string | null
          role?: string
          show_garage?: boolean
          show_stats?: boolean
          show_trips?: boolean
          theme?: string
          updated_at?: string
          username?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          onboarded_at?: string | null
          role?: string
          show_garage?: boolean
          show_stats?: boolean
          show_trips?: boolean
          theme?: string
          updated_at?: string
          username?: string | null
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      saved_trips: {
        Row: {
          created_at: string
          id: string
          source_trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_trip_id?: string
          user_id?: string
        }
        Relationships: []
      }
      sent_trip_reminders: {
        Row: {
          owner_user_id: string
          recipient_email: string
          sent_at: string
          start_date: string
          trip_id: string
        }
        Insert: {
          owner_user_id: string
          recipient_email: string
          sent_at?: string
          start_date: string
          trip_id: string
        }
        Update: {
          owner_user_id?: string
          recipient_email?: string
          sent_at?: string
          start_date?: string
          trip_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trip_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          trip_id: string
          user_avatar_url: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          trip_id: string
          user_avatar_url?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          trip_id?: string
          user_avatar_url?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      trip_invites: {
        Row: {
          created_at: string
          id: string
          invite_token: string
          invited_email: string | null
          joined_at: string | null
          joined_user_id: string | null
          opened_at: string | null
          owner_user_id: string
          role: string
          status: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_token: string
          invited_email?: string | null
          joined_at?: string | null
          joined_user_id?: string | null
          opened_at?: string | null
          owner_user_id: string
          role?: string
          status?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_token?: string
          invited_email?: string | null
          joined_at?: string | null
          joined_user_id?: string | null
          opened_at?: string | null
          owner_user_id?: string
          role?: string
          status?: string
          trip_id?: string
        }
        Relationships: []
      }
      trip_live_sessions: {
        Row: {
          heading: number | null
          id: string
          last_stop_name: string | null
          lat: number
          live_share_token: string
          lng: number
          speed: number | null
          status: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          heading?: number | null
          id?: string
          last_stop_name?: string | null
          lat: number
          live_share_token?: string
          lng: number
          speed?: number | null
          status?: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          heading?: number | null
          id?: string
          last_stop_name?: string | null
          lat?: number
          live_share_token?: string
          lng?: number
          speed?: number | null
          status?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_photos: {
        Row: {
          created_at: string
          id: string
          path: string | null
          stop_id: string | null
          trip_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string | null
          stop_id?: string | null
          trip_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string | null
          stop_id?: string | null
          trip_id?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
      vehicle_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          storage_path: string
          url: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path: string
          url: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path?: string
          url?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          id?: string
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
      decline_invite: { Args: { p_token: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_my_account: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_invite_preview: { Args: { p_token: string }; Returns: Json }
      get_shared_trip: { Args: { p_token: string }; Returns: Json }
      increment_partner_click: {
        Args: { p_partner_id: string }
        Returns: undefined
      }
      increment_partner_impression: {
        Args: { p_partner_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_trip_member: {
        Args: { _trip_id: string; _user_id: string }
        Returns: boolean
      }
      join_trip_with_token: { Args: { p_token: string }; Returns: Json }
      list_followed_trips: { Args: never; Returns: Json }
      list_trip_members: { Args: { p_trip_id: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reset_partner_monthly_stats: { Args: never; Returns: undefined }
      restore_account_by_token: { Args: { p_token: string }; Returns: Json }
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
    Enums: {},
  },
} as const

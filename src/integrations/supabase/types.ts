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
      device_connections: {
        Row: {
          created_at: string
          external_user_id: string | null
          id: string
          last_synced_at: string | null
          provider: string
          status: Database["public"]["Enums"]["device_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          external_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          status?: Database["public"]["Enums"]["device_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          external_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["device_status"]
          user_id?: string
        }
        Relationships: []
      }
      health_logs: {
        Row: {
          created_at: string
          energy_level: number | null
          exercise_minutes: number | null
          id: string
          log_date: string
          meals_note: string | null
          meditation_minutes: number | null
          mood: string | null
          sleep_hours: number | null
          stress_level: number | null
          symptoms_note: string | null
          user_id: string
          water_liters: number | null
        }
        Insert: {
          created_at?: string
          energy_level?: number | null
          exercise_minutes?: number | null
          id?: string
          log_date?: string
          meals_note?: string | null
          meditation_minutes?: number | null
          mood?: string | null
          sleep_hours?: number | null
          stress_level?: number | null
          symptoms_note?: string | null
          user_id: string
          water_liters?: number | null
        }
        Update: {
          created_at?: string
          energy_level?: number | null
          exercise_minutes?: number | null
          id?: string
          log_date?: string
          meals_note?: string | null
          meditation_minutes?: number | null
          mood?: string | null
          sleep_hours?: number | null
          stress_level?: number | null
          symptoms_note?: string | null
          user_id?: string
          water_liters?: number | null
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          activity_score: number | null
          created_at: string
          id: string
          nutrition_score: number | null
          overall_score: number
          recovery_score: number | null
          score_date: string
          sleep_score: number | null
          stress_score: number | null
          user_id: string
        }
        Insert: {
          activity_score?: number | null
          created_at?: string
          id?: string
          nutrition_score?: number | null
          overall_score: number
          recovery_score?: number | null
          score_date?: string
          sleep_score?: number | null
          stress_score?: number | null
          user_id: string
        }
        Update: {
          activity_score?: number | null
          created_at?: string
          id?: string
          nutrition_score?: number | null
          overall_score?: number
          recovery_score?: number | null
          score_date?: string
          sleep_score?: number | null
          stress_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          created_at: string
          description: string
          id: string
          severity: Database["public"]["Enums"]["insight_severity"]
          title: string
          type: Database["public"]["Enums"]["insight_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          severity?: Database["public"]["Enums"]["insight_severity"]
          title: string
          type?: Database["public"]["Enums"]["insight_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          severity?: Database["public"]["Enums"]["insight_severity"]
          title?: string
          type?: Database["public"]["Enums"]["insight_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          category: Database["public"]["Enums"]["recommendation_category"]
          completed_at: string | null
          created_at: string
          description: string
          generated_for_date: string
          id: string
          priority: Database["public"]["Enums"]["recommendation_priority"]
          status: Database["public"]["Enums"]["recommendation_status"]
          title: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["recommendation_category"]
          completed_at?: string | null
          created_at?: string
          description: string
          generated_for_date?: string
          id?: string
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          status?: Database["public"]["Enums"]["recommendation_status"]
          title: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["recommendation_category"]
          completed_at?: string | null
          created_at?: string
          description?: string
          generated_for_date?: string
          id?: string
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          status?: Database["public"]["Enums"]["recommendation_status"]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          health_goal: string | null
          id: string
          notification_preferences: Json
          unit_system: Database["public"]["Enums"]["unit_system"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          health_goal?: string | null
          id?: string
          notification_preferences?: Json
          unit_system?: Database["public"]["Enums"]["unit_system"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          health_goal?: string | null
          id?: string
          notification_preferences?: Json
          unit_system?: Database["public"]["Enums"]["unit_system"]
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
      [_ in never]: never
    }
    Enums: {
      device_status: "connected" | "disconnected" | "pending"
      insight_severity: "low" | "medium" | "high"
      insight_type: "positive" | "warning" | "neutral"
      recommendation_category:
        | "sleep"
        | "activity"
        | "stress"
        | "nutrition"
        | "recovery"
        | "mindfulness"
      recommendation_priority: "low" | "medium" | "high"
      recommendation_status: "pending" | "done" | "snoozed" | "dismissed"
      unit_system: "metric" | "imperial"
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
      device_status: ["connected", "disconnected", "pending"],
      insight_severity: ["low", "medium", "high"],
      insight_type: ["positive", "warning", "neutral"],
      recommendation_category: [
        "sleep",
        "activity",
        "stress",
        "nutrition",
        "recovery",
        "mindfulness",
      ],
      recommendation_priority: ["low", "medium", "high"],
      recommendation_status: ["pending", "done", "snoozed", "dismissed"],
      unit_system: ["metric", "imperial"],
    },
  },
} as const

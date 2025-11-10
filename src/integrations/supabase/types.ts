export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      batches: {
        Row: {
          created_at: string | null
          created_by: string | null
          due_date: string | null
          file_url: string | null
          id: string
          isActive: boolean | null
          name: string
          org_id: string
          priority: string | null
          project_id: string
          task_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          isActive?: boolean | null
          name: string
          org_id: string
          priority?: string | null
          project_id: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          isActive?: boolean | null
          name?: string
          org_id?: string
          priority?: string | null
          project_id?: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_orgid_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_projectid_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "tasktemplate_history"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_batch: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          org_id: string | null
          project_id: string | null
          total_tasks: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          project_id?: string | null
          total_tasks?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          project_id?: string | null
          total_tasks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_batch_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "delivery_batch_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batch_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          email: string
          expires_at: string
          name: string | null
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          email: string
          expires_at?: string
          name?: string | null
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          email?: string
          expires_at?: string
          name?: string | null
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          email: string | null
          id: string
          name: string | null
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: string | null
          user_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          user_id: string
        }
        Update: {
          email?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_org"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["role"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string | null
          org_id: string
          task_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          org_id: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          org_id?: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_orgid_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "tasktemplate_history"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_acl: {
        Row: {
          id: string
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_acl_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          annotated_by: string | null
          assigned_to: string | null
          comment: string | null
          created_at: string | null
          end_time: string | null
          id: string
          is_accepted: boolean | null
          is_reviewed: boolean | null
          results: Json | null
          reviewed_by: string | null
          start_time: string | null
          task_id: string
          time_taken_to_annotate: unknown | null
          updated_at: string | null
        }
        Insert: {
          annotated_by?: string | null
          assigned_to?: string | null
          comment?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_accepted?: boolean | null
          is_reviewed?: boolean | null
          results?: Json | null
          reviewed_by?: string | null
          start_time?: string | null
          task_id: string
          time_taken_to_annotate?: unknown | null
          updated_at?: string | null
        }
        Update: {
          annotated_by?: string | null
          assigned_to?: string | null
          comment?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_accepted?: boolean | null
          is_reviewed?: boolean | null
          results?: Json | null
          reviewed_by?: string | null
          start_time?: string | null
          task_id?: string
          time_taken_to_annotate?: unknown | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_annotated_by_fkey"
            columns: ["annotated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_history_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_history_taskid_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          annotations_done: number
          assigned_user: string | null
          batch_id: string
          created_at: string | null
          created_by: string
          delivery_batch_id: string | null
          id: string
          org_id: string
          required_annotations: number
          skip_count: number
          status: string
          task_data: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          annotations_done?: number
          assigned_user?: string | null
          batch_id: string
          created_at?: string | null
          created_by: string
          delivery_batch_id?: string | null
          id?: string
          org_id: string
          required_annotations?: number
          skip_count?: number
          status?: string
          task_data?: Json | null
          type: string
          updated_at?: string | null
        }
        Update: {
          annotations_done?: number
          assigned_user?: string | null
          batch_id?: string
          created_at?: string | null
          created_by?: string
          delivery_batch_id?: string | null
          id?: string
          org_id?: string
          required_annotations?: number
          skip_count?: number
          status?: string
          task_data?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_user_fkey"
            columns: ["assigned_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_delivery_batch_id_fkey"
            columns: ["delivery_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_orgid_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasktemplate_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          instructions: string | null
          notes: string | null
          project_id: string | null
          reference_link: string | null
          task_template: Json | null
          version_name: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          instructions?: string | null
          notes?: string | null
          project_id?: string | null
          reference_link?: string | null
          task_template?: Json | null
          version_name?: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          instructions?: string | null
          notes?: string | null
          project_id?: string | null
          reference_link?: string | null
          task_template?: Json | null
          version_name?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasktemplate_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          permissions: Database["public"]["Enums"]["app_permission"][]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permissions: Database["public"]["Enums"]["app_permission"][]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permissions?: Database["public"]["Enums"]["app_permission"][]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_token: string }
        Returns: undefined
      }
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
      get_annotator_dashboard_stats: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      get_manager_dashboard_stats: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_reviewer_dashboard_stats: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      get_task_counts_by_annotator: {
        Args: {
          annotator_ids: string[]
          org_id_param: string
          task_statuses: string[]
        }
        Returns: {
          assigned_user: string
          task_count: number
        }[]
      }
      get_tasks_with_priority_sorting: {
        Args: {
          batch_id_param?: string
          current_user_id: string
          date_filter?: string
          limit_param?: number
          offset_param?: number
          project_id_param?: string
          skip_filter?: boolean
          status_filter?: string
          task_statuses: string[]
        }
        Returns: {
          annotations_done: number
          assigned_user: string
          batch_id: string
          batch_name: string
          created_at: string
          created_by: string
          id: string
          org_id: string
          profile_email: string
          profile_name: string
          required_annotations: number
          skip_count: number
          status: string
          task_data: Json
          total_count: number
          type: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      app_permission:
        | "project:read"
        | "project:write"
        | "project:update"
        | "project:delete"
        | "batch:read"
        | "batch:write"
        | "batch:update"
        | "batch:delete"
        | "task:read"
        | "task:write"
        | "task:update"
        | "task:delete"
        | "task_history:read"
        | "task_history:write"
        | "task_history:update"
        | "task_history:delete"
      app_role: "manager" | "annotator" | "reviewer" | "admin"
      sla_status: "on track" | "at risk" | "overdue" | "pending"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_permission: [
        "project:read",
        "project:write",
        "project:update",
        "project:delete",
        "batch:read",
        "batch:write",
        "batch:update",
        "batch:delete",
        "task:read",
        "task:write",
        "task:update",
        "task:delete",
        "task_history:read",
        "task_history:write",
        "task_history:update",
        "task_history:delete",
      ],
      app_role: ["manager", "annotator", "reviewer", "admin"],
      sla_status: ["on track", "at risk", "overdue", "pending"],
    },
  },
} as const


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
      ai_agents: {
        Row: {
          created_at: string
          description: string | null
          executions: number
          id: string
          last_run_at: string | null
          name: string
          owner_id: string
          status: Database["public"]["Enums"]["ai_agent_status"]
          success_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          executions?: number
          id?: string
          last_run_at?: string | null
          name: string
          owner_id: string
          status?: Database["public"]["Enums"]["ai_agent_status"]
          success_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          executions?: number
          id?: string
          last_run_at?: string | null
          name?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["ai_agent_status"]
          success_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      b2b_orders: {
        Row: {
          code: string
          created_at: string
          customer_name: string
          id: string
          notes: string | null
          order_date: string
          owner_id: string
          representative: string | null
          status: Database["public"]["Enums"]["b2b_order_status"]
          total_value: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          customer_name: string
          id?: string
          notes?: string | null
          order_date?: string
          owner_id: string
          representative?: string | null
          status?: Database["public"]["Enums"]["b2b_order_status"]
          total_value?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          customer_name?: string
          id?: string
          notes?: string | null
          order_date?: string
          owner_id?: string
          representative?: string | null
          status?: Database["public"]["Enums"]["b2b_order_status"]
          total_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          cover_path: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          launch_date: string | null
          name: string
          owner_id: string
          palette: string[] | null
          progress: number
          season: string
          status: Database["public"]["Enums"]["collection_status"]
          updated_at: string
          year: number
        }
        Insert: {
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          launch_date?: string | null
          name: string
          owner_id: string
          palette?: string[] | null
          progress?: number
          season: string
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
          year: number
        }
        Update: {
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          launch_date?: string | null
          name?: string
          owner_id?: string
          palette?: string[] | null
          progress?: number
          season?: string
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          owner_id: string
          status: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["account_status"]
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          balance: number
          category: Database["public"]["Enums"]["inventory_category"]
          created_at: string
          deposit: string | null
          id: string
          minimum: number
          name: string
          notes: string | null
          owner_id: string
          sku: string
          unit: string
          updated_at: string
        }
        Insert: {
          balance?: number
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          deposit?: string | null
          id?: string
          minimum?: number
          name: string
          notes?: string | null
          owner_id: string
          sku: string
          unit?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          deposit?: string | null
          id?: string
          minimum?: number
          name?: string
          notes?: string | null
          owner_id?: string
          sku?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          channel: string | null
          created_at: string
          end_date: string | null
          id: string
          investment: number
          name: string
          notes: string | null
          owner_id: string
          roas: number
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          investment?: number
          name: string
          notes?: string | null
          owner_id: string
          roas?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          investment?: number
          name?: string
          notes?: string | null
          owner_id?: string
          roas?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: []
      }
      mobile_devices: {
        Row: {
          active: boolean
          app_version: string
          created_at: string
          id: string
          last_seen_at: string
          owner_id: string
          platform: string
          updated_at: string
          user_name: string
        }
        Insert: {
          active?: boolean
          app_version: string
          created_at?: string
          id?: string
          last_seen_at?: string
          owner_id: string
          platform: string
          updated_at?: string
          user_name: string
        }
        Update: {
          active?: boolean
          app_version?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          owner_id?: string
          platform?: string
          updated_at?: string
          user_name?: string
        }
        Relationships: []
      }
      production_orders: {
        Row: {
          code: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          owner_id: string
          product_id: string | null
          progress: number
          quantity: number
          status: Database["public"]["Enums"]["production_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          progress?: number
          quantity?: number
          status?: Database["public"]["Enums"]["production_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          progress?: number
          quantity?: number
          status?: Database["public"]["Enums"]["production_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          collection_id: string | null
          colors: string[] | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          owner_id: string
          sell_price: number | null
          sizes: string[] | null
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          collection_id?: string | null
          colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          owner_id: string
          sell_price?: number | null
          sizes?: string[] | null
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          collection_id?: string | null
          colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          owner_id?: string
          sell_price?: number | null
          sizes?: string[] | null
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prototypes: {
        Row: {
          code: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          owner_id: string
          product_id: string | null
          stage: Database["public"]["Enums"]["prototype_stage"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          stage?: Database["public"]["Enums"]["prototype_stage"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          stage?: Database["public"]["Enums"]["prototype_stage"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototypes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prototypes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          category: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          rating: number | null
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          rating?: number | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          rating?: number | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tech_sheets: {
        Row: {
          code: string
          content: string | null
          created_at: string
          id: string
          owner_id: string
          product_id: string | null
          status: Database["public"]["Enums"]["tech_sheet_status"]
          updated_at: string
          version: string
        }
        Insert: {
          code: string
          content?: string | null
          created_at?: string
          id?: string
          owner_id: string
          product_id?: string | null
          status?: Database["public"]["Enums"]["tech_sheet_status"]
          updated_at?: string
          version?: string
        }
        Update: {
          code?: string
          content?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          product_id?: string | null
          status?: Database["public"]["Enums"]["tech_sheet_status"]
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_sheets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "pendente" | "pago" | "atrasado" | "cancelado"
      account_type: "pagar" | "receber"
      ai_agent_status: "ativo" | "pausado" | "erro"
      app_role: "admin" | "gerente" | "designer" | "comprador" | "vendedor"
      b2b_order_status:
        | "rascunho"
        | "aprovado"
        | "em_producao"
        | "faturado"
        | "cancelado"
      campaign_status: "programada" | "ativa" | "pausada" | "concluida"
      collection_status:
        | "briefing"
        | "design"
        | "desenvolvimento"
        | "producao"
        | "entregue"
      inventory_category: "tecido" | "aviamento" | "acabado" | "outros"
      product_status:
        | "rascunho"
        | "desenvolvimento"
        | "aprovado"
        | "producao"
        | "descontinuado"
      production_status:
        | "aguardando"
        | "em_producao"
        | "concluida"
        | "atrasada"
        | "cancelada"
      prototype_stage:
        | "solicitado"
        | "em_confeccao"
        | "em_prova"
        | "aprovado"
        | "reprovado"
      tech_sheet_status: "rascunho" | "em_revisao" | "aprovada"
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
      account_status: ["pendente", "pago", "atrasado", "cancelado"],
      account_type: ["pagar", "receber"],
      ai_agent_status: ["ativo", "pausado", "erro"],
      app_role: ["admin", "gerente", "designer", "comprador", "vendedor"],
      b2b_order_status: [
        "rascunho",
        "aprovado",
        "em_producao",
        "faturado",
        "cancelado",
      ],
      campaign_status: ["programada", "ativa", "pausada", "concluida"],
      collection_status: [
        "briefing",
        "design",
        "desenvolvimento",
        "producao",
        "entregue",
      ],
      inventory_category: ["tecido", "aviamento", "acabado", "outros"],
      product_status: [
        "rascunho",
        "desenvolvimento",
        "aprovado",
        "producao",
        "descontinuado",
      ],
      production_status: [
        "aguardando",
        "em_producao",
        "concluida",
        "atrasada",
        "cancelada",
      ],
      prototype_stage: [
        "solicitado",
        "em_confeccao",
        "em_prova",
        "aprovado",
        "reprovado",
      ],
      tech_sheet_status: ["rascunho", "em_revisao", "aprovada"],
    },
  },
} as const

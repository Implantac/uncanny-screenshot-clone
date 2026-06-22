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
          last_output: string | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          owner_id: string
          schedule_cron: string | null
          status: Database["public"]["Enums"]["ai_agent_status"]
          success_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          executions?: number
          id?: string
          last_output?: string | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          owner_id: string
          schedule_cron?: string | null
          status?: Database["public"]["Enums"]["ai_agent_status"]
          success_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          executions?: number
          id?: string
          last_output?: string | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          owner_id?: string
          schedule_cron?: string | null
          status?: Database["public"]["Enums"]["ai_agent_status"]
          success_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      alert_dismissals: {
        Row: {
          alert_key: string
          created_at: string
          dismissed_until: string | null
          id: string
          owner_id: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          alert_key: string
          created_at?: string
          dismissed_until?: string | null
          id?: string
          owner_id: string
          resolved?: boolean
          user_id: string
        }
        Update: {
          alert_key?: string
          created_at?: string
          dismissed_until?: string | null
          id?: string
          owner_id?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: []
      }
      assortment_plan: {
        Row: {
          channel: Database["public"]["Enums"]["sales_channel"]
          collection_id: string
          created_at: string
          family_id: string | null
          id: string
          notes: string | null
          owner_id: string
          price_tier: string | null
          target_margin_pct: number | null
          target_revenue: number
          target_skus: number
          target_units: number
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["sales_channel"]
          collection_id: string
          created_at?: string
          family_id?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          price_tier?: string | null
          target_margin_pct?: number | null
          target_revenue?: number
          target_skus?: number
          target_units?: number
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["sales_channel"]
          collection_id?: string
          created_at?: string
          family_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          price_tier?: string | null
          target_margin_pct?: number | null
          target_revenue?: number
          target_skus?: number
          target_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assortment_plan_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assortment_plan_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          payload: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      b2b_orders: {
        Row: {
          code: string
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          notes: string | null
          order_date: string
          owner_id: string
          representative: string | null
          representative_id: string | null
          status: Database["public"]["Enums"]["b2b_order_status"]
          total_value: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          order_date?: string
          owner_id: string
          representative?: string | null
          representative_id?: string | null
          status?: Database["public"]["Enums"]["b2b_order_status"]
          total_value?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          order_date?: string
          owner_id?: string
          representative?: string | null
          representative_id?: string | null
          status?: Database["public"]["Enums"]["b2b_order_status"]
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_orders_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_templates: {
        Row: {
          category: string | null
          created_at: string
          id: string
          materials: Json
          name: string
          operations: Json
          owner_id: string
          source_sheet_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          materials?: Json
          name: string
          operations?: Json
          owner_id: string
          source_sheet_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          materials?: Json
          name?: string
          operations?: Json
          owner_id?: string
          source_sheet_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_templates_source_sheet_id_fkey"
            columns: ["source_sheet_id"]
            isOneToOne: false
            referencedRelation: "tech_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_moodboard: {
        Row: {
          caption: string | null
          collection_id: string
          created_at: string
          id: string
          image_url: string
          kind: string | null
          owner_id: string
          position: number | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          collection_id: string
          created_at?: string
          id?: string
          image_url: string
          kind?: string | null
          owner_id: string
          position?: number | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          collection_id?: string
          created_at?: string
          id?: string
          image_url?: string
          kind?: string | null
          owner_id?: string
          position?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_moodboard_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_products: {
        Row: {
          channel_exclusive: string[] | null
          collection_id: string
          created_at: string
          display_order: number
          family_id: string | null
          id: string
          intro_season: string | null
          notes: string | null
          owner_id: string
          product_id: string
          role: Database["public"]["Enums"]["collection_product_role"]
          source_collection_id: string | null
          theme_id: string | null
          updated_at: string
        }
        Insert: {
          channel_exclusive?: string[] | null
          collection_id: string
          created_at?: string
          display_order?: number
          family_id?: string | null
          id?: string
          intro_season?: string | null
          notes?: string | null
          owner_id: string
          product_id: string
          role?: Database["public"]["Enums"]["collection_product_role"]
          source_collection_id?: string | null
          theme_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_exclusive?: string[] | null
          collection_id?: string
          created_at?: string
          display_order?: number
          family_id?: string | null
          id?: string
          intro_season?: string | null
          notes?: string | null
          owner_id?: string
          product_id?: string
          role?: Database["public"]["Enums"]["collection_product_role"]
          source_collection_id?: string | null
          theme_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_source_collection_id_fkey"
            columns: ["source_collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "collection_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_themes: {
        Row: {
          collection_id: string
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          owner_id: string
          palette: string[] | null
          updated_at: string
        }
        Insert: {
          collection_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          owner_id: string
          palette?: string[] | null
          updated_at?: string
        }
        Update: {
          collection_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          owner_id?: string
          palette?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_themes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_versions: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          snapshot: Json
          version: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          snapshot?: Json
          version: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          snapshot?: Json
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_versions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_path: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          erp_id: string | null
          erp_source: string | null
          erp_synced_at: string | null
          id: string
          launch_date: string | null
          name: string
          owner_id: string
          palette: string[] | null
          progress: number
          season: string
          status: Database["public"]["Enums"]["collection_status"]
          status_change_reason: string | null
          status_changed_at: string
          status_changed_by: string | null
          updated_at: string
          year: number
        }
        Insert: {
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          id?: string
          launch_date?: string | null
          name: string
          owner_id: string
          palette?: string[] | null
          progress?: number
          season: string
          status?: Database["public"]["Enums"]["collection_status"]
          status_change_reason?: string | null
          status_changed_at?: string
          status_changed_by?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          id?: string
          launch_date?: string | null
          name?: string
          owner_id?: string
          palette?: string[] | null
          progress?: number
          season?: string
          status?: Database["public"]["Enums"]["collection_status"]
          status_change_reason?: string | null
          status_changed_at?: string
          status_changed_by?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          city: string | null
          created_at: string
          document: string | null
          email: string | null
          erp_id: string | null
          erp_source: string | null
          erp_synced_at: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dpp_records: {
        Row: {
          care_instructions: string | null
          certifications: string[] | null
          composition: string | null
          created_at: string
          hash: string | null
          id: string
          origin: string | null
          owner_id: string
          product_id: string
          published_at: string | null
          repairability_score: number | null
          revoked_at: string | null
          snapshot: Json
          status: string
          updated_at: string
          variant_id: string | null
          version: number
        }
        Insert: {
          care_instructions?: string | null
          certifications?: string[] | null
          composition?: string | null
          created_at?: string
          hash?: string | null
          id?: string
          origin?: string | null
          owner_id: string
          product_id: string
          published_at?: string | null
          repairability_score?: number | null
          revoked_at?: string | null
          snapshot?: Json
          status?: string
          updated_at?: string
          variant_id?: string | null
          version?: number
        }
        Update: {
          care_instructions?: string | null
          certifications?: string[] | null
          composition?: string | null
          created_at?: string
          hash?: string | null
          id?: string
          origin?: string | null
          owner_id?: string
          product_id?: string
          published_at?: string | null
          repairability_score?: number | null
          revoked_at?: string | null
          snapshot?: Json
          status?: string
          updated_at?: string
          variant_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dpp_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_records_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      dpp_views: {
        Row: {
          dpp_record_id: string
          id: string
          ip_hash: string | null
          product_id: string | null
          referrer: string | null
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          dpp_record_id: string
          id?: string
          ip_hash?: string | null
          product_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          dpp_record_id?: string
          id?: string
          ip_hash?: string | null
          product_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpp_views_dpp_record_id_fkey"
            columns: ["dpp_record_id"]
            isOneToOne: false
            referencedRelation: "dpp_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_integration_config: {
        Row: {
          active: boolean
          created_at: string
          erp_endpoint: string | null
          erp_name: string | null
          id: string
          last_error: string | null
          last_inbound_at: string | null
          last_outbound_at: string | null
          owner_id: string
          updated_at: string
          webhook_public_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          erp_endpoint?: string | null
          erp_name?: string | null
          id?: string
          last_error?: string | null
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          owner_id: string
          updated_at?: string
          webhook_public_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          erp_endpoint?: string | null
          erp_name?: string | null
          id?: string
          last_error?: string | null
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          owner_id?: string
          updated_at?: string
          webhook_public_id?: string
        }
        Relationships: []
      }
      erp_inventory_mirror: {
        Row: {
          balance: number
          created_at: string
          erp_updated_at: string | null
          id: string
          location: string | null
          owner_id: string
          raw: Json | null
          sku: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          erp_updated_at?: string | null
          id?: string
          location?: string | null
          owner_id: string
          raw?: Json | null
          sku: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          erp_updated_at?: string | null
          id?: string
          location?: string | null
          owner_id?: string
          raw?: Json | null
          sku?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      erp_purchase_mirror: {
        Row: {
          created_at: string
          erp_po_code: string
          id: string
          ordered_at: string | null
          owner_id: string
          raw: Json | null
          status: string | null
          supplier: string | null
          synced_at: string
          total_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          erp_po_code: string
          id?: string
          ordered_at?: string | null
          owner_id: string
          raw?: Json | null
          status?: string | null
          supplier?: string | null
          synced_at?: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          erp_po_code?: string
          id?: string
          ordered_at?: string | null
          owner_id?: string
          raw?: Json | null
          status?: string | null
          supplier?: string | null
          synced_at?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      erp_sales_mirror: {
        Row: {
          campaign_code: string | null
          channel: string | null
          created_at: string
          customer: string | null
          erp_sale_id: string
          id: string
          influencer_code: string | null
          owner_id: string
          product_ref: string | null
          quantity: number
          raw: Json | null
          region: string | null
          sku: string | null
          sold_at: string | null
          synced_at: string
          total_value: number
          updated_at: string
        }
        Insert: {
          campaign_code?: string | null
          channel?: string | null
          created_at?: string
          customer?: string | null
          erp_sale_id: string
          id?: string
          influencer_code?: string | null
          owner_id: string
          product_ref?: string | null
          quantity?: number
          raw?: Json | null
          region?: string | null
          sku?: string | null
          sold_at?: string | null
          synced_at?: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          campaign_code?: string | null
          channel?: string | null
          created_at?: string
          customer?: string | null
          erp_sale_id?: string
          id?: string
          influencer_code?: string | null
          owner_id?: string
          product_ref?: string | null
          quantity?: number
          raw?: Json | null
          region?: string | null
          sku?: string | null
          sold_at?: string | null
          synced_at?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      erp_sync_log: {
        Row: {
          created_at: string
          direction: string
          entity_ref: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string
          id: string
          owner_id: string
          payload: Json | null
          records_affected: number | null
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          entity_ref?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          owner_id: string
          payload?: Json | null
          records_affected?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          entity_ref?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          owner_id?: string
          payload?: Json | null
          records_affected?: number | null
          status?: string
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
      fit_session_comments: {
        Row: {
          comment: string
          created_at: string
          fit_session_id: string
          id: string
          image_url: string | null
          owner_id: string
          pom_label: string | null
          resolved: boolean
          severity: string
        }
        Insert: {
          comment: string
          created_at?: string
          fit_session_id: string
          id?: string
          image_url?: string | null
          owner_id: string
          pom_label?: string | null
          resolved?: boolean
          severity?: string
        }
        Update: {
          comment?: string
          created_at?: string
          fit_session_id?: string
          id?: string
          image_url?: string | null
          owner_id?: string
          pom_label?: string | null
          resolved?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "fit_session_comments_fit_session_id_fkey"
            columns: ["fit_session_id"]
            isOneToOne: false
            referencedRelation: "fit_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fit_sessions: {
        Row: {
          created_at: string
          fit_model: string | null
          id: string
          iteration: number
          notes: string | null
          owner_id: string
          product_id: string | null
          prototype_id: string | null
          session_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fit_model?: string | null
          id?: string
          iteration?: number
          notes?: string | null
          owner_id: string
          product_id?: string | null
          prototype_id?: string | null
          session_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fit_model?: string | null
          id?: string
          iteration?: number
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          prototype_id?: string | null
          session_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fit_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fit_sessions_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_shipments: {
        Row: {
          collection_id: string | null
          created_at: string
          delivered_at: string | null
          id: string
          influencer_id: string
          notes: string | null
          owner_id: string
          post_url: string | null
          posted_at: string | null
          product_id: string | null
          quantity: number
          region: string | null
          sales_after: number
          sales_before: number
          shipped_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          influencer_id: string
          notes?: string | null
          owner_id?: string
          post_url?: string | null
          posted_at?: string | null
          product_id?: string | null
          quantity?: number
          region?: string | null
          sales_after?: number
          sales_before?: number
          shipped_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          influencer_id?: string
          notes?: string | null
          owner_id?: string
          post_url?: string | null
          posted_at?: string | null
          product_id?: string | null
          quantity?: number
          region?: string | null
          sales_after?: number
          sales_before?: number
          shipped_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_shipments_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_shipments_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_shipments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          cidade: string | null
          created_at: string
          data_postagem: string | null
          engajamento: number
          estado: string | null
          foto_url: string | null
          id: string
          instagram: string | null
          nome: string
          notes: string | null
          owner_id: string
          segmento: string | null
          seguidores: number
          ticket_medio: number
          tiktok: string | null
          updated_at: string
          valor: number
          vendas_antes: number
          vendas_depois: number
          youtube: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          data_postagem?: string | null
          engajamento?: number
          estado?: string | null
          foto_url?: string | null
          id?: string
          instagram?: string | null
          nome: string
          notes?: string | null
          owner_id: string
          segmento?: string | null
          seguidores?: number
          ticket_medio?: number
          tiktok?: string | null
          updated_at?: string
          valor?: number
          vendas_antes?: number
          vendas_depois?: number
          youtube?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          data_postagem?: string | null
          engajamento?: number
          estado?: string | null
          foto_url?: string | null
          id?: string
          instagram?: string | null
          nome?: string
          notes?: string | null
          owner_id?: string
          segmento?: string | null
          seguidores?: number
          ticket_medio?: number
          tiktok?: string | null
          updated_at?: string
          valor?: number
          vendas_antes?: number
          vendas_depois?: number
          youtube?: string | null
        }
        Relationships: []
      }
      inventory_cycle_counts: {
        Row: {
          abc_class: string
          counted_at: string
          counted_balance: number
          counted_by: string | null
          created_at: string
          expected_balance: number
          id: string
          inventory_item_id: string
          notes: string | null
          owner_id: string
          updated_at: string
          variance: number | null
          variance_pct: number | null
        }
        Insert: {
          abc_class: string
          counted_at?: string
          counted_balance?: number
          counted_by?: string | null
          created_at?: string
          expected_balance?: number
          id?: string
          inventory_item_id: string
          notes?: string | null
          owner_id: string
          updated_at?: string
          variance?: number | null
          variance_pct?: number | null
        }
        Update: {
          abc_class?: string
          counted_at?: string
          counted_balance?: number
          counted_by?: string | null
          created_at?: string
          expected_balance?: number
          id?: string
          inventory_item_id?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
          variance?: number | null
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_cycle_counts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          avg_unit_cost: number | null
          balance: number
          category: Database["public"]["Enums"]["inventory_category"]
          color_internal: string | null
          color_supplier: string | null
          created_at: string
          deposit: string | null
          id: string
          image_url: string | null
          internal_color: string | null
          last_entry_at: string | null
          last_exit_at: string | null
          maximum: number
          minimum: number
          mrp_overrides: Json
          name: string
          notes: string | null
          owner_id: string
          photo_url: string | null
          preferred_supplier_id: string | null
          product_id: string | null
          safety_days: number
          sku: string
          supplier_color: string | null
          supplier_lot: string | null
          tech_sheet_pdf_url: string | null
          turnover_30d: number
          unit: string
          updated_at: string
        }
        Insert: {
          avg_unit_cost?: number | null
          balance?: number
          category?: Database["public"]["Enums"]["inventory_category"]
          color_internal?: string | null
          color_supplier?: string | null
          created_at?: string
          deposit?: string | null
          id?: string
          image_url?: string | null
          internal_color?: string | null
          last_entry_at?: string | null
          last_exit_at?: string | null
          maximum?: number
          minimum?: number
          mrp_overrides?: Json
          name: string
          notes?: string | null
          owner_id: string
          photo_url?: string | null
          preferred_supplier_id?: string | null
          product_id?: string | null
          safety_days?: number
          sku: string
          supplier_color?: string | null
          supplier_lot?: string | null
          tech_sheet_pdf_url?: string | null
          turnover_30d?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          avg_unit_cost?: number | null
          balance?: number
          category?: Database["public"]["Enums"]["inventory_category"]
          color_internal?: string | null
          color_supplier?: string | null
          created_at?: string
          deposit?: string | null
          id?: string
          image_url?: string | null
          internal_color?: string | null
          last_entry_at?: string | null
          last_exit_at?: string | null
          maximum?: number
          minimum?: number
          mrp_overrides?: Json
          name?: string
          notes?: string | null
          owner_id?: string
          photo_url?: string | null
          preferred_supplier_id?: string | null
          product_id?: string | null
          safety_days?: number
          sku?: string
          supplier_color?: string | null
          supplier_lot?: string | null
          tech_sheet_pdf_url?: string | null
          turnover_30d?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          inventory_item_id: string
          lot_code: string
          notes: string | null
          owner_id: string
          quantity: number
          received_at: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          inventory_item_id: string
          lot_code: string
          notes?: string | null
          owner_id: string
          quantity?: number
          received_at?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          inventory_item_id?: string
          lot_code?: string
          notes?: string | null
          owner_id?: string
          quantity?: number
          received_at?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_scraps: {
        Row: {
          cost_value: number | null
          created_at: string
          id: string
          inventory_item_id: string
          lot_id: string | null
          notes: string | null
          owner_id: string
          production_order_id: string | null
          quantity: number
          reason: string
          registered_by: string | null
        }
        Insert: {
          cost_value?: number | null
          created_at?: string
          id?: string
          inventory_item_id: string
          lot_id?: string | null
          notes?: string | null
          owner_id: string
          production_order_id?: string | null
          quantity: number
          reason: string
          registered_by?: string | null
        }
        Update: {
          cost_value?: number | null
          created_at?: string
          id?: string
          inventory_item_id?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string
          production_order_id?: string | null
          quantity?: number
          reason?: string
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_scraps_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_scraps_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_scraps_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_briefs: {
        Row: {
          ai_plan: Json | null
          budget: number | null
          campaign_id: string | null
          channels: string[] | null
          collection_id: string | null
          created_at: string
          id: string
          key_message: string | null
          kpi_target: string | null
          lifecycle_trigger: string | null
          objective: string
          owner_id: string
          product_id: string | null
          status: string
          target_audience: string | null
          title: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          ai_plan?: Json | null
          budget?: number | null
          campaign_id?: string | null
          channels?: string[] | null
          collection_id?: string | null
          created_at?: string
          id?: string
          key_message?: string | null
          kpi_target?: string | null
          lifecycle_trigger?: string | null
          objective: string
          owner_id: string
          product_id?: string | null
          status?: string
          target_audience?: string | null
          title: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          ai_plan?: Json | null
          budget?: number | null
          campaign_id?: string | null
          channels?: string[] | null
          collection_id?: string | null
          created_at?: string
          id?: string
          key_message?: string | null
          kpi_target?: string | null
          lifecycle_trigger?: string | null
          objective?: string
          owner_id?: string
          product_id?: string | null
          status?: string
          target_audience?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_briefs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_briefs_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_briefs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          channel: string | null
          collection_id: string | null
          cost_photos: number | null
          cost_shoot: number | null
          cost_traffic: number | null
          created_at: string
          end_date: string | null
          id: string
          investment: number
          name: string
          notes: string | null
          owner_id: string
          product_id: string | null
          revenue: number | null
          roas: number
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          channel?: string | null
          collection_id?: string | null
          cost_photos?: number | null
          cost_shoot?: number | null
          cost_traffic?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          investment?: number
          name: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          revenue?: number | null
          roas?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          channel?: string | null
          collection_id?: string | null
          cost_photos?: number | null
          cost_shoot?: number | null
          cost_traffic?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          investment?: number
          name?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          revenue?: number | null
          roas?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          owner_id: string
          read_at: string | null
          ref_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          owner_id: string
          read_at?: string | null
          ref_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          owner_id?: string
          read_at?: string | null
          ref_id?: string | null
          title?: string
        }
        Relationships: []
      }
      material_library: {
        Row: {
          active: boolean
          attributes: Json | null
          code: string
          color_hex: string | null
          composition: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          kind: string
          name: string
          owner_id: string
          preferred_supplier_id: string | null
          reference_cost: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          attributes?: Json | null
          code: string
          color_hex?: string | null
          composition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind: string
          name: string
          owner_id: string
          preferred_supplier_id?: string | null
          reference_cost?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          attributes?: Json | null
          code?: string
          color_hex?: string | null
          composition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          name?: string
          owner_id?: string
          preferred_supplier_id?: string | null
          reference_cost?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_library_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
          push_enabled: boolean
          push_provider: string | null
          push_token: string | null
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
          push_enabled?: boolean
          push_provider?: string | null
          push_token?: string | null
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
          push_enabled?: boolean
          push_provider?: string | null
          push_token?: string | null
          updated_at?: string
          user_name?: string
        }
        Relationships: []
      }
      mrp_config: {
        Row: {
          created_at: string
          history_days: number
          holding_cost_pct: number
          order_cost: number
          owner_id: string
          service_level: number
          updated_at: string
          working_days_per_month: number
        }
        Insert: {
          created_at?: string
          history_days?: number
          holding_cost_pct?: number
          order_cost?: number
          owner_id: string
          service_level?: number
          updated_at?: string
          working_days_per_month?: number
        }
        Update: {
          created_at?: string
          history_days?: number
          holding_cost_pct?: number
          order_cost?: number
          owner_id?: string
          service_level?: number
          updated_at?: string
          working_days_per_month?: number
        }
        Relationships: []
      }
      mrp_recalc_queue: {
        Row: {
          owner_id: string
          reason: string | null
          requested_at: string
        }
        Insert: {
          owner_id: string
          reason?: string | null
          requested_at?: string
        }
        Update: {
          owner_id?: string
          reason?: string | null
          requested_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          email_enabled: boolean
          id: string
          muted: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          muted?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          muted?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pcp_stages: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          key: string
          label: string
          owner_id: string
          position: number
          sla_stuck_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          key: string
          label: string
          owner_id: string
          position?: number
          sla_stuck_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          key?: string
          label?: string
          owner_id?: string
          position?: number
          sla_stuck_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_color_options: {
        Row: {
          active: boolean
          created_at: string
          hex: string | null
          id: string
          name: string
          owner_id: string
          position: number
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hex?: string | null
          id?: string
          name: string
          owner_id: string
          position?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hex?: string | null
          id?: string
          name?: string
          owner_id?: string
          position?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_color_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_families: {
        Row: {
          collection_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          owner_id: string
          price_tier: string | null
          target_margin_pct: number | null
          updated_at: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          owner_id: string
          price_tier?: string | null
          target_margin_pct?: number | null
          updated_at?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          owner_id?: string
          price_tier?: string | null
          target_margin_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_families_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lifecycle: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          markdown_pct: number | null
          notes: string | null
          owner_id: string
          product_id: string
          replenishment_policy: Json | null
          state: Database["public"]["Enums"]["product_lifecycle_state"]
          state_changed_at: string
          updated_at: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          markdown_pct?: number | null
          notes?: string | null
          owner_id: string
          product_id: string
          replenishment_policy?: Json | null
          state?: Database["public"]["Enums"]["product_lifecycle_state"]
          state_changed_at?: string
          updated_at?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          markdown_pct?: number | null
          notes?: string | null
          owner_id?: string
          product_id?: string
          replenishment_policy?: Json | null
          state?: Database["public"]["Enums"]["product_lifecycle_state"]
          state_changed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lifecycle_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lifecycle_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lines: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          owner_id: string
          season: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          owner_id: string
          season?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          owner_id?: string
          season?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      product_routing: {
        Row: {
          created_at: string
          family_id: string | null
          id: string
          notes: string | null
          owner_id: string
          product_id: string | null
          required: boolean
          sequence: number
          sla_days: number
          stage_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          required?: boolean
          sequence?: number
          sla_days?: number
          stage_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          required?: boolean
          sequence?: number
          sla_days?: number
          stage_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_routing_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_routing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_size_options: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          owner_id: string
          position: number
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          owner_id: string
          position?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
          position?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_size_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sustainability: {
        Row: {
          certifications: string[] | null
          co2_kg: number | null
          created_at: string
          higg_msi_score: number | null
          id: string
          notes: string | null
          organic_pct: number | null
          owner_id: string
          product_id: string
          recycled_pct: number | null
          score_overall: number | null
          updated_at: string
          water_liters: number | null
        }
        Insert: {
          certifications?: string[] | null
          co2_kg?: number | null
          created_at?: string
          higg_msi_score?: number | null
          id?: string
          notes?: string | null
          organic_pct?: number | null
          owner_id: string
          product_id: string
          recycled_pct?: number | null
          score_overall?: number | null
          updated_at?: string
          water_liters?: number | null
        }
        Update: {
          certifications?: string[] | null
          co2_kg?: number | null
          created_at?: string
          higg_msi_score?: number | null
          id?: string
          notes?: string | null
          organic_pct?: number | null
          owner_id?: string
          product_id?: string
          recycled_pct?: number | null
          score_overall?: number | null
          updated_at?: string
          water_liters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sustainability_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_target_costs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          product_id: string
          target_cost: number
          target_margin_pct: number
          target_retail_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          product_id: string
          target_cost?: number
          target_margin_pct?: number
          target_retail_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string
          target_cost?: number
          target_margin_pct?: number
          target_retail_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_target_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          color_id: string | null
          created_at: string
          ean: string | null
          id: string
          owner_id: string
          product_id: string
          size_id: string | null
          sku: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color_id?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          owner_id: string
          product_id: string
          size_id?: string | null
          sku: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color_id?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          owner_id?: string
          product_id?: string
          size_id?: string | null
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_color_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "product_size_options"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          code: string
          cover_url: string | null
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          planned_qty: number
          process: string | null
          produced_qty: number
          start_date: string | null
          status: Database["public"]["Enums"]["production_batch_status"]
          updated_at: string
        }
        Insert: {
          code: string
          cover_url?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          planned_qty?: number
          process?: string | null
          produced_qty?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_batch_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          cover_url?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          planned_qty?: number
          process?: string | null
          produced_qty?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_batch_status"]
          updated_at?: string
        }
        Relationships: []
      }
      production_occurrences: {
        Row: {
          affected_qty: number | null
          batch_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: string
          order_id: string | null
          owner_id: string
          resolved_at: string | null
          responsible_id: string | null
          sector: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affected_qty?: number | null
          batch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          order_id?: string | null
          owner_id: string
          resolved_at?: string | null
          responsible_id?: string | null
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affected_qty?: number | null
          batch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          owner_id?: string
          resolved_at?: string | null
          responsible_id?: string | null
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_occurrences_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          owner_id: string
          production_order_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          owner_id: string
          production_order_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          production_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_order_comments_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_grid: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          production_order_id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          production_order_id: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          production_order_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_order_grid_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_grid_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          batch_code: string | null
          code: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          outsourced: boolean
          owner_id: string
          parent_order_id: string | null
          priority: number
          product_id: string | null
          progress: number
          quantity: number
          stage: Database["public"]["Enums"]["production_stage"]
          stage_updated_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["production_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          batch_code?: string | null
          code: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          outsourced?: boolean
          owner_id: string
          parent_order_id?: string | null
          priority?: number
          product_id?: string | null
          progress?: number
          quantity?: number
          stage?: Database["public"]["Enums"]["production_stage"]
          stage_updated_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["production_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_code?: string | null
          code?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          outsourced?: boolean
          owner_id?: string
          parent_order_id?: string | null
          priority?: number
          product_id?: string | null
          progress?: number
          quantity?: number
          stage?: Database["public"]["Enums"]["production_stage"]
          stage_updated_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["production_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
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
      production_packages: {
        Row: {
          code: string
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          production_order_id: string
          qty: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          production_order_id: string
          qty: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          production_order_id?: string
          qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_packages_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stage_log: {
        Row: {
          created_at: string
          from_stage: Database["public"]["Enums"]["production_stage"] | null
          id: string
          is_partial: boolean
          note: string | null
          order_id: string
          owner_id: string
          quantity: number
          to_stage: Database["public"]["Enums"]["production_stage"]
        }
        Insert: {
          created_at?: string
          from_stage?: Database["public"]["Enums"]["production_stage"] | null
          id?: string
          is_partial?: boolean
          note?: string | null
          order_id: string
          owner_id: string
          quantity?: number
          to_stage: Database["public"]["Enums"]["production_stage"]
        }
        Update: {
          created_at?: string
          from_stage?: Database["public"]["Enums"]["production_stage"] | null
          id?: string
          is_partial?: boolean
          note?: string | null
          order_id?: string
          owner_id?: string
          quantity?: number
          to_stage?: Database["public"]["Enums"]["production_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "production_stage_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
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
          erp_id: string | null
          erp_source: string | null
          erp_synced_at: string | null
          grade: string | null
          id: string
          image_url: string | null
          line_id: string | null
          name: string
          owner_id: string
          product_class: string | null
          product_group: string | null
          sell_price: number | null
          sizes: string[] | null
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          subgroup: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          collection_id?: string | null
          colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          grade?: string | null
          id?: string
          image_url?: string | null
          line_id?: string | null
          name: string
          owner_id: string
          product_class?: string | null
          product_group?: string | null
          sell_price?: number | null
          sizes?: string[] | null
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          subgroup?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          collection_id?: string | null
          colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          grade?: string | null
          id?: string
          image_url?: string | null
          line_id?: string | null
          name?: string
          owner_id?: string
          product_class?: string | null
          product_group?: string | null
          sell_price?: number | null
          sizes?: string[] | null
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          subgroup?: string | null
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
          {
            foreignKeyName: "products_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "product_lines"
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
      prototype_adjustments: {
        Row: {
          assignee_id: string | null
          attachments: Json
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          prototype_id: string
          reason: string
          requested_by: string | null
          resolved_at: string | null
          sector: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          attachments?: Json
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          prototype_id: string
          reason: string
          requested_by?: string | null
          resolved_at?: string | null
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          attachments?: Json
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          prototype_id?: string
          reason?: string
          requested_by?: string | null
          resolved_at?: string | null
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototype_adjustments_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      prototype_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          owner_id: string
          prototype_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          owner_id: string
          prototype_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          prototype_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototype_comments_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      prototype_gates: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          due_date: string | null
          gate: Database["public"]["Enums"]["prototype_gate_key"]
          id: string
          notes: string | null
          owner_id: string
          prototype_id: string
          status: Database["public"]["Enums"]["prototype_gate_status"]
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          due_date?: string | null
          gate: Database["public"]["Enums"]["prototype_gate_key"]
          id?: string
          notes?: string | null
          owner_id?: string
          prototype_id: string
          status?: Database["public"]["Enums"]["prototype_gate_status"]
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          due_date?: string | null
          gate?: Database["public"]["Enums"]["prototype_gate_key"]
          id?: string
          notes?: string | null
          owner_id?: string
          prototype_id?: string
          status?: Database["public"]["Enums"]["prototype_gate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototype_gates_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      prototype_handoff_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          from_sector: string | null
          id: string
          notes: string | null
          owner_id: string
          prototype_id: string
          to_sector: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event?: string
          from_sector?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          prototype_id: string
          to_sector: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          from_sector?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          prototype_id?: string
          to_sector?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototype_handoff_events_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      prototypes: {
        Row: {
          adjustment_reason: string | null
          adjustment_requested_at: string | null
          adjustment_requested_by: string | null
          code: string
          created_at: string
          current_sector: string | null
          due_date: string | null
          id: string
          needs_adjustment: boolean
          notes: string | null
          owner_id: string
          product_id: string | null
          stage: Database["public"]["Enums"]["prototype_stage"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          adjustment_reason?: string | null
          adjustment_requested_at?: string | null
          adjustment_requested_by?: string | null
          code: string
          created_at?: string
          current_sector?: string | null
          due_date?: string | null
          id?: string
          needs_adjustment?: boolean
          notes?: string | null
          owner_id: string
          product_id?: string | null
          stage?: Database["public"]["Enums"]["prototype_stage"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_reason?: string | null
          adjustment_requested_at?: string | null
          adjustment_requested_by?: string | null
          code?: string
          created_at?: string
          current_sector?: string | null
          due_date?: string | null
          id?: string
          needs_adjustment?: boolean
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
      purchase_order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          inventory_item_id: string | null
          owner_id: string
          purchase_order_id: string
          quantity: number
          total: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          inventory_item_id?: string | null
          owner_id: string
          purchase_order_id: string
          quantity: number
          total?: number | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inventory_item_id?: string | null
          owner_id?: string
          purchase_order_id?: string
          quantity?: number
          total?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          code: string
          created_at: string
          expected_date: string | null
          id: string
          notes: string | null
          owner_id: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string | null
          total_value: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string | null
          total_value?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string | null
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notifications: {
        Row: {
          body: string | null
          created_at: string
          delivered_at: string | null
          device_id: string | null
          error: string | null
          id: string
          kind: string
          link: string | null
          owner_id: string
          payload: Json | null
          sent_at: string
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          device_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          link?: string | null
          owner_id: string
          payload?: Json | null
          sent_at?: string
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          device_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          link?: string | null
          owner_id?: string
          payload?: Json | null
          sent_at?: string
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "mobile_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          corrective_action: string | null
          created_at: string
          due_date: string | null
          effectiveness_check: string | null
          id: string
          inspection_id: string | null
          occurrence_id: string | null
          order_id: string | null
          owner_id: string
          preventive_action: string | null
          problem: string
          root_cause: string | null
          severity: string
          status: string
          supplier_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          due_date?: string | null
          effectiveness_check?: string | null
          id?: string
          inspection_id?: string | null
          occurrence_id?: string | null
          order_id?: string | null
          owner_id: string
          preventive_action?: string | null
          problem: string
          root_cause?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          due_date?: string | null
          effectiveness_check?: string | null
          id?: string
          inspection_id?: string | null
          occurrence_id?: string | null
          order_id?: string | null
          owner_id?: string
          preventive_action?: string | null
          problem?: string
          root_cause?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "quality_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_capa_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "production_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_capa_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_capa_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa_rules: {
        Row: {
          created_at: string
          enabled: boolean
          fpy_threshold: number
          max_critical_defects: number
          min_inspections: number
          min_occurrences: number
          owner_id: string
          updated_at: string
          window_days: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          fpy_threshold?: number
          max_critical_defects?: number
          min_inspections?: number
          min_occurrences?: number
          owner_id: string
          updated_at?: string
          window_days?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          fpy_threshold?: number
          max_critical_defects?: number
          min_inspections?: number
          min_occurrences?: number
          owner_id?: string
          updated_at?: string
          window_days?: number
        }
        Relationships: []
      }
      quality_inspections: {
        Row: {
          aql_level: string | null
          attachments: Json
          created_at: string
          critical_defects: number
          id: string
          inspected_at: string
          inspection_type: string
          inspector: string | null
          lot_size: number | null
          major_defects: number
          minor_defects: number
          notes: string | null
          owner_id: string
          production_order_id: string | null
          prototype_id: string | null
          result: string
          sample_size: number | null
          service_order_id: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          aql_level?: string | null
          attachments?: Json
          created_at?: string
          critical_defects?: number
          id?: string
          inspected_at?: string
          inspection_type?: string
          inspector?: string | null
          lot_size?: number | null
          major_defects?: number
          minor_defects?: number
          notes?: string | null
          owner_id: string
          production_order_id?: string | null
          prototype_id?: string | null
          result?: string
          sample_size?: number | null
          service_order_id?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          aql_level?: string | null
          attachments?: Json
          created_at?: string
          critical_defects?: number
          id?: string
          inspected_at?: string
          inspection_type?: string
          inspector?: string | null
          lot_size?: number | null
          major_defects?: number
          minor_defects?: number
          notes?: string | null
          owner_id?: string
          production_order_id?: string | null
          prototype_id?: string | null
          result?: string
          sample_size?: number | null
          service_order_id?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_inspections_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "prototypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      representatives: {
        Row: {
          active: boolean
          commission_rate: number
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_rate?: number
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_rate?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rfq_quotes: {
        Row: {
          awarded: boolean
          created_at: string
          id: string
          lead_time_days: number | null
          moq: number | null
          notes: string | null
          owner_id: string
          payment_terms: string | null
          rfq_id: string
          supplier_id: string | null
          supplier_name: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          awarded?: boolean
          created_at?: string
          id?: string
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          owner_id: string
          payment_terms?: string | null
          rfq_id: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          awarded?: boolean
          created_at?: string
          id?: string
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          owner_id?: string
          payment_terms?: string | null
          rfq_id?: string
          supplier_id?: string | null
          supplier_name?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_requests: {
        Row: {
          awarded_quote_id: string | null
          code: string
          created_at: string
          id: string
          material_id: string | null
          needed_by: string | null
          notes: string | null
          owner_id: string
          quantity: number
          status: string
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          awarded_quote_id?: string | null
          code: string
          created_at?: string
          id?: string
          material_id?: string | null
          needed_by?: string | null
          notes?: string | null
          owner_id: string
          quantity?: number
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          awarded_quote_id?: string | null
          code?: string
          created_at?: string
          id?: string
          material_id?: string | null
          needed_by?: string | null
          notes?: string | null
          owner_id?: string
          quantity?: number
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_requests_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_library"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          channel: string
          city: string | null
          created_at: string
          id: string
          influencer_id: string | null
          product_id: string | null
          quantity: number
          size: string | null
          sku: string | null
          sold_at: string
          total: number
          uf: string | null
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          city?: string | null
          created_at?: string
          id?: string
          influencer_id?: string | null
          product_id?: string | null
          quantity?: number
          size?: string | null
          sku?: string | null
          sold_at?: string
          total?: number
          uf?: string | null
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          city?: string | null
          created_at?: string
          id?: string
          influencer_id?: string | null
          product_id?: string | null
          quantity?: number
          size?: string | null
          sku?: string | null
          sold_at?: string
          total?: number
          uf?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_messages: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          id: string
          owner_id: string
          ref_id: string | null
          ref_kind: string | null
          reply_to: string | null
          sector: Database["public"]["Enums"]["app_sector"]
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          owner_id: string
          ref_id?: string | null
          ref_kind?: string | null
          reply_to?: string | null
          sector: Database["public"]["Enums"]["app_sector"]
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          ref_id?: string | null
          ref_kind?: string | null
          reply_to?: string | null
          sector?: Database["public"]["Enums"]["app_sector"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "sector_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_grid: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          qty_received: number
          quantity: number
          service_order_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          qty_received?: number
          quantity?: number
          service_order_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          qty_received?: number
          quantity?: number
          service_order_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_grid_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_grid_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          due_at: string | null
          from_stage: string | null
          id: string
          kind: Database["public"]["Enums"]["service_order_kind"]
          line_type: string
          notes: string | null
          owner_id: string
          package_id: string | null
          production_order_id: string
          qty_received: number
          quantity: number
          received_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["service_order_status"]
          supplier_id: string | null
          to_stage: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          from_stage?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["service_order_kind"]
          line_type?: string
          notes?: string | null
          owner_id: string
          package_id?: string | null
          production_order_id: string
          qty_received?: number
          quantity?: number
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          supplier_id?: string | null
          to_stage: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          from_stage?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["service_order_kind"]
          line_type?: string
          notes?: string | null
          owner_id?: string
          package_id?: string | null
          production_order_id?: string
          qty_received?: number
          quantity?: number
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          supplier_id?: string | null
          to_stage?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "production_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          lot_id: string | null
          notes: string | null
          owner_id: string
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_kind: string | null
          supplier_color: string | null
          supplier_lot: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          lot_id?: string | null
          notes?: string | null
          owner_id: string
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_kind?: string | null
          supplier_color?: string | null
          supplier_lot?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_kind?: string | null
          supplier_color?: string | null
          supplier_lot?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_capabilities: {
        Row: {
          capability: string
          created_at: string
          id: string
          monthly_capacity: number | null
          notes: string | null
          owner_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          capability: string
          created_at?: string
          id?: string
          monthly_capacity?: number | null
          notes?: string | null
          owner_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          monthly_capacity?: number | null
          notes?: string | null
          owner_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_capabilities_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_capacity: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          pieces_per_day: number
          supplier_id: string
          updated_at: string
          working_days_per_week: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          pieces_per_day?: number
          supplier_id: string
          updated_at?: string
          working_days_per_week?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pieces_per_day?: number
          supplier_id?: string
          updated_at?: string
          working_days_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_capacity_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_compliance: {
        Row: {
          attachment_url: string | null
          cert_number: string | null
          cert_type: string
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string | null
          issuer: string | null
          notes: string | null
          owner_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          cert_number?: string | null
          cert_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          notes?: string | null
          owner_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          cert_number?: string | null
          cert_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          notes?: string | null
          owner_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_compliance_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_portal_acks: {
        Row: {
          counter_due_date: string | null
          created_at: string
          decision: string
          id: string
          notes: string | null
          owner_id: string
          production_order_id: string
          supplier_id: string
        }
        Insert: {
          counter_due_date?: string | null
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          owner_id: string
          production_order_id: string
          supplier_id: string
        }
        Update: {
          counter_due_date?: string | null
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          owner_id?: string
          production_order_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_portal_acks_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_portal_acks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_portal_attachments: {
        Row: {
          attachment_kind: Database["public"]["Enums"]["attachment_kind"]
          checklist: Json | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          inspection_notes: string | null
          mime: string | null
          notes: string | null
          owner_id: string
          production_order_id: string | null
          rfq_id: string | null
          sample_status:
            | Database["public"]["Enums"]["sample_review_status"]
            | null
          size: number | null
          supplier_id: string
          uploaded_via: string
        }
        Insert: {
          attachment_kind?: Database["public"]["Enums"]["attachment_kind"]
          checklist?: Json | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          inspection_notes?: string | null
          mime?: string | null
          notes?: string | null
          owner_id: string
          production_order_id?: string | null
          rfq_id?: string | null
          sample_status?:
            | Database["public"]["Enums"]["sample_review_status"]
            | null
          size?: number | null
          supplier_id: string
          uploaded_via?: string
        }
        Update: {
          attachment_kind?: Database["public"]["Enums"]["attachment_kind"]
          checklist?: Json | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          inspection_notes?: string | null
          mime?: string | null
          notes?: string | null
          owner_id?: string
          production_order_id?: string | null
          rfq_id?: string | null
          sample_status?:
            | Database["public"]["Enums"]["sample_review_status"]
            | null
          size?: number | null
          supplier_id?: string
          uploaded_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_portal_attachments_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_portal_attachments_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_portal_attachments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_portal_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          owner_id: string
          supplier_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          owner_id: string
          supplier_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          owner_id?: string
          supplier_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_portal_tokens_supplier_id_fkey"
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
          document: string | null
          email: string | null
          erp_id: string | null
          erp_source: string | null
          erp_synced_at: string | null
          id: string
          lead_time_days: number | null
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
          document?: string | null
          email?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          id?: string
          lead_time_days?: number | null
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
          document?: string | null
          email?: string | null
          erp_id?: string | null
          erp_source?: string | null
          erp_synced_at?: string | null
          id?: string
          lead_time_days?: number | null
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
      tech_sheet_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          kind: string | null
          mime_type: string | null
          owner_id: string
          size_bytes: number | null
          tech_sheet_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          kind?: string | null
          mime_type?: string | null
          owner_id: string
          size_bytes?: number | null
          tech_sheet_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          kind?: string | null
          mime_type?: string | null
          owner_id?: string
          size_bytes?: number | null
          tech_sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_sheet_attachments_tech_sheet_id_fkey"
            columns: ["tech_sheet_id"]
            isOneToOne: false
            referencedRelation: "tech_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_sheet_labels: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          owner_id: string
          position: number
          tech_sheet_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind: string
          owner_id: string
          position?: number
          tech_sheet_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          position?: number
          tech_sheet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_sheet_labels_tech_sheet_id_fkey"
            columns: ["tech_sheet_id"]
            isOneToOne: false
            referencedRelation: "tech_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_sheet_materials: {
        Row: {
          consumption: number
          created_at: string
          id: string
          inventory_item_id: string | null
          loss_pct: number
          name: string
          notes: string | null
          owner_id: string
          position: number
          tech_sheet_id: string
          total_cost: number | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          consumption?: number
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          loss_pct?: number
          name: string
          notes?: string | null
          owner_id: string
          position?: number
          tech_sheet_id: string
          total_cost?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          consumption?: number
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          loss_pct?: number
          name?: string
          notes?: string | null
          owner_id?: string
          position?: number
          tech_sheet_id?: string
          total_cost?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_sheet_materials_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_sheet_materials_tech_sheet_id_fkey"
            columns: ["tech_sheet_id"]
            isOneToOne: false
            referencedRelation: "tech_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_sheet_measurements: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          point: string
          position: number
          sizes: Json
          tech_sheet_id: string
          tolerance_minus: number
          tolerance_plus: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          point: string
          position?: number
          sizes?: Json
          tech_sheet_id: string
          tolerance_minus?: number
          tolerance_plus?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          point?: string
          position?: number
          sizes?: Json
          tech_sheet_id?: string
          tolerance_minus?: number
          tolerance_plus?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_sheet_measurements_tech_sheet_id_fkey"
            columns: ["tech_sheet_id"]
            isOneToOne: false
            referencedRelation: "tech_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_sheet_operations: {
        Row: {
          created_at: string
          id: string
          machine: string | null
          name: string
          notes: string | null
          owner_id: string
          position: number
          rate_per_min: number
          responsible_role: string | null
          sam: number
          tech_sheet_id: string
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          machine?: string | null
          name: string
          notes?: string | null
          owner_id: string
          position?: number
          rate_per_min?: number
          responsible_role?: string | null
          sam?: number
          tech_sheet_id: string
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          machine?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          position?: number
          rate_per_min?: number
          responsible_role?: string | null
          sam?: number
          tech_sheet_id?: string
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_sheet_operations_tech_sheet_id_fkey"
            columns: ["tech_sheet_id"]
            isOneToOne: false
            referencedRelation: "tech_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_sheet_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          notes: string | null
          owner_id: string
          snapshot: Json
          tech_sheet_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          owner_id: string
          snapshot: Json
          tech_sheet_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          owner_id?: string
          snapshot?: Json
          tech_sheet_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tech_sheet_versions_tech_sheet_id_fkey"
            columns: ["tech_sheet_id"]
            isOneToOne: false
            referencedRelation: "tech_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_sheets: {
        Row: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          code: string
          content: string | null
          cost_price: number | null
          created_at: string
          id: string
          labor_cost: number
          materials_cost: number
          overhead_pct: number
          owner_id: string
          product_id: string | null
          status: Database["public"]["Enums"]["tech_sheet_status"]
          updated_at: string
          version: string
        }
        Insert: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          code: string
          content?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          labor_cost?: number
          materials_cost?: number
          overhead_pct?: number
          owner_id: string
          product_id?: string | null
          status?: Database["public"]["Enums"]["tech_sheet_status"]
          updated_at?: string
          version?: string
        }
        Update: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          content?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          labor_cost?: number
          materials_cost?: number
          overhead_pct?: number
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
      user_sectors: {
        Row: {
          created_at: string
          id: string
          sector: Database["public"]["Enums"]["app_sector"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sector: Database["public"]["Enums"]["app_sector"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sector?: Database["public"]["Enums"]["app_sector"]
          user_id?: string
        }
        Relationships: []
      }
      user_view_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_favorite: boolean
          module: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_favorite?: boolean
          module: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_favorite?: boolean
          module?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_supplier_wip: {
        Row: {
          distinct_refs: number | null
          max_days_at_supplier: number | null
          oldest_sent_at: string | null
          open_lot_count: number | null
          open_os_count: number | null
          owner_id: string | null
          pieces_at_supplier: number | null
          supplier_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sector: {
        Args: {
          _sector: Database["public"]["Enums"]["app_sector"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _payload?: Json
        }
        Returns: string
      }
    }
    Enums: {
      account_status: "pendente" | "pago" | "atrasado" | "cancelado"
      account_type: "pagar" | "receber"
      ai_agent_status: "ativo" | "pausado" | "erro"
      app_role: "admin" | "gerente" | "designer" | "comprador" | "vendedor"
      app_sector: "marketing" | "pcp" | "desenvolvimento"
      attachment_kind: "sample" | "photo" | "document" | "invoice" | "other"
      b2b_order_status:
        | "rascunho"
        | "aprovado"
        | "em_producao"
        | "faturado"
        | "cancelado"
      campaign_status: "programada" | "ativa" | "pausada" | "concluida"
      collection_product_role:
        | "hero"
        | "carry_over"
        | "nos"
        | "capsule"
        | "regular"
      collection_status:
        | "briefing"
        | "design"
        | "aprovacao"
        | "desenvolvimento"
        | "producao"
        | "entregue"
        | "lancamento"
        | "markdown"
        | "descontinuada"
      inventory_category: "tecido" | "aviamento" | "acabado" | "outros"
      product_lifecycle_state:
        | "planned"
        | "active"
        | "markdown"
        | "discontinued"
        | "nos_permanent"
      product_status:
        | "rascunho"
        | "desenvolvimento"
        | "aprovado"
        | "producao"
        | "descontinuado"
      production_batch_status:
        | "planejado"
        | "em_producao"
        | "finalizado"
        | "cancelado"
      production_stage:
        | "cad"
        | "corte"
        | "costura"
        | "acabamento"
        | "qualidade"
        | "expedicao"
        | "entregue"
      production_status:
        | "aguardando"
        | "em_producao"
        | "concluida"
        | "atrasada"
        | "cancelada"
      prototype_gate_key:
        | "conceito"
        | "modelagem"
        | "ficha"
        | "piloto"
        | "aprovacao"
      prototype_gate_status: "pendente" | "aprovado" | "reprovado"
      prototype_stage:
        | "solicitado"
        | "em_confeccao"
        | "em_prova"
        | "aprovado"
        | "reprovado"
      purchase_order_status:
        | "rascunho"
        | "cotando"
        | "aprovado"
        | "recebido"
        | "cancelado"
      sales_channel:
        | "ecommerce"
        | "varejo_proprio"
        | "multimarcas"
        | "franquia"
        | "outlet"
      sample_review_status:
        | "pending_review"
        | "approved"
        | "needs_adjustment"
        | "received"
        | "rejected"
      service_order_kind: "parcial" | "integral"
      service_order_status:
        | "aberta"
        | "enviada"
        | "em_andamento"
        | "recebida"
        | "cancelada"
      stock_movement_type: "entrada" | "saida" | "ajuste" | "transferencia"
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
      app_sector: ["marketing", "pcp", "desenvolvimento"],
      attachment_kind: ["sample", "photo", "document", "invoice", "other"],
      b2b_order_status: [
        "rascunho",
        "aprovado",
        "em_producao",
        "faturado",
        "cancelado",
      ],
      campaign_status: ["programada", "ativa", "pausada", "concluida"],
      collection_product_role: [
        "hero",
        "carry_over",
        "nos",
        "capsule",
        "regular",
      ],
      collection_status: [
        "briefing",
        "design",
        "aprovacao",
        "desenvolvimento",
        "producao",
        "entregue",
        "lancamento",
        "markdown",
        "descontinuada",
      ],
      inventory_category: ["tecido", "aviamento", "acabado", "outros"],
      product_lifecycle_state: [
        "planned",
        "active",
        "markdown",
        "discontinued",
        "nos_permanent",
      ],
      product_status: [
        "rascunho",
        "desenvolvimento",
        "aprovado",
        "producao",
        "descontinuado",
      ],
      production_batch_status: [
        "planejado",
        "em_producao",
        "finalizado",
        "cancelado",
      ],
      production_stage: [
        "cad",
        "corte",
        "costura",
        "acabamento",
        "qualidade",
        "expedicao",
        "entregue",
      ],
      production_status: [
        "aguardando",
        "em_producao",
        "concluida",
        "atrasada",
        "cancelada",
      ],
      prototype_gate_key: [
        "conceito",
        "modelagem",
        "ficha",
        "piloto",
        "aprovacao",
      ],
      prototype_gate_status: ["pendente", "aprovado", "reprovado"],
      prototype_stage: [
        "solicitado",
        "em_confeccao",
        "em_prova",
        "aprovado",
        "reprovado",
      ],
      purchase_order_status: [
        "rascunho",
        "cotando",
        "aprovado",
        "recebido",
        "cancelado",
      ],
      sales_channel: [
        "ecommerce",
        "varejo_proprio",
        "multimarcas",
        "franquia",
        "outlet",
      ],
      sample_review_status: [
        "pending_review",
        "approved",
        "needs_adjustment",
        "received",
        "rejected",
      ],
      service_order_kind: ["parcial", "integral"],
      service_order_status: [
        "aberta",
        "enviada",
        "em_andamento",
        "recebida",
        "cancelada",
      ],
      stock_movement_type: ["entrada", "saida", "ajuste", "transferencia"],
      tech_sheet_status: ["rascunho", "em_revisao", "aprovada"],
    },
  },
} as const

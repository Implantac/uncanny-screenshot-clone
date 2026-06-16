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
      customers: {
        Row: {
          city: string | null
          created_at: string
          document: string | null
          email: string | null
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
          product_id: string | null
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
          product_id?: string | null
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
          product_id?: string | null
          sku?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_product_id_fkey"
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
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          planned_qty: number
          produced_qty: number
          start_date: string | null
          status: Database["public"]["Enums"]["production_batch_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          planned_qty?: number
          produced_qty?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_batch_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          planned_qty?: number
          produced_qty?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_batch_status"]
          updated_at?: string
        }
        Relationships: []
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
          grade: string | null
          id: string
          image_url: string | null
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
          grade?: string | null
          id?: string
          image_url?: string | null
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
          grade?: string | null
          id?: string
          image_url?: string | null
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
          due_at: string | null
          from_stage: string | null
          id: string
          kind: Database["public"]["Enums"]["service_order_kind"]
          notes: string | null
          owner_id: string
          production_order_id: string
          qty_received: number
          quantity: number
          received_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["service_order_status"]
          supplier_id: string | null
          to_stage: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          due_at?: string | null
          from_stage?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["service_order_kind"]
          notes?: string | null
          owner_id: string
          production_order_id: string
          qty_received?: number
          quantity?: number
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          supplier_id?: string | null
          to_stage: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          due_at?: string | null
          from_stage?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["service_order_kind"]
          notes?: string | null
          owner_id?: string
          production_order_id?: string
          qty_received?: number
          quantity?: number
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["service_order_status"]
          supplier_id?: string | null
          to_stage?: string
          updated_at?: string
        }
        Relationships: [
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
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          owner_id: string
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_kind: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_kind?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_kind?: string | null
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
      tech_sheets: {
        Row: {
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

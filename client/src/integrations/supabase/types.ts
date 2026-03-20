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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accident_files: {
        Row: {
          accident_id: string
          created_at: string
          description: string | null
          file_category: string
          file_name: string
          file_type: string
          id: string
          organization_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          accident_id: string
          created_at?: string
          description?: string | null
          file_category?: string
          file_name: string
          file_type?: string
          id?: string
          organization_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          accident_id?: string
          created_at?: string
          description?: string | null
          file_category?: string
          file_name?: string
          file_type?: string
          id?: string
          organization_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accident_files_accident_id_fkey"
            columns: ["accident_id"]
            isOneToOne: false
            referencedRelation: "accidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accident_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accident_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accidents: {
        Row: {
          accident_date: string
          accident_number: string | null
          claim_number: string | null
          created_at: string | null
          description: string
          estimated_cost: number | null
          fault_assessment: string | null
          has_injuries: boolean | null
          id: string
          insurance_claim_number: string | null
          insurance_coverage: number | null
          linked_repair_id: string | null
          location: string | null
          notes: string | null
          organization_id: string
          police_report_number: string | null
          reported_by: string | null
          severity: string | null
          status: string | null
          third_party_insurance: string | null
          third_party_name: string | null
          third_party_phone: string | null
          third_party_plate: string | null
          third_party_policy_number: string | null
          third_party_vehicle: string | null
          vehicle_id: string | null
        }
        Insert: {
          accident_date: string
          accident_number?: string | null
          claim_number?: string | null
          created_at?: string | null
          description: string
          estimated_cost?: number | null
          fault_assessment?: string | null
          has_injuries?: boolean | null
          id?: string
          insurance_claim_number?: string | null
          insurance_coverage?: number | null
          linked_repair_id?: string | null
          location?: string | null
          notes?: string | null
          organization_id: string
          police_report_number?: string | null
          reported_by?: string | null
          severity?: string | null
          status?: string | null
          third_party_insurance?: string | null
          third_party_name?: string | null
          third_party_phone?: string | null
          third_party_plate?: string | null
          third_party_policy_number?: string | null
          third_party_vehicle?: string | null
          vehicle_id?: string | null
        }
        Update: {
          accident_date?: string
          accident_number?: string | null
          claim_number?: string | null
          created_at?: string | null
          description?: string
          estimated_cost?: number | null
          fault_assessment?: string | null
          has_injuries?: boolean | null
          id?: string
          insurance_claim_number?: string | null
          insurance_coverage?: number | null
          linked_repair_id?: string | null
          location?: string | null
          notes?: string | null
          organization_id?: string
          police_report_number?: string | null
          reported_by?: string | null
          severity?: string | null
          status?: string | null
          third_party_insurance?: string | null
          third_party_name?: string | null
          third_party_phone?: string | null
          third_party_plate?: string | null
          third_party_policy_number?: string | null
          third_party_vehicle?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accidents_linked_repair_id_fkey"
            columns: ["linked_repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      area_access_rules: {
        Row: {
          area_id: string
          created_at: string
          id: string
          organization_id: string
          permission: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          organization_id: string
          permission?: string
          subject_id: string
          subject_type: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          permission?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_access_rules_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_access_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string
          visibility: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          organization_id: string
          visibility?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata_json: Json | null
          organization_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata_json?: Json | null
          organization_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata_json?: Json | null
          organization_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions_json: Json
          conditions_json: Json
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          throttle_minutes: number
          trigger_type: string
        }
        Insert: {
          actions_json?: Json
          conditions_json?: Json
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          throttle_minutes?: number
          trigger_type: string
        }
        Update: {
          actions_json?: Json
          conditions_json?: Json
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          throttle_minutes?: number
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          message: string | null
          organization_id: string
          rule_id: string
          status: string
          trigger_type: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          message?: string | null
          organization_id: string
          rule_id: string
          status?: string
          trigger_type: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          message?: string | null
          organization_id?: string
          rule_id?: string
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_throttle: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_run_at: string
          organization_id: string
          rule_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          last_run_at?: string
          organization_id: string
          rule_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_run_at?: string
          organization_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_throttle_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_throttle_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string | null
          payload_json: Json
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id?: string | null
          payload_json?: Json
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string | null
          payload_json?: Json
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_products: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          metadata_json: Json
          name: string
          stripe_price: string | null
          stripe_price_annual: string | null
          stripe_price_monthly: string | null
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata_json?: Json
          name: string
          stripe_price?: string | null
          stripe_price_annual?: string | null
          stripe_price_monthly?: string | null
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata_json?: Json
          name?: string
          stripe_price?: string | null
          stripe_price_annual?: string | null
          stripe_price_monthly?: string | null
          type?: string
        }
        Relationships: []
      }
      billing_products_public: {
        Row: {
          code: string
          created_at: string | null
          currency: string | null
          display_price_annual: number | null
          display_price_monthly: number | null
          highlight_features_json: Json | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          type: string
        }
        Insert: {
          code: string
          created_at?: string | null
          currency?: string | null
          display_price_annual?: number | null
          display_price_monthly?: number | null
          highlight_features_json?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          type: string
        }
        Update: {
          code?: string
          created_at?: string | null
          currency?: string | null
          display_price_annual?: number | null
          display_price_monthly?: number | null
          highlight_features_json?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          type?: string
        }
        Relationships: []
      }
      broker_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          identifier: string
          submission_count: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identifier: string
          submission_count?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identifier?: string
          submission_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      broker_registration_incidents: {
        Row: {
          created_at: string | null
          email: string
          error_message: string | null
          id: string
          incident_type: string
          organization_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          incident_type: string
          organization_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          incident_type?: string
          organization_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_registration_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_registration_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_registration_requests: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          organization_id: string
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_registration_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_registration_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          organization_id: string
          redeemed_at: string
          status: string
          stripe_promo_code_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          organization_id: string
          redeemed_at?: string
          status?: string
          stripe_promo_code_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          organization_id?: string
          redeemed_at?: string
          status?: string
          stripe_promo_code_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_products_json: Json
          code: string
          created_at: string
          currency: string | null
          description: string
          discount_type: string
          discount_value: number
          duration: string
          duration_months: number | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          redeem_by: string | null
          stripe_coupon_id: string | null
        }
        Insert: {
          applicable_products_json?: Json
          code: string
          created_at?: string
          currency?: string | null
          description?: string
          discount_type: string
          discount_value: number
          duration?: string
          duration_months?: number | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redeem_by?: string | null
          stripe_coupon_id?: string | null
        }
        Update: {
          applicable_products_json?: Json
          code?: string
          created_at?: string
          currency?: string | null
          description?: string
          discount_type?: string
          discount_value?: number
          duration?: string
          duration_months?: number | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redeem_by?: string | null
          stripe_coupon_id?: string | null
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string
          permissions_json: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          permissions_json?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          permissions_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_task_completions: {
        Row: {
          completed_at: string
          completed_by: string
          completion_date: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          template_id: string
        }
        Insert: {
          completed_at?: string
          completed_by: string
          completion_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          template_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string
          completion_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_task_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_completions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_completions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "daily_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_task_templates: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          organization_id: string
          title: string
          updated_at: string
          weekdays: number[] | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          title: string
          updated_at?: string
          weekdays?: number[] | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          title?: string
          updated_at?: string
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_task_templates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_catalog: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name_en: string | null
          name_es: string
          organization_id: string
          position: number | null
          price_level_1: number | null
          price_level_2: number | null
          price_level_3: number | null
          price_level_4: number | null
          price_level_5: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string | null
          name_es: string
          organization_id: string
          position?: number | null
          price_level_1?: number | null
          price_level_2?: number | null
          price_level_3?: number | null
          price_level_4?: number | null
          price_level_5?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string | null
          name_es?: string
          organization_id?: string
          position?: number | null
          price_level_1?: number | null
          price_level_2?: number | null
          price_level_3?: number | null
          price_level_4?: number | null
          price_level_5?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_catalog_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_report_items: {
        Row: {
          catalog_item_id: string | null
          created_at: string | null
          custom_description: string | null
          id: string
          location_on_vehicle: string | null
          notes: string | null
          photo_urls: string[] | null
          quantity: number | null
          report_id: string
          severity_level: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string | null
          custom_description?: string | null
          id?: string
          location_on_vehicle?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          quantity?: number | null
          report_id: string
          severity_level?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string | null
          custom_description?: string | null
          id?: string
          location_on_vehicle?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          quantity?: number | null
          report_id?: string
          severity_level?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "damage_report_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "damage_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "damage_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_reports: {
        Row: {
          amount_collected: number | null
          collected_at: string | null
          collection_notes: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string | null
          customer_document: string | null
          customer_name: string | null
          damage_date: string
          document_type: string | null
          external_reservation_number: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_gateway: string | null
          payment_reference: string | null
          pdf_url: string | null
          report_number: string
          reported_by: string | null
          reservation_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          vehicle_brand: string | null
          vehicle_id: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
        }
        Insert: {
          amount_collected?: number | null
          collected_at?: string | null
          collection_notes?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          customer_document?: string | null
          customer_name?: string | null
          damage_date: string
          document_type?: string | null
          external_reservation_number?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_gateway?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          report_number: string
          reported_by?: string | null
          reservation_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          vehicle_brand?: string | null
          vehicle_id?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          amount_collected?: number | null
          collected_at?: string | null
          collection_notes?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          customer_document?: string | null
          customer_name?: string | null
          damage_date?: string
          document_type?: string | null
          external_reservation_number?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_gateway?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          report_number?: string
          reported_by?: string | null
          reservation_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          vehicle_brand?: string | null
          vehicle_id?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      dropdown_options: {
        Row: {
          color: string
          created_at: string
          field_name: string
          icon: string | null
          id: string
          is_default: boolean
          label: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          field_name: string
          icon?: string | null
          id?: string
          is_default?: boolean
          label: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          field_name?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          label?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dropdown_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          name: string
          organization_id: string | null
          plan: string | null
          rollout_percentage: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          name: string
          organization_id?: string | null
          plan?: string | null
          rollout_percentage?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          organization_id?: string | null
          plan?: string | null
          rollout_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_inspection_damages: {
        Row: {
          descripcion: string | null
          id: string
          inspection_id: string
          organization_id: string
          pieza: string | null
          severidad: string | null
          zona: string
        }
        Insert: {
          descripcion?: string | null
          id?: string
          inspection_id: string
          organization_id: string
          pieza?: string | null
          severidad?: string | null
          zona: string
        }
        Update: {
          descripcion?: string | null
          id?: string
          inspection_id?: string
          organization_id?: string
          pieza?: string | null
          severidad?: string | null
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_inspection_damages_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_inspection_damages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_inspection_photos: {
        Row: {
          created_at: string
          damage_id: string | null
          description: string | null
          file_name: string
          id: string
          inspection_id: string
          organization_id: string
          photo_category: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          damage_id?: string | null
          description?: string | null
          file_name: string
          id?: string
          inspection_id: string
          organization_id: string
          photo_category?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          damage_id?: string | null
          description?: string | null
          file_name?: string
          id?: string
          inspection_id?: string
          organization_id?: string
          photo_category?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_inspection_photos_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "fleet_inspection_damages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_inspection_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_inspection_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicle_damages: {
        Row: {
          created_at: string | null
          croquis_x: number | null
          croquis_y: number | null
          damage_report_id: string | null
          descripcion: string | null
          fleet_vehicle_id: string
          has_premium_coverage: boolean | null
          id: string
          organization_id: string
          origin_type: string
          photo_url: string | null
          pieza: string | null
          repair_id: string | null
          reported_by: string | null
          reservation_id: string | null
          resolved_at: string | null
          severidad: string | null
          status: string | null
          zona: string
        }
        Insert: {
          created_at?: string | null
          croquis_x?: number | null
          croquis_y?: number | null
          damage_report_id?: string | null
          descripcion?: string | null
          fleet_vehicle_id: string
          has_premium_coverage?: boolean | null
          id?: string
          organization_id: string
          origin_type?: string
          photo_url?: string | null
          pieza?: string | null
          repair_id?: string | null
          reported_by?: string | null
          reservation_id?: string | null
          resolved_at?: string | null
          severidad?: string | null
          status?: string | null
          zona: string
        }
        Update: {
          created_at?: string | null
          croquis_x?: number | null
          croquis_y?: number | null
          damage_report_id?: string | null
          descripcion?: string | null
          fleet_vehicle_id?: string
          has_premium_coverage?: boolean | null
          id?: string
          organization_id?: string
          origin_type?: string
          photo_url?: string | null
          pieza?: string | null
          repair_id?: string | null
          reported_by?: string | null
          reservation_id?: string | null
          resolved_at?: string | null
          severidad?: string | null
          status?: string | null
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicle_damages_damage_report_id_fkey"
            columns: ["damage_report_id"]
            isOneToOne: false
            referencedRelation: "damage_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_damages_fleet_vehicle_id_fkey"
            columns: ["fleet_vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_damages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_damages_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_damages_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_damages_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_damages_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_operational"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicle_inspections: {
        Row: {
          created_at: string
          fleet_vehicle_id: string
          id: string
          inspection_date: string
          inspection_type: string
          inspector_id: string | null
          km: number | null
          nivel_combustible: string | null
          notas: string | null
          organization_id: string
          receipt_url: string | null
        }
        Insert: {
          created_at?: string
          fleet_vehicle_id: string
          id?: string
          inspection_date?: string
          inspection_type?: string
          inspector_id?: string | null
          km?: number | null
          nivel_combustible?: string | null
          notas?: string | null
          organization_id: string
          receipt_url?: string | null
        }
        Update: {
          created_at?: string
          fleet_vehicle_id?: string
          id?: string
          inspection_date?: string
          inspection_type?: string
          inspector_id?: string | null
          km?: number | null
          nivel_combustible?: string | null
          notas?: string | null
          organization_id?: string
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicle_inspections_fleet_vehicle_id_fkey"
            columns: ["fleet_vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          categoria: string | null
          color: string | null
          combustible: string | null
          created_at: string
          cv: number | null
          fecha_fin_contrato: string | null
          fecha_inicio_contrato: string | null
          hibrido: boolean | null
          id: string
          km_devolucion: number | null
          km_recogida: number | null
          marca: string | null
          matricula: string
          modelo: string | null
          motor: string | null
          notas: string | null
          numero_bastidor: string | null
          numero_contrato: string | null
          organization_id: string
          photo_url: string | null
          proveedor: string | null
          status: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          color?: string | null
          combustible?: string | null
          created_at?: string
          cv?: number | null
          fecha_fin_contrato?: string | null
          fecha_inicio_contrato?: string | null
          hibrido?: boolean | null
          id?: string
          km_devolucion?: number | null
          km_recogida?: number | null
          marca?: string | null
          matricula: string
          modelo?: string | null
          motor?: string | null
          notas?: string | null
          numero_bastidor?: string | null
          numero_contrato?: string | null
          organization_id: string
          photo_url?: string | null
          proveedor?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          color?: string | null
          combustible?: string | null
          created_at?: string
          cv?: number | null
          fecha_fin_contrato?: string | null
          fecha_inicio_contrato?: string | null
          hibrido?: boolean | null
          id?: string
          km_devolucion?: number | null
          km_recogida?: number | null
          marca?: string | null
          matricula?: string
          modelo?: string | null
          motor?: string | null
          notas?: string | null
          numero_bastidor?: string | null
          numero_contrato?: string | null
          organization_id?: string
          photo_url?: string | null
          proveedor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          conditions: Json | null
          created_at: string
          default_value: string | null
          form_id: string
          help_text: string | null
          id: string
          is_required: boolean
          label: string
          maps_to_task_field: string | null
          maps_to_transfer_field: string | null
          max_length: number | null
          max_value: number | null
          min_length: number | null
          min_value: number | null
          name: string
          options: Json | null
          pattern: string | null
          placeholder: string | null
          position: number
          type: string
          width: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          default_value?: string | null
          form_id: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          maps_to_task_field?: string | null
          maps_to_transfer_field?: string | null
          max_length?: number | null
          max_value?: number | null
          min_length?: number | null
          min_value?: number | null
          name: string
          options?: Json | null
          pattern?: string | null
          placeholder?: string | null
          position?: number
          type?: string
          width?: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          default_value?: string | null
          form_id?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          maps_to_task_field?: string | null
          maps_to_transfer_field?: string | null
          max_length?: number | null
          max_value?: number | null
          min_length?: number | null
          min_value?: number | null
          name?: string
          options?: Json | null
          pattern?: string | null
          placeholder?: string | null
          position?: number
          type?: string
          width?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          created_at: string
          created_task_id: string | null
          created_transfer_request_id: string | null
          data: Json
          form_id: string
          id: string
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          submitter_email: string | null
          submitter_ip: string | null
          submitter_name: string | null
        }
        Insert: {
          created_at?: string
          created_task_id?: string | null
          created_transfer_request_id?: string | null
          data?: Json
          form_id: string
          id?: string
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          submitter_email?: string | null
          submitter_ip?: string | null
          submitter_name?: string | null
        }
        Update: {
          created_at?: string
          created_task_id?: string | null
          created_transfer_request_id?: string | null
          data?: Json
          form_id?: string
          id?: string
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          submitter_email?: string | null
          submitter_ip?: string | null
          submitter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_created_task_id_fkey"
            columns: ["created_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_created_transfer_request_id_fkey"
            columns: ["created_transfer_request_id"]
            isOneToOne: false
            referencedRelation: "transfer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          create_task_on_submit: boolean
          created_at: string
          created_by: string
          custom_logo_url: string | null
          default_area_id: string | null
          default_assignee_id: string | null
          default_task_priority: string
          default_task_type: string
          description: string | null
          entity_type: string
          expires_at: string | null
          id: string
          is_active: boolean
          is_public: boolean
          max_responses: number | null
          name: string
          organization_id: string
          primary_color: string | null
          redirect_url: string | null
          requires_auth: boolean
          response_count: number
          slug: string
          success_message: string | null
          updated_at: string
        }
        Insert: {
          create_task_on_submit?: boolean
          created_at?: string
          created_by: string
          custom_logo_url?: string | null
          default_area_id?: string | null
          default_assignee_id?: string | null
          default_task_priority?: string
          default_task_type?: string
          description?: string | null
          entity_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_responses?: number | null
          name: string
          organization_id: string
          primary_color?: string | null
          redirect_url?: string | null
          requires_auth?: boolean
          response_count?: number
          slug: string
          success_message?: string | null
          updated_at?: string
        }
        Update: {
          create_task_on_submit?: boolean
          created_at?: string
          created_by?: string
          custom_logo_url?: string | null
          default_area_id?: string | null
          default_assignee_id?: string | null
          default_task_priority?: string
          default_task_type?: string
          description?: string | null
          entity_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_responses?: number | null
          name?: string
          organization_id?: string
          primary_color?: string | null
          redirect_url?: string | null
          requires_auth?: boolean
          response_count?: number
          slug?: string
          success_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_default_area_id_fkey"
            columns: ["default_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          ai_base_url: string | null
          ai_model: string | null
          ai_provider: string | null
          created_at: string
          email_from_address: string | null
          email_from_name: string | null
          id: string
          openai_api_key: string | null
          organization_id: string
          rently_api_host: string | null
          rently_client_id: string | null
          rently_client_secret: string | null
          reservations_archive_days: number | null
          slack_webhook_url: string | null
          whatsapp_access_token: string | null
          whatsapp_business_account_id: string | null
          whatsapp_phone_number_id: string | null
        }
        Insert: {
          ai_base_url?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          openai_api_key?: string | null
          organization_id: string
          rently_api_host?: string | null
          rently_client_id?: string | null
          rently_client_secret?: string | null
          reservations_archive_days?: number | null
          slack_webhook_url?: string | null
          whatsapp_access_token?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Update: {
          ai_base_url?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          openai_api_key?: string | null
          organization_id?: string
          rently_api_host?: string | null
          rently_client_id?: string | null
          rently_client_secret?: string | null
          reservations_archive_days?: number | null
          slack_webhook_url?: string | null
          whatsapp_access_token?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string
          created_at: string
          id: string
          is_visible: boolean
          label: string
          organization_id: string
          sort_order: number
          status: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          label: string
          organization_id: string
          sort_order?: number
          status: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          label?: string
          organization_id?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_rate_limits: {
        Row: {
          created_at: string
          id: string
          identifier: string
          submission_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          submission_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          submission_count?: number
          window_start?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          referral_code: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          referral_code?: string | null
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          referral_code?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          channel_email: boolean
          channel_in_app: boolean
          channel_push: boolean
          channel_slack: boolean
          channel_whatsapp: boolean
          created_at: string
          events_json: Json
          id: string
          organization_id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string | null
          user_id: string
        }
        Insert: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_push?: boolean
          channel_slack?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          events_json?: Json
          id?: string
          organization_id: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          user_id: string
        }
        Update: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_push?: boolean
          channel_slack?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          events_json?: Json
          id?: string
          organization_id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_read: boolean
          organization_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_read?: boolean
          organization_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_read?: boolean
          organization_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_legs: {
        Row: {
          assignee_id: string | null
          checklist_json: Json | null
          completed_at: string | null
          created_at: string
          id: string
          leg_type: string
          notes: string | null
          organization_id: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          task_id: string
        }
        Insert: {
          assignee_id?: string | null
          checklist_json?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          leg_type?: string
          notes?: string | null
          organization_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          task_id: string
        }
        Update: {
          assignee_id?: string | null
          checklist_json?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          leg_type?: string
          notes?: string | null
          organization_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_legs_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_legs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_legs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      org_security_settings: {
        Row: {
          allowed_domains: string[] | null
          audit_retention_days: number
          block_api_keys: boolean
          block_exports: boolean
          block_public_sharing: boolean
          block_webhooks: boolean
          created_at: string
          id: string
          ip_allowlist: string[] | null
          mfa_required: boolean
          organization_id: string
          require_sso: boolean
          session_timeout_minutes: number
        }
        Insert: {
          allowed_domains?: string[] | null
          audit_retention_days?: number
          block_api_keys?: boolean
          block_exports?: boolean
          block_public_sharing?: boolean
          block_webhooks?: boolean
          created_at?: string
          id?: string
          ip_allowlist?: string[] | null
          mfa_required?: boolean
          organization_id: string
          require_sso?: boolean
          session_timeout_minutes?: number
        }
        Update: {
          allowed_domains?: string[] | null
          audit_retention_days?: number
          block_api_keys?: boolean
          block_exports?: boolean
          block_public_sharing?: boolean
          block_webhooks?: boolean
          created_at?: string
          id?: string
          ip_allowlist?: string[] | null
          mfa_required?: boolean
          organization_id?: string
          require_sso?: boolean
          session_timeout_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_security_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted: boolean
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token_hash: string
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          created_at: string
          enabled: boolean
          enabled_at: string | null
          enabled_by: string | null
          id: string
          module_key: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          module_key: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          module_key?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          status: string | null
          vertical_preset: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          status?: string | null
          vertical_preset?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          status?: string | null
          vertical_preset?: string | null
        }
        Relationships: []
      }
      outbound_notifications: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          payload: Json
          source_notification_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          payload?: Json
          source_notification_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          source_notification_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_notifications_source_notification_id_fkey"
            columns: ["source_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          theme_pref: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          theme_pref?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          theme_pref?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provisioning_logs: {
        Row: {
          action: string
          created_at: string
          external_id: string | null
          id: string
          message: string
          metadata_json: Json | null
          organization_id: string
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          external_id?: string | null
          id?: string
          message: string
          metadata_json?: Json | null
          organization_id: string
          source: string
          status: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          external_id?: string | null
          id?: string
          message?: string
          metadata_json?: Json | null
          organization_id?: string
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          organization_id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          organization_id: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_events: {
        Row: {
          code: string
          created_at: string
          email: string | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          clicks: number
          code: string
          conversions: number
          created_at: string
          id: string
          referrer_user_id: string
          reward_status: string
          signups: number
        }
        Insert: {
          clicks?: number
          code: string
          conversions?: number
          created_at?: string
          id?: string
          referrer_user_id: string
          reward_status?: string
          signups?: number
        }
        Update: {
          clicks?: number
          code?: string
          conversions?: number
          created_at?: string
          id?: string
          referrer_user_id?: string
          reward_status?: string
          signups?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          recurrence_interval: number | null
          recurrence_type: string
          remind_at: string
          task_id: string
          timezone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          recurrence_interval?: number | null
          recurrence_type?: string
          remind_at: string
          task_id: string
          timezone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          recurrence_interval?: number | null
          recurrence_type?: string
          remind_at?: string
          task_id?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rently_sync_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          last_offset: number | null
          organization_id: string
          started_at: string | null
          status: string | null
          total_duplicates: number | null
          total_fetched: number | null
          total_filtered: number | null
          total_inserted: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_offset?: number | null
          organization_id: string
          started_at?: string | null
          status?: string | null
          total_duplicates?: number | null
          total_fetched?: number | null
          total_filtered?: number | null
          total_inserted?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_offset?: number | null
          organization_id?: string
          started_at?: string | null
          status?: string | null
          total_duplicates?: number | null
          total_fetched?: number | null
          total_filtered?: number | null
          total_inserted?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rently_sync_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_comments: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          repair_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          repair_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          repair_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_comments_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_history: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          metadata: Json | null
          organization_id: string
          repair_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          repair_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          repair_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_history_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_invoice_items: {
        Row: {
          category: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "repair_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_invoices: {
        Row: {
          created_at: string
          currency: string | null
          file_name: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          ocr_raw_data: Json | null
          ocr_status: string | null
          organization_id: string
          repair_id: string
          storage_path: string | null
          subtotal_amount: number | null
          supplier_name: string | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          file_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          ocr_raw_data?: Json | null
          ocr_status?: string | null
          organization_id: string
          repair_id: string
          storage_path?: string | null
          subtotal_amount?: number | null
          supplier_name?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          file_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          ocr_raw_data?: Json | null
          ocr_status?: string | null
          organization_id?: string
          repair_id?: string
          storage_path?: string | null
          subtotal_amount?: number | null
          supplier_name?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_invoices_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_photos: {
        Row: {
          created_at: string
          description: string | null
          file_name: string | null
          id: string
          organization_id: string
          photo_type: string
          repair_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          id?: string
          organization_id: string
          photo_type: string
          repair_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          id?: string
          organization_id?: string
          photo_type?: string
          repair_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_photos_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          completed_at: string | null
          cost_estimate: number | null
          cost_final: number | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          km_at_repair: number | null
          notes: string | null
          organization_id: string
          repair_number: string | null
          repair_type: string
          scheduled_date: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
          vehicle_id: string | null
          workshop_id: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_estimate?: number | null
          cost_final?: number | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          km_at_repair?: number | null
          notes?: string | null
          organization_id: string
          repair_number?: string | null
          repair_type: string
          scheduled_date?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          workshop_id?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_estimate?: number | null
          cost_final?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          km_at_repair?: number | null
          notes?: string | null
          organization_id?: string
          repair_number?: string | null
          repair_type?: string
          scheduled_date?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repairs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          created_at: string
          date_key: string
          id: string
          metrics_json: Json
          organization_id: string
          period: string
          scope: string
          scope_id: string | null
        }
        Insert: {
          created_at?: string
          date_key: string
          id?: string
          metrics_json?: Json
          organization_id: string
          period: string
          scope: string
          scope_id?: string | null
        }
        Update: {
          created_at?: string
          date_key?: string
          id?: string
          metrics_json?: Json
          organization_id?: string
          period?: string
          scope?: string
          scope_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          a_pedido: string | null
          acuerdo_comercial: string | null
          acuerdo_precios: string | null
          archived_at: string | null
          asignado_escoba_devolucion_id: string | null
          asignado_escoba_devolucion_team_id: string | null
          asignado_escoba_entrega_id: string | null
          asignado_escoba_entrega_team_id: string | null
          asignado_escoba_id: string | null
          asignado_escoba_team_id: string | null
          asignado_rental_devolucion_id: string | null
          asignado_rental_devolucion_team_id: string | null
          asignado_rental_entrega_id: string | null
          asignado_rental_entrega_team_id: string | null
          asignado_rental_id: string | null
          asignado_rental_team_id: string | null
          auto: string | null
          categoria: string | null
          checkin: string | null
          checkin_devolucion: string | null
          checkin_entrega: string | null
          cliente_apellido: string | null
          cliente_nombre: string | null
          codigo: string | null
          contacto: string | null
          contacto_devolucion: string | null
          contacto_entrega: string | null
          creado_por: string | null
          created_at: string
          desde: string | null
          devolucion: string | null
          devolucion_completada: boolean
          documento_cliente: string | null
          duracion: string | null
          email: string | null
          entrega_completada: boolean
          estado: string | null
          estado_devolucion: string | null
          estado_entrega: string | null
          estado_terminada_at: string | null
          external_reservation_id: string
          fecha_creacion: string | null
          hasta: string | null
          hosp: string | null
          hosp_devolucion: string | null
          hosp_entrega: string | null
          id: string
          imported_at: string
          imported_by: string | null
          lugar_devolucion: string | null
          lugar_entrega: string | null
          lugar_operacion: string | null
          modelo: string | null
          notas: string | null
          notas_devolucion: string | null
          notas_entrega: string | null
          organization_id: string
          origen_reserva: string | null
          pagado: string | null
          pagado_devolucion: string | null
          pagado_entrega: string | null
          precio: number | null
          tarifa: string | null
          telefono: string | null
          tipo_actividad: string | null
          tipo_documento_cliente: string | null
          transfer_completado: boolean
          updated_at: string
        }
        Insert: {
          a_pedido?: string | null
          acuerdo_comercial?: string | null
          acuerdo_precios?: string | null
          archived_at?: string | null
          asignado_escoba_devolucion_id?: string | null
          asignado_escoba_devolucion_team_id?: string | null
          asignado_escoba_entrega_id?: string | null
          asignado_escoba_entrega_team_id?: string | null
          asignado_escoba_id?: string | null
          asignado_escoba_team_id?: string | null
          asignado_rental_devolucion_id?: string | null
          asignado_rental_devolucion_team_id?: string | null
          asignado_rental_entrega_id?: string | null
          asignado_rental_entrega_team_id?: string | null
          asignado_rental_id?: string | null
          asignado_rental_team_id?: string | null
          auto?: string | null
          categoria?: string | null
          checkin?: string | null
          checkin_devolucion?: string | null
          checkin_entrega?: string | null
          cliente_apellido?: string | null
          cliente_nombre?: string | null
          codigo?: string | null
          contacto?: string | null
          contacto_devolucion?: string | null
          contacto_entrega?: string | null
          creado_por?: string | null
          created_at?: string
          desde?: string | null
          devolucion?: string | null
          devolucion_completada?: boolean
          documento_cliente?: string | null
          duracion?: string | null
          email?: string | null
          entrega_completada?: boolean
          estado?: string | null
          estado_devolucion?: string | null
          estado_entrega?: string | null
          estado_terminada_at?: string | null
          external_reservation_id: string
          fecha_creacion?: string | null
          hasta?: string | null
          hosp?: string | null
          hosp_devolucion?: string | null
          hosp_entrega?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          lugar_devolucion?: string | null
          lugar_entrega?: string | null
          lugar_operacion?: string | null
          modelo?: string | null
          notas?: string | null
          notas_devolucion?: string | null
          notas_entrega?: string | null
          organization_id: string
          origen_reserva?: string | null
          pagado?: string | null
          pagado_devolucion?: string | null
          pagado_entrega?: string | null
          precio?: number | null
          tarifa?: string | null
          telefono?: string | null
          tipo_actividad?: string | null
          tipo_documento_cliente?: string | null
          transfer_completado?: boolean
          updated_at?: string
        }
        Update: {
          a_pedido?: string | null
          acuerdo_comercial?: string | null
          acuerdo_precios?: string | null
          archived_at?: string | null
          asignado_escoba_devolucion_id?: string | null
          asignado_escoba_devolucion_team_id?: string | null
          asignado_escoba_entrega_id?: string | null
          asignado_escoba_entrega_team_id?: string | null
          asignado_escoba_id?: string | null
          asignado_escoba_team_id?: string | null
          asignado_rental_devolucion_id?: string | null
          asignado_rental_devolucion_team_id?: string | null
          asignado_rental_entrega_id?: string | null
          asignado_rental_entrega_team_id?: string | null
          asignado_rental_id?: string | null
          asignado_rental_team_id?: string | null
          auto?: string | null
          categoria?: string | null
          checkin?: string | null
          checkin_devolucion?: string | null
          checkin_entrega?: string | null
          cliente_apellido?: string | null
          cliente_nombre?: string | null
          codigo?: string | null
          contacto?: string | null
          contacto_devolucion?: string | null
          contacto_entrega?: string | null
          creado_por?: string | null
          created_at?: string
          desde?: string | null
          devolucion?: string | null
          devolucion_completada?: boolean
          documento_cliente?: string | null
          duracion?: string | null
          email?: string | null
          entrega_completada?: boolean
          estado?: string | null
          estado_devolucion?: string | null
          estado_entrega?: string | null
          estado_terminada_at?: string | null
          external_reservation_id?: string
          fecha_creacion?: string | null
          hasta?: string | null
          hosp?: string | null
          hosp_devolucion?: string | null
          hosp_entrega?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          lugar_devolucion?: string | null
          lugar_entrega?: string | null
          lugar_operacion?: string | null
          modelo?: string | null
          notas?: string | null
          notas_devolucion?: string | null
          notas_entrega?: string | null
          organization_id?: string
          origen_reserva?: string | null
          pagado?: string | null
          pagado_devolucion?: string | null
          pagado_entrega?: string | null
          precio?: number | null
          tarifa?: string | null
          telefono?: string | null
          tipo_actividad?: string | null
          tipo_documento_cliente?: string | null
          transfer_completado?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_asignado_escoba_devolucion_id_fkey"
            columns: ["asignado_escoba_devolucion_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_devolucion_team_id_fkey"
            columns: ["asignado_escoba_devolucion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_entrega_id_fkey"
            columns: ["asignado_escoba_entrega_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_entrega_team_id_fkey"
            columns: ["asignado_escoba_entrega_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_id_fkey"
            columns: ["asignado_escoba_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_team_id_fkey"
            columns: ["asignado_escoba_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_devolucion_id_fkey"
            columns: ["asignado_rental_devolucion_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_devolucion_team_id_fkey"
            columns: ["asignado_rental_devolucion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_entrega_id_fkey"
            columns: ["asignado_rental_entrega_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_entrega_team_id_fkey"
            columns: ["asignado_rental_entrega_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_id_fkey"
            columns: ["asignado_rental_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_team_id_fkey"
            columns: ["asignado_rental_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission_key: string
          role: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission_key: string
          role: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission_key?: string
          role?: string
        }
        Relationships: []
      }
      saml_connections: {
        Row: {
          acs_url: string
          created_at: string
          created_by: string | null
          email_attribute: string
          first_name_attribute: string | null
          id: string
          idp_entity_id: string
          idp_sso_url: string
          idp_x509_cert: string
          is_active: boolean
          last_name_attribute: string | null
          last_tested_at: string | null
          name: string
          organization_id: string
          sp_entity_id: string
        }
        Insert: {
          acs_url: string
          created_at?: string
          created_by?: string | null
          email_attribute?: string
          first_name_attribute?: string | null
          id?: string
          idp_entity_id: string
          idp_sso_url: string
          idp_x509_cert: string
          is_active?: boolean
          last_name_attribute?: string | null
          last_tested_at?: string | null
          name: string
          organization_id: string
          sp_entity_id: string
        }
        Update: {
          acs_url?: string
          created_at?: string
          created_by?: string | null
          email_attribute?: string
          first_name_attribute?: string | null
          id?: string
          idp_entity_id?: string
          idp_sso_url?: string
          idp_x509_cert?: string
          is_active?: boolean
          last_name_attribute?: string | null
          last_tested_at?: string | null
          name?: string
          organization_id?: string
          sp_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saml_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saml_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_group_mappings: {
        Row: {
          created_at: string
          id: string
          map_to_id: string
          map_to_type: string
          organization_id: string
          priority: number
          scim_group_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          map_to_id: string
          map_to_type: string
          organization_id: string
          priority?: number
          scim_group_id: string
        }
        Update: {
          created_at?: string
          id?: string
          map_to_id?: string
          map_to_type?: string
          organization_id?: string
          priority?: number
          scim_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_group_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_group_mappings_scim_group_id_fkey"
            columns: ["scim_group_id"]
            isOneToOne: true
            referencedRelation: "scim_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_group_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          scim_group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          scim_group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          scim_group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_group_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_group_memberships_scim_group_id_fkey"
            columns: ["scim_group_id"]
            isOneToOne: false
            referencedRelation: "scim_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_groups: {
        Row: {
          created_at: string
          display_name: string
          id: string
          organization_id: string
          scim_group_external_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          organization_id: string
          scim_group_external_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          organization_id?: string
          scim_group_external_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_identities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          scim_external_id: string
          scim_user_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          scim_external_id: string
          scim_user_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          scim_external_id?: string
          scim_user_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_identities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          organization_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          organization_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          organization_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_items: {
        Row: {
          billing_interval: string
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string
          product_code: string
          quantity: number
          status: string
          stripe_subscription_id: string | null
          stripe_subscription_item_id: string | null
        }
        Insert: {
          billing_interval?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id: string
          product_code: string
          quantity?: number
          status?: string
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
        }
        Update: {
          billing_interval?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string
          product_code?: string
          quantity?: number
          status?: string
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_interval: string | null
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string
          plan: string
          seats_included: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id: string
          plan?: string
          seats_included?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          billing_interval?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string
          plan?: string
          seats_included?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_actions: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata_json: Json
          organization_id: string | null
          reason: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata_json?: Json
          organization_id?: string | null
          reason: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata_json?: Json
          organization_id?: string | null
          reason?: string
        }
        Relationships: []
      }
      super_admin_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          metadata_json: Json | null
          organization_id: string | null
          read_at: string | null
          resolved_at: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          metadata_json?: Json | null
          organization_id?: string | null
          read_at?: string | null
          resolved_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          metadata_json?: Json | null
          organization_id?: string | null
          read_at?: string | null
          resolved_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_areas: {
        Row: {
          area_id: string
          id: string
          task_id: string
        }
        Insert: {
          area_id: string
          id?: string
          task_id: string
        }
        Update: {
          area_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_areas_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          task_id: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          task_id: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          task_id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_milestones: {
        Row: {
          assignee_id: string | null
          assignee_type: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          parent_milestone_id: string | null
          sort_order: number
          status: string
          task_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_milestone_id?: string | null
          sort_order?: number
          status?: string
          task_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          assignee_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_milestone_id?: string | null
          sort_order?: number
          status?: string
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_milestones_parent_milestone_id_fkey"
            columns: ["parent_milestone_id"]
            isOneToOne: false
            referencedRelation: "task_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_milestones_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          status: string
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          status?: string
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          status?: string
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_update_images: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          storage_path: string
          update_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          storage_path: string
          update_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          storage_path?: string
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_update_images_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "task_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_update_mentions: {
        Row: {
          id: string
          mentioned_user_id: string
          update_id: string
        }
        Insert: {
          id?: string
          mentioned_user_id: string
          update_id: string
        }
        Update: {
          id?: string
          mentioned_user_id?: string
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_update_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_update_mentions_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "task_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          created_at: string
          goal_increment_value: number | null
          id: string
          task_id: string
          text: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_increment_value?: number | null
          id?: string
          task_id: string
          text?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_increment_value?: number | null
          id?: string
          task_id?: string
          text?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_name: string | null
          customer_phone: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          goal_target_value: number | null
          goal_unit: string | null
          id: string
          is_archived: boolean
          location_notes: string | null
          location_text: string | null
          location_type: string | null
          operation_type: string | null
          organization_id: string
          priority: string
          reservation_ref: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
          vehicle_in_id: string | null
          vehicle_out_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          goal_target_value?: number | null
          goal_unit?: string | null
          id?: string
          is_archived?: boolean
          location_notes?: string | null
          location_text?: string | null
          location_type?: string | null
          operation_type?: string | null
          organization_id: string
          priority?: string
          reservation_ref?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          vehicle_in_id?: string | null
          vehicle_out_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          goal_target_value?: number | null
          goal_unit?: string | null
          id?: string
          is_archived?: boolean
          location_notes?: string | null
          location_text?: string | null
          location_type?: string | null
          operation_type?: string | null
          organization_id?: string
          priority?: string
          reservation_ref?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          vehicle_in_id?: string | null
          vehicle_out_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_applies: {
        Row: {
          applied_by: string
          applied_entities_json: Json
          created_at: string
          id: string
          organization_id: string
          status: string
          template_id: string
          template_version_id: string
        }
        Insert: {
          applied_by: string
          applied_entities_json?: Json
          created_at?: string
          id?: string
          organization_id: string
          status?: string
          template_id: string
          template_version_id: string
        }
        Update: {
          applied_by?: string
          applied_entities_json?: Json
          created_at?: string
          id?: string
          organization_id?: string
          status?: string
          template_id?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_applies_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_applies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_applies_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_applies_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_favorites: {
        Row: {
          created_at: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_favorites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "user_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_installs: {
        Row: {
          id: string
          installed_at: string
          installed_by: string
          organization_id: string
          template_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          installed_by: string
          organization_id: string
          template_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          installed_by?: string
          organization_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_installs_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "user_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          review: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          review?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          review?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_ratings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "user_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_by: string
          status: string
          template_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_by: string
          status?: string
          template_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_by?: string
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "user_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          config_json: Json
          created_at: string
          id: string
          template_id: string
          version: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          id?: string
          template_id: string
          version?: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          id?: string
          template_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions_public: {
        Row: {
          author_display_name: string | null
          category: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          estimated_items_count: number | null
          id: string
          is_public: boolean | null
          tags_json: Json | null
          template_id: string
          title: string
          version: string
        }
        Insert: {
          author_display_name?: string | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          estimated_items_count?: number | null
          id?: string
          is_public?: boolean | null
          tags_json?: Json | null
          template_id: string
          title: string
          version?: string
        }
        Update: {
          author_display_name?: string | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          estimated_items_count?: number | null
          id?: string
          is_public?: boolean | null
          tags_json?: Json | null
          template_id?: string
          title?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_public_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          color: string
          created_at: string
          description: string
          icon: string
          id: string
          industry: string | null
          is_featured: boolean
          long_description: string | null
          name: string
          slug: string
        }
        Insert: {
          category: string
          color?: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          industry?: string | null
          is_featured?: boolean
          long_description?: string | null
          name: string
          slug: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          industry?: string | null
          is_featured?: boolean
          long_description?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          hourly_rate: number | null
          id: string
          is_billable: boolean
          is_running: boolean
          organization_id: string
          start_time: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean
          is_running?: boolean
          organization_id: string
          start_time?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean
          is_running?: boolean
          organization_id?: string
          start_time?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_brokers: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_brokers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_documents: {
        Row: {
          ai_raw_data: Json | null
          ai_status: string
          created_at: string
          detected_amount: number | null
          detected_date: string | null
          detected_items: Json | null
          detected_provider: string | null
          document_type: string
          file_name: string
          id: string
          organization_id: string
          request_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          ai_raw_data?: Json | null
          ai_status?: string
          created_at?: string
          detected_amount?: number | null
          detected_date?: string | null
          detected_items?: Json | null
          detected_provider?: string | null
          document_type: string
          file_name: string
          id?: string
          organization_id: string
          request_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          ai_raw_data?: Json | null
          ai_status?: string
          created_at?: string
          detected_amount?: number | null
          detected_date?: string | null
          detected_items?: Json | null
          detected_provider?: string | null
          document_type?: string
          file_name?: string
          id?: string
          organization_id?: string
          request_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transfer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_invoice_settings: {
        Row: {
          address: string | null
          bank_details: string | null
          company_name: string | null
          created_at: string
          email: string | null
          footer_text: string | null
          id: string
          invoice_prefix: string | null
          logo_url: string | null
          next_invoice_number: number | null
          next_quote_number: number | null
          organization_id: string
          phone: string | null
          quote_prefix: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          footer_text?: string | null
          id?: string
          invoice_prefix?: string | null
          logo_url?: string | null
          next_invoice_number?: number | null
          next_quote_number?: number | null
          organization_id: string
          phone?: string | null
          quote_prefix?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          footer_text?: string | null
          id?: string
          invoice_prefix?: string | null
          logo_url?: string | null
          next_invoice_number?: number | null
          next_quote_number?: number | null
          organization_id?: string
          phone?: string | null
          quote_prefix?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_invoice_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_item_vehicles: {
        Row: {
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          notes: string | null
          organization_id: string
          position: number
          transfer_item_id: string
          vehicle_label: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          position?: number
          transfer_item_id: string
          vehicle_label?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          position?: number
          transfer_item_id?: string
          vehicle_label?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_item_vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_item_vehicles_transfer_item_id_fkey"
            columns: ["transfer_item_id"]
            isOneToOne: false
            referencedRelation: "transfer_items"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_items: {
        Row: {
          base_price: number | null
          created_at: string
          driver_name: string | null
          driver_pending: boolean
          driver_phone: string | null
          dropoff_enabled: boolean
          dropoff_location: string | null
          dropoff_time: string | null
          has_return: boolean
          id: string
          notes: string | null
          organization_id: string
          pax_count: number | null
          pickup_enabled: boolean
          pickup_location: string | null
          pickup_time: string | null
          position: number
          price_manually_set: boolean | null
          price_with_commission: number | null
          request_id: string
          return_dropoff_enabled: boolean
          return_dropoff_location: string | null
          return_dropoff_time: string | null
          return_pickup_enabled: boolean
          return_pickup_location: string | null
          return_pickup_time: string | null
          status: string
          transfer_date: string | null
          vehicle_type: string | null
          zone: string | null
          zone_address: string | null
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          driver_name?: string | null
          driver_pending?: boolean
          driver_phone?: string | null
          dropoff_enabled?: boolean
          dropoff_location?: string | null
          dropoff_time?: string | null
          has_return?: boolean
          id?: string
          notes?: string | null
          organization_id: string
          pax_count?: number | null
          pickup_enabled?: boolean
          pickup_location?: string | null
          pickup_time?: string | null
          position?: number
          price_manually_set?: boolean | null
          price_with_commission?: number | null
          request_id: string
          return_dropoff_enabled?: boolean
          return_dropoff_location?: string | null
          return_dropoff_time?: string | null
          return_pickup_enabled?: boolean
          return_pickup_location?: string | null
          return_pickup_time?: string | null
          status?: string
          transfer_date?: string | null
          vehicle_type?: string | null
          zone?: string | null
          zone_address?: string | null
        }
        Update: {
          base_price?: number | null
          created_at?: string
          driver_name?: string | null
          driver_pending?: boolean
          driver_phone?: string | null
          dropoff_enabled?: boolean
          dropoff_location?: string | null
          dropoff_time?: string | null
          has_return?: boolean
          id?: string
          notes?: string | null
          organization_id?: string
          pax_count?: number | null
          pickup_enabled?: boolean
          pickup_location?: string | null
          pickup_time?: string | null
          position?: number
          price_manually_set?: boolean | null
          price_with_commission?: number | null
          request_id?: string
          return_dropoff_enabled?: boolean
          return_dropoff_location?: string | null
          return_dropoff_time?: string | null
          return_pickup_enabled?: boolean
          return_pickup_location?: string | null
          return_pickup_time?: string | null
          status?: string
          transfer_date?: string | null
          vehicle_type?: string | null
          zone?: string | null
          zone_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transfer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_providers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          broker_id: string | null
          broker_name: string
          client_name: string
          client_total: number | null
          created_at: string
          created_by: string | null
          external_provider_name: string | null
          id: string
          internal_margin: number | null
          invoice_generated_at: string | null
          invoice_number: string | null
          is_external_provider: boolean
          notes: string | null
          organization_id: string
          provider_cost: number | null
          quote_generated_at: string | null
          quote_number: string | null
          request_number: string
          status: string
          updated_at: string
        }
        Insert: {
          broker_id?: string | null
          broker_name: string
          client_name: string
          client_total?: number | null
          created_at?: string
          created_by?: string | null
          external_provider_name?: string | null
          id?: string
          internal_margin?: number | null
          invoice_generated_at?: string | null
          invoice_number?: string | null
          is_external_provider?: boolean
          notes?: string | null
          organization_id: string
          provider_cost?: number | null
          quote_generated_at?: string | null
          quote_number?: string | null
          request_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          broker_id?: string | null
          broker_name?: string
          client_name?: string
          client_total?: number | null
          created_at?: string
          created_by?: string | null
          external_provider_name?: string | null
          id?: string
          internal_margin?: number | null
          invoice_generated_at?: string | null
          invoice_number?: string | null
          is_external_provider?: boolean
          notes?: string | null
          organization_id?: string
          provider_cost?: number | null
          quote_generated_at?: string | null
          quote_number?: string | null
          request_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "transfer_brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_request_notes: {
        Row: {
          id: string
          request_id: string
          organization_id: string
          author_type: string
          author_id: string
          author_name: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          organization_id: string
          author_type: string
          author_id: string
          author_name: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          organization_id?: string
          author_type?: string
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transfer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_request_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_status_history: {
        Row: {
          id: string
          request_id: string
          organization_id: string
          previous_status: string | null
          new_status: string
          changed_by_type: string
          changed_by_id: string | null
          changed_by_name: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          organization_id: string
          previous_status?: string | null
          new_status: string
          changed_by_type: string
          changed_by_id?: string | null
          changed_by_name?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          organization_id?: string
          previous_status?: string | null
          new_status?: string
          changed_by_type?: string
          changed_by_id?: string | null
          changed_by_name?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transfer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trials: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          organization_id: string
          plan_code: string
          starts_at: string
          status: string
          trial_type: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          organization_id: string
          plan_code?: string
          starts_at?: string
          status?: string
          trial_type?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          organization_id?: string
          plan_code?: string
          starts_at?: string
          status?: string
          trial_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          internal_notes: string | null
          message: string
          organization_id: string
          read_at: string | null
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          internal_notes?: string | null
          message: string
          organization_id: string
          read_at?: string | null
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          internal_notes?: string | null
          message?: string
          organization_id?: string
          read_at?: string | null
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          organization_id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          organization_id: string
          permission_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          organization_id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_seen_at: string
          organization_id: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_seen_at?: string
          organization_id: string
          session_token?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_seen_at?: string
          organization_id?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_templates: {
        Row: {
          color: string | null
          config_json: Json
          created_at: string
          created_by: string
          description: string
          favorites_count: number
          icon: string | null
          id: string
          industry: string | null
          installs_count: number
          is_pack: boolean
          long_description: string | null
          name: string
          organization_id: string
          rating_avg: number
          rating_count: number
          share_code: string
          slug: string
          status: string
          version: string
          visibility: string
        }
        Insert: {
          color?: string | null
          config_json?: Json
          created_at?: string
          created_by: string
          description?: string
          favorites_count?: number
          icon?: string | null
          id?: string
          industry?: string | null
          installs_count?: number
          is_pack?: boolean
          long_description?: string | null
          name: string
          organization_id: string
          rating_avg?: number
          rating_count?: number
          share_code?: string
          slug: string
          status?: string
          version?: string
          visibility?: string
        }
        Update: {
          color?: string | null
          config_json?: Json
          created_at?: string
          created_by?: string
          description?: string
          favorites_count?: number
          icon?: string | null
          id?: string
          industry?: string | null
          installs_count?: number
          is_pack?: boolean
          long_description?: string | null
          name?: string
          organization_id?: string
          rating_avg?: number
          rating_count?: number
          share_code?: string
          slug?: string
          status?: string
          version?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_cleaning_history: {
        Row: {
          completed_at: string
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          task_key: string
          vehicle_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          task_key: string
          vehicle_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          task_key?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_cleaning_history_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_cleaning_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_cleaning_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_cleaning_tasks: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          task_key: string
          vehicle_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          task_key: string
          vehicle_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          task_key?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_cleaning_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_cleaning_tasks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_locations: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_movements: {
        Row: {
          created_at: string | null
          driver_id: string
          end_lat: number | null
          end_lng: number | null
          end_photo_url: string | null
          ended_at: string | null
          id: string
          matricula: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          organization_id: string
          receipt_url: string | null
          reservation_id: string | null
          start_lat: number | null
          start_lng: number | null
          start_photo_url: string | null
          started_at: string
          status: Database["public"]["Enums"]["movement_status"]
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          end_lat?: number | null
          end_lng?: number | null
          end_photo_url?: string | null
          ended_at?: string | null
          id?: string
          matricula: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          organization_id: string
          receipt_url?: string | null
          reservation_id?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_photo_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["movement_status"]
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          end_lat?: number | null
          end_lng?: number | null
          end_photo_url?: string | null
          ended_at?: string | null
          id?: string
          matricula?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          organization_id?: string
          receipt_url?: string | null
          reservation_id?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_photo_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["movement_status"]
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_movements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_movements_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_movements_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          categoria: string | null
          cleaned_at: string | null
          cleaned_by: string | null
          created_at: string | null
          current_reservation_id: string | null
          id: string
          is_archived: boolean | null
          last_status_change: string | null
          location_id: string | null
          matricula: string
          modelo: string | null
          organization_id: string
          service_notes: string | null
          service_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          categoria?: string | null
          cleaned_at?: string | null
          cleaned_by?: string | null
          created_at?: string | null
          current_reservation_id?: string | null
          id?: string
          is_archived?: boolean | null
          last_status_change?: string | null
          location_id?: string | null
          matricula: string
          modelo?: string | null
          organization_id: string
          service_notes?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          categoria?: string | null
          cleaned_at?: string | null
          cleaned_by?: string | null
          created_at?: string | null
          current_reservation_id?: string | null
          id?: string
          is_archived?: boolean | null
          last_status_change?: string | null
          location_id?: string | null
          matricula?: string
          modelo?: string | null
          organization_id?: string
          service_notes?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_cleaned_by_fkey"
            columns: ["cleaned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_reservation_id_fkey"
            columns: ["current_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_reservation_id_fkey"
            columns: ["current_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_operational"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "vehicle_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          rating: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          rating?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workshops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      reservations_operational: {
        Row: {
          a_pedido: string | null
          acuerdo_comercial: string | null
          acuerdo_precios: string | null
          archived_at: string | null
          asignado_escoba_devolucion_id: string | null
          asignado_escoba_devolucion_team_id: string | null
          asignado_escoba_entrega_id: string | null
          asignado_escoba_entrega_team_id: string | null
          asignado_escoba_id: string | null
          asignado_escoba_team_id: string | null
          asignado_rental_devolucion_id: string | null
          asignado_rental_devolucion_team_id: string | null
          asignado_rental_entrega_id: string | null
          asignado_rental_entrega_team_id: string | null
          asignado_rental_id: string | null
          asignado_rental_team_id: string | null
          auto: string | null
          categoria: string | null
          checkin: string | null
          checkin_devolucion: string | null
          checkin_entrega: string | null
          cliente_apellido: string | null
          cliente_nombre: string | null
          codigo: string | null
          contacto: string | null
          contacto_devolucion: string | null
          contacto_entrega: string | null
          creado_por: string | null
          created_at: string | null
          desde: string | null
          devolucion: string | null
          devolucion_completada: boolean | null
          duracion: string | null
          entrega_completada: boolean | null
          estado: string | null
          estado_devolucion: string | null
          estado_entrega: string | null
          estado_terminada_at: string | null
          external_reservation_id: string | null
          fecha_creacion: string | null
          hasta: string | null
          hosp: string | null
          hosp_devolucion: string | null
          hosp_entrega: string | null
          id: string | null
          imported_at: string | null
          imported_by: string | null
          lugar_devolucion: string | null
          lugar_entrega: string | null
          lugar_operacion: string | null
          modelo: string | null
          notas: string | null
          notas_devolucion: string | null
          notas_entrega: string | null
          organization_id: string | null
          origen_reserva: string | null
          pagado: string | null
          pagado_devolucion: string | null
          pagado_entrega: string | null
          precio: number | null
          tarifa: string | null
          tipo_actividad: string | null
          transfer_completado: boolean | null
          updated_at: string | null
        }
        Insert: {
          a_pedido?: string | null
          acuerdo_comercial?: string | null
          acuerdo_precios?: string | null
          archived_at?: string | null
          asignado_escoba_devolucion_id?: string | null
          asignado_escoba_devolucion_team_id?: string | null
          asignado_escoba_entrega_id?: string | null
          asignado_escoba_entrega_team_id?: string | null
          asignado_escoba_id?: string | null
          asignado_escoba_team_id?: string | null
          asignado_rental_devolucion_id?: string | null
          asignado_rental_devolucion_team_id?: string | null
          asignado_rental_entrega_id?: string | null
          asignado_rental_entrega_team_id?: string | null
          asignado_rental_id?: string | null
          asignado_rental_team_id?: string | null
          auto?: string | null
          categoria?: string | null
          checkin?: string | null
          checkin_devolucion?: string | null
          checkin_entrega?: string | null
          cliente_apellido?: string | null
          cliente_nombre?: string | null
          codigo?: string | null
          contacto?: string | null
          contacto_devolucion?: string | null
          contacto_entrega?: string | null
          creado_por?: string | null
          created_at?: string | null
          desde?: string | null
          devolucion?: string | null
          devolucion_completada?: boolean | null
          duracion?: string | null
          entrega_completada?: boolean | null
          estado?: string | null
          estado_devolucion?: string | null
          estado_entrega?: string | null
          estado_terminada_at?: string | null
          external_reservation_id?: string | null
          fecha_creacion?: string | null
          hasta?: string | null
          hosp?: string | null
          hosp_devolucion?: string | null
          hosp_entrega?: string | null
          id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          lugar_devolucion?: string | null
          lugar_entrega?: string | null
          lugar_operacion?: string | null
          modelo?: string | null
          notas?: string | null
          notas_devolucion?: string | null
          notas_entrega?: string | null
          organization_id?: string | null
          origen_reserva?: string | null
          pagado?: string | null
          pagado_devolucion?: string | null
          pagado_entrega?: string | null
          precio?: number | null
          tarifa?: string | null
          tipo_actividad?: string | null
          transfer_completado?: boolean | null
          updated_at?: string | null
        }
        Update: {
          a_pedido?: string | null
          acuerdo_comercial?: string | null
          acuerdo_precios?: string | null
          archived_at?: string | null
          asignado_escoba_devolucion_id?: string | null
          asignado_escoba_devolucion_team_id?: string | null
          asignado_escoba_entrega_id?: string | null
          asignado_escoba_entrega_team_id?: string | null
          asignado_escoba_id?: string | null
          asignado_escoba_team_id?: string | null
          asignado_rental_devolucion_id?: string | null
          asignado_rental_devolucion_team_id?: string | null
          asignado_rental_entrega_id?: string | null
          asignado_rental_entrega_team_id?: string | null
          asignado_rental_id?: string | null
          asignado_rental_team_id?: string | null
          auto?: string | null
          categoria?: string | null
          checkin?: string | null
          checkin_devolucion?: string | null
          checkin_entrega?: string | null
          cliente_apellido?: string | null
          cliente_nombre?: string | null
          codigo?: string | null
          contacto?: string | null
          contacto_devolucion?: string | null
          contacto_entrega?: string | null
          creado_por?: string | null
          created_at?: string | null
          desde?: string | null
          devolucion?: string | null
          devolucion_completada?: boolean | null
          duracion?: string | null
          entrega_completada?: boolean | null
          estado?: string | null
          estado_devolucion?: string | null
          estado_entrega?: string | null
          estado_terminada_at?: string | null
          external_reservation_id?: string | null
          fecha_creacion?: string | null
          hasta?: string | null
          hosp?: string | null
          hosp_devolucion?: string | null
          hosp_entrega?: string | null
          id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          lugar_devolucion?: string | null
          lugar_entrega?: string | null
          lugar_operacion?: string | null
          modelo?: string | null
          notas?: string | null
          notas_devolucion?: string | null
          notas_entrega?: string | null
          organization_id?: string | null
          origen_reserva?: string | null
          pagado?: string | null
          pagado_devolucion?: string | null
          pagado_entrega?: string | null
          precio?: number | null
          tarifa?: string | null
          tipo_actividad?: string | null
          transfer_completado?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_asignado_escoba_devolucion_id_fkey"
            columns: ["asignado_escoba_devolucion_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_devolucion_team_id_fkey"
            columns: ["asignado_escoba_devolucion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_entrega_id_fkey"
            columns: ["asignado_escoba_entrega_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_entrega_team_id_fkey"
            columns: ["asignado_escoba_entrega_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_id_fkey"
            columns: ["asignado_escoba_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_escoba_team_id_fkey"
            columns: ["asignado_escoba_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_devolucion_id_fkey"
            columns: ["asignado_rental_devolucion_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_devolucion_team_id_fkey"
            columns: ["asignado_rental_devolucion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_entrega_id_fkey"
            columns: ["asignado_rental_entrega_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_entrega_team_id_fkey"
            columns: ["asignado_rental_entrega_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_id_fkey"
            columns: ["asignado_rental_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_asignado_rental_team_id_fkey"
            columns: ["asignado_rental_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      accept_my_pending_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      approve_broker_registration: {
        Args: { p_request_id: string }
        Returns: Json
      }
      archive_old_reservations: { Args: never; Returns: number }
      can_create_area: { Args: { p_org_id: string }; Returns: boolean }
      can_manage_deleted_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_area: {
        Args: { _area_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_reservations: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_reservations_operational: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_task_by_areas: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_task_strict: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_broker_rate_limits: { Args: never; Returns: number }
      cleanup_deleted_tasks: { Args: never; Returns: number }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_area_secure: {
        Args: {
          p_color?: string
          p_description?: string
          p_icon?: string
          p_name: string
          p_visibility?: string
        }
        Returns: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "areas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_default_dropdown_options: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      create_default_roles_for_org: {
        Args: { org_id: string }
        Returns: undefined
      }
      create_invitation_secure: {
        Args: {
          p_email: string
          p_expires_in_days?: number
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      create_organization_with_owner: {
        Args: { p_name: string; p_vertical_preset?: string }
        Returns: string
      }
      create_task_secure: {
        Args: {
          p_assigned_to?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_description?: string
          p_due_date?: string
          p_goal_target_value?: number
          p_goal_unit?: string
          p_location_notes?: string
          p_location_text?: string
          p_location_type?: string
          p_operation_type?: string
          p_priority?: string
          p_reservation_ref?: string
          p_scheduled_at?: string
          p_status?: string
          p_title: string
          p_type?: string
          p_vehicle_in_id?: string
          p_vehicle_out_id?: string
        }
        Returns: Json
      }
      debug_areas_insert_permission: {
        Args: { p_org_id: string }
        Returns: Json
      }
      debug_entitlements: { Args: never; Returns: Json }
      derive_operation_status: { Args: { p_task_id: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_broker_profile: { Args: { p_user_id: string }; Returns: Json }
      get_broker_registration_status: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_inactive_vehicles: {
        Args: { p_org_id: string }
        Returns: {
          categoria: string
          is_suspicious: boolean
          last_reservation_date: string
          matricula: string
          modelo: string
          vehicle_id: string
        }[]
      }
      get_invitation_public: { Args: { p_token: string }; Returns: Json }
      get_my_enabled_modules: {
        Args: never
        Returns: {
          enabled: boolean
          module_key: string
        }[]
      }
      get_my_pending_invitations: { Args: never; Returns: Json }
      get_my_permissions: { Args: { p_organization_id: string }; Returns: Json }
      get_next_transfer_document_number: {
        Args: { p_document_type: string; p_organization_id: string }
        Returns: string
      }
      get_org_integration_flags: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_org_membership: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: {
          member_role: string
          member_status: string
        }[]
      }
      get_organization_entitlements: { Args: never; Returns: Json }
      get_organization_invitations: {
        Args: never
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          id: string
          role: string
          status: string
        }[]
      }
      get_reservations_operational: {
        Args: { p_organization_id: string }
        Returns: {
          a_pedido: string
          acuerdo_comercial: string
          acuerdo_precios: string
          archived_at: string
          asignado_escoba_devolucion_id: string
          asignado_escoba_devolucion_team_id: string
          asignado_escoba_entrega_id: string
          asignado_escoba_entrega_team_id: string
          asignado_escoba_id: string
          asignado_escoba_team_id: string
          asignado_rental_devolucion_id: string
          asignado_rental_devolucion_team_id: string
          asignado_rental_entrega_id: string
          asignado_rental_entrega_team_id: string
          asignado_rental_id: string
          asignado_rental_team_id: string
          auto: string
          categoria: string
          checkin: string
          checkin_devolucion: string
          checkin_entrega: string
          cliente_apellido: string
          cliente_nombre: string
          codigo: string
          contacto: string
          contacto_devolucion: string
          contacto_entrega: string
          creado_por: string
          created_at: string
          desde: string
          devolucion: string
          devolucion_completada: boolean
          duracion: string
          entrega_completada: boolean
          estado: string
          estado_devolucion: string
          estado_entrega: string
          estado_terminada_at: string
          external_reservation_id: string
          fecha_creacion: string
          hasta: string
          hosp: string
          hosp_devolucion: string
          hosp_entrega: string
          id: string
          imported_at: string
          imported_by: string
          lugar_devolucion: string
          lugar_entrega: string
          lugar_operacion: string
          modelo: string
          notas: string
          notas_devolucion: string
          notas_entrega: string
          organization_id: string
          origen_reserva: string
          pagado: string
          pagado_devolucion: string
          pagado_entrega: string
          precio: number
          tarifa: string
          tipo_actividad: string
          transfer_completado: boolean
          updated_at: string
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_org_role: {
        Args: {
          p_organization_id: string
          p_roles: string[]
          p_user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          p_organization_id: string
          p_permission: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_org_member: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      is_same_organization: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { check_user_id?: string }; Returns: boolean }
      is_task_participant: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: boolean
      }
      link_user_to_broker: { Args: never; Returns: Json }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_ip_address?: string
          p_metadata?: Json
          p_user_agent?: string
        }
        Returns: string
      }
      migrate_profiles_to_org_members: { Args: never; Returns: number }
      recalculate_vehicle_status: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      redeem_coupon_for_plan: {
        Args: { p_coupon_code: string; p_plan_code: string }
        Returns: Json
      }
      reject_broker_registration: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: Json
      }
      revoke_all_user_sessions: {
        Args: { p_except_current?: string; p_user_id: string }
        Returns: number
      }
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: Json }
      setup_broker_access: {
        Args: {
          p_broker_id: string
          p_company?: string
          p_email: string
          p_phone?: string
        }
        Returns: Json
      }
      setup_organization_owner: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      sync_vehicles_from_reservations: { Args: never; Returns: Json }
      track_referral_click: { Args: { ref_code: string }; Returns: boolean }
      track_referral_signup: {
        Args: { ref_code: string; user_email: string }
        Returns: boolean
      }
      update_vehicle_location: {
        Args: { p_location_id?: string; p_vehicle_id: string }
        Returns: undefined
      }
      upsert_lead: {
        Args: { p_email: string; p_referral_code?: string; p_source: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "member" | "read_only"
      movement_status: "en_curso" | "completado" | "cancelado"
      movement_type: "entrega" | "recogida" | "escoba" | "limpieza"
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
      app_role: ["owner", "admin", "manager", "member", "read_only"],
      movement_status: ["en_curso", "completado", "cancelado"],
      movement_type: ["entrega", "recogida", "escoba", "limpieza"],
    },
  },
} as const

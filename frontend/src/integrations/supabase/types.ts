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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          credit_limit: number
          customer_group: string
          email: string | null
          id: string
          join_date: string
          last_purchase: string | null
          loyalty_points: number
          loyalty_tier: string
          name: string
          notes: string | null
          outstanding_balance: number
          phone: string | null
          status: string
          tenant_id: string | null
          total_purchases: number
          total_spent: number
          type: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          credit_limit?: number
          customer_group?: string
          email?: string | null
          id?: string
          join_date?: string
          last_purchase?: string | null
          loyalty_points?: number
          loyalty_tier?: string
          name: string
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          status?: string
          tenant_id?: string | null
          total_purchases?: number
          total_spent?: number
          type?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          credit_limit?: number
          customer_group?: string
          email?: string | null
          id?: string
          join_date?: string
          last_purchase?: string | null
          loyalty_points?: number
          loyalty_tier?: string
          name?: string
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          status?: string
          tenant_id?: string | null
          total_purchases?: number
          total_spent?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          attachments: number
          branch: string
          category: string
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          notes: string | null
          paid_to: string | null
          payment_method: string
          reference: string
          status: string
          tenant_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          attachments?: number
          branch?: string
          category?: string
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_to?: string | null
          payment_method?: string
          reference: string
          status?: string
          tenant_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          attachments?: number
          branch?: string
          category?: string
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_to?: string | null
          payment_method?: string
          reference?: string
          status?: string
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image: string | null
          max_stock: number
          min_stock: number
          name: string
          selling_price: number
          sku: string
          status: string
          stock: number
          tenant_id: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          max_stock?: number
          min_stock?: number
          name: string
          selling_price?: number
          sku: string
          status?: string
          stock?: number
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          max_stock?: number
          min_stock?: number
          name?: string
          selling_price?: number
          sku?: string
          status?: string
          stock?: number
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          role: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          role?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          purchase_id: string
          quantity: number
          received_qty: number
          sku: string | null
          tenant_id: string | null
          total: number
          unit_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          purchase_id: string
          quantity?: number
          received_qty?: number
          sku?: string | null
          tenant_id?: string | null
          total?: number
          unit_cost?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          purchase_id?: string
          quantity?: number
          received_qty?: number
          sku?: string | null
          tenant_id?: string | null
          total?: number
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          branch: string
          created_at: string
          date: string
          discount: number
          due: number
          expected_delivery: string | null
          id: string
          items_count: number
          notes: string | null
          paid: number
          payment_method: string
          purchase_no: string
          shipping: number
          status: string
          subtotal: number
          supplier_id: string | null
          supplier_name: string
          tax: number
          tenant_id: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: string
          created_at?: string
          date?: string
          discount?: number
          due?: number
          expected_delivery?: string | null
          id?: string
          items_count?: number
          notes?: string | null
          paid?: number
          payment_method?: string
          purchase_no: string
          shipping?: number
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax?: number
          tenant_id?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          branch?: string
          created_at?: string
          date?: string
          discount?: number
          due?: number
          expected_delivery?: string | null
          id?: string
          items_count?: number
          notes?: string | null
          paid?: number
          payment_method?: string
          purchase_no?: string
          shipping?: number
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax?: number
          tenant_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_run_id: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_run_id?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_run_id?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_filter_presets: {
        Row: {
          action: string
          created_at: string
          filter_user: string
          from_date: string
          id: string
          name: string
          search: string
          tenant_id: string
          to_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          filter_user?: string
          from_date?: string
          id?: string
          name: string
          search?: string
          tenant_id: string
          to_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          filter_user?: string
          from_date?: string
          id?: string
          name?: string
          search?: string
          tenant_id?: string
          to_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_isolation_leaks: {
        Row: {
          actual_tenant: string
          context: Json | null
          created_at: string
          cross_tenant_run_id: string | null
          expected_tenant: string
          id: string
          row_id: string
          run_id: string
          table_name: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          actual_tenant: string
          context?: Json | null
          created_at?: string
          cross_tenant_run_id?: string | null
          expected_tenant: string
          id?: string
          row_id: string
          run_id: string
          table_name: string
          tenant_id: string
          user_id: string
        }
        Update: {
          actual_tenant?: string
          context?: Json | null
          created_at?: string
          cross_tenant_run_id?: string | null
          expected_tenant?: string
          id?: string
          row_id?: string
          run_id?: string
          table_name?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_runs: {
        Row: {
          actual_csv_filename: string | null
          actual_pdf_filename: string | null
          created_at: string
          cross_tenant_run_id: string | null
          csv_download_status: string | null
          csv_filename: string | null
          dashboard_refresh_status: string | null
          details: Json | null
          error_message: string | null
          failing_after: Json | null
          failing_before: Json | null
          failing_op: string | null
          failing_params: Json | null
          failing_payload: Json | null
          failing_step: string | null
          filename_match_status: string | null
          id: string
          isolation_leak_count: number | null
          overall_status: string
          pdf_download_status: string | null
          pdf_filename: string | null
          screenshot_after_url: string | null
          screenshot_before_url: string | null
          stock_increment_status: string | null
          stock_movement_status: string | null
          tenant_id: string
          user_id: string
          webhook_attempts: number
          webhook_error: string | null
          webhook_last_attempt_at: string | null
          webhook_last_status: number | null
          webhook_response_body: string | null
          webhook_response_headers: Json | null
          webhook_status: string | null
        }
        Insert: {
          actual_csv_filename?: string | null
          actual_pdf_filename?: string | null
          created_at?: string
          cross_tenant_run_id?: string | null
          csv_download_status?: string | null
          csv_filename?: string | null
          dashboard_refresh_status?: string | null
          details?: Json | null
          error_message?: string | null
          failing_after?: Json | null
          failing_before?: Json | null
          failing_op?: string | null
          failing_params?: Json | null
          failing_payload?: Json | null
          failing_step?: string | null
          filename_match_status?: string | null
          id?: string
          isolation_leak_count?: number | null
          overall_status?: string
          pdf_download_status?: string | null
          pdf_filename?: string | null
          screenshot_after_url?: string | null
          screenshot_before_url?: string | null
          stock_increment_status?: string | null
          stock_movement_status?: string | null
          tenant_id: string
          user_id: string
          webhook_attempts?: number
          webhook_error?: string | null
          webhook_last_attempt_at?: string | null
          webhook_last_status?: number | null
          webhook_response_body?: string | null
          webhook_response_headers?: Json | null
          webhook_status?: string | null
        }
        Update: {
          actual_csv_filename?: string | null
          actual_pdf_filename?: string | null
          created_at?: string
          cross_tenant_run_id?: string | null
          csv_download_status?: string | null
          csv_filename?: string | null
          dashboard_refresh_status?: string | null
          details?: Json | null
          error_message?: string | null
          failing_after?: Json | null
          failing_before?: Json | null
          failing_op?: string | null
          failing_params?: Json | null
          failing_payload?: Json | null
          failing_step?: string | null
          filename_match_status?: string | null
          id?: string
          isolation_leak_count?: number | null
          overall_status?: string
          pdf_download_status?: string | null
          pdf_filename?: string | null
          screenshot_after_url?: string | null
          screenshot_before_url?: string | null
          stock_increment_status?: string | null
          stock_movement_status?: string | null
          tenant_id?: string
          user_id?: string
          webhook_attempts?: number
          webhook_error?: string | null
          webhook_last_attempt_at?: string | null
          webhook_last_status?: number | null
          webhook_response_body?: string | null
          webhook_response_headers?: Json | null
          webhook_status?: string | null
        }
        Relationships: []
      }
      qa_settings: {
        Row: {
          capture_screenshots: boolean
          created_at: string
          diff_threshold: number
          screenshot_retention_days: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
          webhook_enabled: boolean
          webhook_url: string | null
        }
        Insert: {
          capture_screenshots?: boolean
          created_at?: string
          diff_threshold?: number
          screenshot_retention_days?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          webhook_enabled?: boolean
          webhook_url?: string | null
        }
        Update: {
          capture_screenshots?: boolean
          created_at?: string
          diff_threshold?: number
          screenshot_retention_days?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          webhook_enabled?: boolean
          webhook_url?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          sku: string | null
          tenant_id: string | null
          total: number
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          sku?: string | null
          tenant_id?: string | null
          total?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          sku?: string | null
          tenant_id?: string | null
          total?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch: string
          cashier: string
          created_at: string
          customer_name: string
          date: string
          discount: number
          due: number
          id: string
          invoice_no: string
          items: number
          notes: string | null
          paid: number
          payment_method: string
          status: string
          subtotal: number
          tax: number
          tenant_id: string | null
          total: number
          user_id: string
        }
        Insert: {
          branch?: string
          cashier?: string
          created_at?: string
          customer_name?: string
          date?: string
          discount?: number
          due?: number
          id?: string
          invoice_no: string
          items?: number
          notes?: string | null
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          tax?: number
          tenant_id?: string | null
          total?: number
          user_id: string
        }
        Update: {
          branch?: string
          cashier?: string
          created_at?: string
          customer_name?: string
          date?: string
          discount?: number
          due?: number
          id?: string
          invoice_no?: string
          items?: number
          notes?: string | null
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          tax?: number
          tenant_id?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity_change: number
          reference: string | null
          reference_id: string | null
          stock_after: number
          stock_before: number
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity_change?: number
          reference?: string | null
          reference_id?: string | null
          stock_after?: number
          stock_before?: number
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity_change?: number
          reference?: string | null
          reference_id?: string | null
          stock_after?: number
          stock_before?: number
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          outstanding_balance: number
          payment_terms: string
          phone: string | null
          status: string
          tax_number: string | null
          tenant_id: string | null
          total_purchases: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          outstanding_balance?: number
          payment_terms?: string
          phone?: string | null
          status?: string
          tax_number?: string | null
          tenant_id?: string | null
          total_purchases?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          outstanding_balance?: number
          payment_terms?: string
          phone?: string | null
          status?: string
          tax_number?: string | null
          tenant_id?: string | null
          total_purchases?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_color: string | null
          contact_email: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_product_stock: {
        Args: { _delta: number; _product_id: string; _reason?: string }
        Returns: Json
      }
      create_purchase_order_draft: {
        Args: { _items: Json; _supplier_name: string }
        Returns: Json
      }
      current_tenant_id: { Args: { _user_id: string }; Returns: string }
      delete_old_qa_screenshots: { Args: { _days?: number }; Returns: Json }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      receive_purchase_order: {
        Args: { _purchase_id: string }
        Returns: undefined
      }
      record_sale: {
        Args: { _customer_name: string; _invoice_no: string; _items: Json }
        Returns: string
      }
      set_my_role: {
        Args: { _new_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      user_default_tenant: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "owner" | "admin" | "staff" | "viewer"
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
      app_role: ["owner", "admin", "staff", "viewer"],
    },
  },
} as const

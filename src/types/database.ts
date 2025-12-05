/**
 * Database Types
 * Generated types from Supabase schema
 * TODO: Update with actual Supabase CLI generated types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          display_name: string | null
          phone: string | null
          avatar_url: string | null
          role: string
          department: string | null
          can_approve_designs: boolean
          can_approve_orders: boolean
          can_manage_inventory: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          display_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: string
          department?: string | null
          can_approve_designs?: boolean
          can_approve_orders?: boolean
          can_manage_inventory?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          display_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: string
          department?: string | null
          can_approve_designs?: boolean
          can_approve_orders?: boolean
          can_manage_inventory?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          customer_code: string
          customer_type: string
          company_name: string | null
          contact_person: string
          email: string | null
          phone: string
          line_id: string | null
          address: string | null
          district: string | null
          city: string | null
          province: string | null
          postal_code: string | null
          tax_id: string | null
          branch: string
          assigned_sales_id: string | null
          customer_tier: string
          discount_percentage: number
          credit_limit: number
          credit_days: number
          total_orders: number
          total_revenue: number
          last_order_date: string | null
          is_active: boolean
          notes: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_code: string
          customer_type?: string
          company_name?: string | null
          contact_person: string
          email?: string | null
          phone: string
          line_id?: string | null
          address?: string | null
          district?: string | null
          city?: string | null
          province?: string | null
          postal_code?: string | null
          tax_id?: string | null
          branch?: string
          assigned_sales_id?: string | null
          customer_tier?: string
          discount_percentage?: number
          credit_limit?: number
          credit_days?: number
          total_orders?: number
          total_revenue?: number
          last_order_date?: string | null
          is_active?: boolean
          notes?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      products: {
        Row: {
          id: string
          sku: string
          product_type: string
          name: string
          name_th: string
          description: string | null
          material_type: string | null
          weight_gsm: number | null
          base_color: string | null
          available_sizes: string[] | null
          cost_price: number
          base_price: number
          track_inventory: boolean
          low_stock_threshold: number
          image_url: string | null
          mockup_template_url: string | null
          is_active: boolean
          is_featured: boolean
          slug: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          product_type: string
          name: string
          name_th: string
          description?: string | null
          material_type?: string | null
          weight_gsm?: number | null
          base_color?: string | null
          available_sizes?: string[] | null
          cost_price?: number
          base_price: number
          track_inventory?: boolean
          low_stock_threshold?: number
          image_url?: string | null
          mockup_template_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          slug?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_id: string
          customer_name: string
          customer_phone: string | null
          order_type_code: string
          order_date: string
          due_date: string | null
          production_mode: string
          priority_level: number
          priority_surcharge: number
          revision_count: number
          free_revisions: number
          all_designs_approved: boolean
          mockup_approved: boolean
          mockup_approved_at: string | null
          materials_ready: boolean
          production_unlocked: boolean
          change_request_count: number
          change_request_total: number
          subtotal: number
          discount_amount: number
          discount_percentage: number
          tax_amount: number
          shipping_fee: number
          total_amount: number
          payment_status: string
          paid_amount: number
          status: string
          delivery_method: string | null
          delivery_address: string | null
          tracking_number: string | null
          shipped_at: string | null
          delivered_at: string | null
          notes: string | null
          internal_notes: string | null
          assigned_sales_id: string | null
          assigned_production_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
        }
        Insert: {
          id?: string
          order_number: string
          customer_id: string
          customer_name: string
          customer_phone?: string | null
          order_type_code?: string
          order_date?: string
          due_date?: string | null
          production_mode?: string
          priority_level?: number
          priority_surcharge?: number
          revision_count?: number
          free_revisions?: number
          all_designs_approved?: boolean
          mockup_approved?: boolean
          mockup_approved_at?: string | null
          materials_ready?: boolean
          production_unlocked?: boolean
          change_request_count?: number
          change_request_total?: number
          subtotal?: number
          discount_amount?: number
          discount_percentage?: number
          tax_amount?: number
          shipping_fee?: number
          total_amount?: number
          payment_status?: string
          paid_amount?: number
          status?: string
          delivery_method?: string | null
          delivery_address?: string | null
          tracking_number?: string | null
          shipped_at?: string | null
          delivered_at?: string | null
          notes?: string | null
          internal_notes?: string | null
          assigned_sales_id?: string | null
          assigned_production_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          item_number: number
          product_id: string | null
          product_sku: string | null
          product_name: string
          size: string | null
          color: string | null
          quantity: number
          unit_price: number
          line_total: number
          design_files: string[] | null
          design_status: string
          mockup_url: string | null
          production_status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          item_number: number
          product_id?: string | null
          product_sku?: string | null
          product_name: string
          size?: string | null
          color?: string | null
          quantity?: number
          unit_price: number
          line_total: number
          design_files?: string[] | null
          design_status?: string
          mockup_url?: string | null
          production_status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}


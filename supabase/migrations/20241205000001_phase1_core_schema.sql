-- =============================================
-- ERP FLOW REDESIGN - PHASE 1: CORE SCHEMA
-- Migration: 20241205000001
-- Description: Core tables for users, customers, products, and orders
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 1. USER PROFILES (เชื่อมกับ Supabase Auth)
-- =============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  
  -- Role & Department
  role TEXT DEFAULT 'staff', -- 'admin', 'manager', 'sales', 'production', 'staff', 'customer'
  department TEXT, -- 'sales', 'production', 'design', 'qc', 'warehouse'
  
  -- Permissions
  can_approve_designs BOOLEAN DEFAULT false,
  can_approve_orders BOOLEAN DEFAULT false,
  can_manage_inventory BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- =============================================
-- 2. CUSTOMERS (ข้อมูลลูกค้า)
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT UNIQUE NOT NULL, -- 'CUST-0001'
  
  -- Basic Info
  customer_type TEXT DEFAULT 'individual', -- 'individual', 'business', 'reseller'
  company_name TEXT,
  contact_person TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  line_id TEXT,
  
  -- Address
  address TEXT,
  district TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  
  -- Business Info
  tax_id TEXT,
  branch TEXT DEFAULT 'สำนักงานใหญ่',
  
  -- Sales Info
  assigned_sales_id UUID REFERENCES user_profiles(id),
  customer_tier TEXT DEFAULT 'standard', -- 'vip', 'standard', 'new'
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Payment
  credit_limit DECIMAL(12,2) DEFAULT 0,
  credit_days INTEGER DEFAULT 0, -- 0 = cash only, 7/15/30 days
  
  -- Stats (auto-updated by triggers)
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(15,2) DEFAULT 0,
  last_order_date DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Notes
  notes TEXT,
  tags TEXT[], -- ['corporate', 'repeat_customer', 'event_organizer']
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_tier ON customers(customer_tier);

-- =============================================
-- 3. PRODUCTS (สินค้าสำเร็จรูป)
-- =============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL, -- 'TS-COT-WHT-L'
  
  -- Basic Info
  product_type TEXT NOT NULL, -- 'tshirt', 'polo', 'hoodie', 'cap', 'tote_bag'
  name TEXT NOT NULL,
  name_th TEXT NOT NULL,
  description TEXT,
  
  -- Material
  material_type TEXT, -- 'cotton_32', 'poly_65_35', 'pique'
  weight_gsm INTEGER, -- 180, 220
  
  -- Variants
  base_color TEXT, -- 'white', 'black', 'navy'
  available_sizes TEXT[], -- ['S', 'M', 'L', 'XL', '2XL']
  
  -- Pricing
  cost_price DECIMAL(10,2) DEFAULT 0,
  base_price DECIMAL(10,2) NOT NULL, -- ราคาขาย
  
  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  low_stock_threshold INTEGER DEFAULT 10,
  
  -- Images
  image_url TEXT,
  mockup_template_url TEXT, -- ไฟล์ .psd สำหรับใส่ลายให้ลูกค้าดู
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- SEO
  slug TEXT UNIQUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_active ON products(is_active);

-- =============================================
-- 4. MATERIALS (วัสดุดิบ - ผ้า, หมึก, อะไหล่)
-- =============================================
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code TEXT UNIQUE NOT NULL, -- 'FAB-COT32-WHT'
  
  -- Basic Info
  category TEXT NOT NULL, -- 'fabric', 'ink', 'thread', 'label', 'packaging'
  name TEXT NOT NULL,
  name_th TEXT NOT NULL,
  
  -- Specifications
  specs JSONB, -- { "color": "white", "width_cm": 150, "composition": "100% Cotton" }
  
  -- Units
  base_unit TEXT DEFAULT 'kg', -- 'kg', 'yard', 'meter', 'piece', 'liter'
  purchase_unit TEXT DEFAULT 'kg',
  usage_unit TEXT DEFAULT 'meter',
  conversion_factor DECIMAL(10,4) DEFAULT 1, -- 1 kg = 4.5 meter (for fabric)
  
  -- Pricing
  unit_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Inventory
  current_stock DECIMAL(12,3) DEFAULT 0,
  reorder_point DECIMAL(10,2) DEFAULT 0,
  reorder_quantity DECIMAL(10,2) DEFAULT 0,
  
  -- Supplier
  default_supplier_id UUID, -- REFERENCES suppliers(id) - will create later
  lead_time_days INTEGER DEFAULT 7,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_materials_code ON materials(material_code);
CREATE INDEX idx_materials_category ON materials(category);

-- =============================================
-- 5. ORDER TYPES (รูปแบบการผลิต)
-- =============================================
CREATE TABLE IF NOT EXISTS order_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'ready_made', 'custom_sewing', 'full_custom', 'print_only'
  name TEXT NOT NULL,
  name_th TEXT NOT NULL,
  description TEXT,
  default_lead_days INTEGER DEFAULT 7,
  requires_pattern BOOLEAN DEFAULT false,
  requires_fabric BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data
INSERT INTO order_types (code, name, name_th, default_lead_days, requires_pattern, requires_fabric, sort_order) VALUES
('ready_made', 'Ready-Made', 'เสื้อสำเร็จรูป', 5, false, false, 1),
('custom_sewing', 'Custom Sewing', 'ตัดเย็บตามแบบ', 14, true, true, 2),
('full_custom', 'Full Custom', 'ออกแบบ+ตัดเย็บ', 21, true, true, 3),
('print_only', 'Print Only', 'สกรีน/ปักอย่างเดียว', 3, false, false, 4)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 6. ORDERS (ออเดอร์หลัก)
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- 'ORD-2024-0001'
  
  -- Customer
  customer_id UUID NOT NULL REFERENCES customers(id),
  customer_name TEXT NOT NULL, -- snapshot
  customer_phone TEXT,
  
  -- Order Info
  order_type_code TEXT DEFAULT 'ready_made',
  order_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Production
  production_mode TEXT DEFAULT 'in_house', -- 'in_house', 'outsource', 'hybrid'
  priority_level INTEGER DEFAULT 0, -- 0=normal, 1=rush, 2=urgent, 3=emergency
  priority_surcharge DECIMAL(10,2) DEFAULT 0,
  
  -- Design & Approval
  revision_count INTEGER DEFAULT 0,
  free_revisions INTEGER DEFAULT 2,
  all_designs_approved BOOLEAN DEFAULT false,
  mockup_approved BOOLEAN DEFAULT false,
  mockup_approved_at TIMESTAMPTZ,
  materials_ready BOOLEAN DEFAULT false,
  production_unlocked BOOLEAN DEFAULT false,
  
  -- Change Requests
  change_request_count INTEGER DEFAULT 0,
  change_request_total DECIMAL(12,2) DEFAULT 0,
  
  -- Pricing
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Payment
  payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
  paid_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'pending_approval', 'approved', 'in_production', 'qc', 'completed', 'shipped', 'cancelled'
  
  -- Delivery
  delivery_method TEXT, -- 'pickup', 'delivery', 'courier'
  delivery_address TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  -- Assignment
  assigned_sales_id UUID REFERENCES user_profiles(id),
  assigned_production_id UUID REFERENCES user_profiles(id),
  
  -- Metadata
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- Indexes
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_due ON orders(due_date);

-- =============================================
-- 7. ORDER ITEMS (รายการสินค้าในออเดอร์)
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL, -- 1, 2, 3 (ลำดับใน order)
  
  -- Product (if using ready-made)
  product_id UUID REFERENCES products(id),
  product_sku TEXT,
  product_name TEXT NOT NULL,
  
  -- Customization
  size TEXT,
  color TEXT,
  
  -- Quantity
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Unit Price
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  
  -- Design Files
  design_files TEXT[], -- URLs to uploaded design files
  design_status TEXT DEFAULT 'pending', -- 'pending', 'in_review', 'approved', 'rejected'
  mockup_url TEXT, -- URL to generated mockup
  
  -- Production
  production_status TEXT DEFAULT 'pending', -- 'pending', 'in_queue', 'in_progress', 'completed'
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(order_id, item_number)
);

-- Indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_design_status ON order_items(design_status);

-- =============================================
-- 8. ADDON TYPES (ประเภท Addon)
-- =============================================
CREATE TABLE IF NOT EXISTS addon_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_th TEXT NOT NULL,
  category TEXT NOT NULL, -- 'packaging', 'labeling', 'finishing', 'extra'
  base_price DECIMAL(10,2) DEFAULT 0,
  price_type TEXT DEFAULT 'per_piece', -- 'per_piece', 'per_lot', 'fixed'
  requires_design BOOLEAN DEFAULT false,
  requires_material BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data
INSERT INTO addon_types (code, name, name_th, category, base_price, price_type, requires_design, sort_order) VALUES
-- Packaging
('opp_bag', 'OPP Bag', 'ถุง OPP', 'packaging', 2, 'per_piece', false, 1),
('zipper_bag', 'Zipper Bag', 'ถุงซิป', 'packaging', 5, 'per_piece', false, 2),
('paper_bag', 'Paper Bag', 'ถุงกระดาษ', 'packaging', 15, 'per_piece', true, 3),
('box', 'Box', 'กล่อง', 'packaging', 25, 'per_piece', true, 4),
-- Labeling
('hang_tag', 'Hang Tag', 'แท็กห้อย', 'labeling', 3, 'per_piece', true, 5),
('care_label', 'Care Label', 'ป้ายซัก', 'labeling', 2, 'per_piece', false, 6),
-- Finishing
('fold_pack', 'Fold & Pack', 'พับแพค', 'finishing', 5, 'per_piece', false, 7),
('press', 'Press', 'รีด', 'finishing', 3, 'per_piece', false, 8)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 9. ORDER ADDONS (addon ที่เลือกในแต่ละ order)
-- =============================================
CREATE TABLE IF NOT EXISTS order_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id), -- optional: ถ้า addon สำหรับ item เฉพาะ
  addon_type_id UUID REFERENCES addon_types(id),
  addon_code TEXT NOT NULL,
  addon_name TEXT NOT NULL,
  
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(12,2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, ready, attached, completed
  
  -- Design (if needed)
  design_file_url TEXT,
  design_status TEXT, -- pending, approved
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_addons_order ON order_addons(order_id);

-- =============================================
-- 10. APPROVAL GATES (ประตูอนุมัติ)
-- =============================================
CREATE TABLE IF NOT EXISTS approval_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  gate_type TEXT NOT NULL, -- 'design', 'mockup', 'material', 'production_start'
  gate_name TEXT NOT NULL,
  
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  
  -- Approval
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  
  -- Customer Confirmation (for customer-facing gates)
  customer_confirmed_at TIMESTAMPTZ,
  customer_ip TEXT,
  customer_signature TEXT,
  
  -- Notes
  notes TEXT,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_approval_gates_order ON approval_gates(order_id);
CREATE INDEX idx_approval_gates_status ON approval_gates(status);

-- =============================================
-- 11. CHANGE REQUESTS (ใบขอแก้ไขงาน)
-- =============================================
CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE NOT NULL, -- 'CR-2024-0001'
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- What Phase
  order_phase TEXT NOT NULL, -- 'design', 'mockup_approved', 'in_production', 'qc_complete'
  
  -- What Changed
  change_type TEXT NOT NULL, -- 'design', 'quantity', 'size', 'color', 'add_work', 'remove_work', 'other'
  description TEXT NOT NULL,
  
  -- Impact
  affected_work_items UUID[], -- array of order_work_item ids
  
  -- Cost
  base_fee DECIMAL(10,2) DEFAULT 0,
  design_fee DECIMAL(10,2) DEFAULT 0,
  rework_fee DECIMAL(10,2) DEFAULT 0,
  material_fee DECIMAL(10,2) DEFAULT 0,
  total_fee DECIMAL(12,2) DEFAULT 0,
  
  -- Schedule Impact
  days_delayed INTEGER DEFAULT 0,
  new_due_date DATE,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, quoted, approved, rejected, completed
  
  -- Approval
  quoted_at TIMESTAMPTZ,
  quoted_by UUID REFERENCES user_profiles(id),
  customer_approved_at TIMESTAMPTZ,
  payment_status TEXT DEFAULT 'unpaid',
  
  -- Attachments
  reference_files TEXT[],
  
  -- Notes
  customer_reason TEXT,
  admin_notes TEXT,
  
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_change_requests_number ON change_requests(request_number);
CREATE INDEX idx_change_requests_order ON change_requests(order_id);

-- =============================================
-- 12. AUTO UPDATE TIMESTAMPS TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_change_requests_updated_at BEFORE UPDATE ON change_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- END OF PHASE 1 MIGRATION
-- =============================================


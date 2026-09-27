# Supabase Setup Guide

This guide explains how to set up the authentication and database backend for the Cafe Stock Management app using Supabase.

## 1. Create a Supabase Project
1. Go to [database.new](https://database.new) and create a new project.
2. Wait for the database to finish provisioning.

## 2. Get API Credentials
1. Go to **Project Settings** > **API**.
2. Copy the **Project URL** and the **anon public key**.
3. Create a `.env` file in the root of the React Native project based on `.env.example`:
```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Database Schema (SQL Editor)
Go to the **SQL Editor** in your Supabase dashboard and run the following script:

```sql
-- Create custom type for roles to enforce correctness
CREATE TYPE user_role AS ENUM ('MASTER_ADMIN', 'LEADER_BARISTA', 'LOGISTICS');

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- 1. Users can only read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING ((select auth.uid()) = id);

-- Note: Master Admins currently do not have global profile access.
-- Admin management permissions will be created in a future step using 
-- authorization mechanisms that do not cause recursive RLS.

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 4. Creating Test Accounts
Since this is an internal app without public registration, you must create accounts manually.

1. Go to **Authentication** > **Users** in Supabase.
2. Click **Add user** > **Create new user**.
3. Create three test users (e.g., `admin@cafe.com`, `barista@cafe.com`, `logistics@cafe.com`).

## 5. Assigning Roles
After creating the users, you need to assign them their roles in the `profiles` table.
Go to the **Table Editor** > `profiles` and insert new rows. 
Alternatively, use the SQL Editor:

```sql
-- Replace the UUIDs with the actual UUIDs from the Authentication tab
INSERT INTO profiles (id, full_name, role)
VALUES 
('insert-uuid-for-admin-here', 'Master Admin', 'MASTER_ADMIN'),
('insert-uuid-for-barista-here', 'Leader Barista', 'LEADER_BARISTA'),
('insert-uuid-for-logistics-here', 'Logistics Team', 'LOGISTICS');
```

## 6. Restart Expo
After setting the environment variables in `.env`, completely restart your Expo server so it picks up the variables:
```bash
npx expo start -c
```

## 7. Master Data Setup (Categories & Products)
Run the following SQL to set up the categories and products tables, along with secure authorization using a SECURITY DEFINER function.

```sql
-- 1. Create SECURITY DEFINER function to check MASTER_ADMIN role
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT role = 'MASTER_ADMIN' 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_master_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

-- 2. Create Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (TRIM(name) <> ''),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique constraint for category names
CREATE UNIQUE INDEX categories_name_idx ON public.categories (LOWER(name));

-- 3. Create Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (TRIM(name) <> ''),
  category_id UUID NOT NULL REFERENCES public.categories(id),
  unit TEXT NOT NULL CHECK (TRIM(unit) <> ''),
  safety_stock NUMERIC NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique constraint for product names within the same category
CREATE UNIQUE INDEX products_name_category_idx ON public.products (LOWER(name), category_id);

-- 4. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 5. Add triggers for updated_at
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS Policies for Categories
-- Everyone authenticated can read categories
CREATE POLICY "Authenticated users can read categories"
ON public.categories FOR SELECT
TO authenticated
USING (true);

-- Only MASTER_ADMIN can insert/update categories
CREATE POLICY "Master Admins can insert categories"
ON public.categories FOR INSERT
TO authenticated
WITH CHECK (public.is_master_admin());

CREATE POLICY "Master Admins can update categories"
ON public.categories FOR UPDATE
TO authenticated
USING (public.is_master_admin());

-- 7. RLS Policies for Products
-- Everyone authenticated can read products
CREATE POLICY "Authenticated users can read products"
ON public.products FOR SELECT
TO authenticated
USING (true);

-- Only MASTER_ADMIN can insert/update products
CREATE POLICY "Master Admins can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.is_master_admin());

CREATE POLICY "Master Admins can update products"
ON public.products FOR UPDATE
TO authenticated
USING (public.is_master_admin());
```

## 8. Stock Taking Setup
Run the following SQL to set up the stock taking tables, RPC function, and RLS.

```sql
-- 1. Create SECURITY DEFINER function to check LEADER_BARISTA role
CREATE OR REPLACE FUNCTION public.is_leader_barista()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT role = 'LEADER_BARISTA' 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_leader_barista() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leader_barista() TO authenticated;

-- 1b. Create SECURITY DEFINER function to check MASTER_ADMIN or LOGISTICS role
CREATE OR REPLACE FUNCTION public.is_admin_or_logistics()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT role IN ('MASTER_ADMIN', 'LOGISTICS')
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_logistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_logistics() TO authenticated;

-- 2. Create Stock Takings Header Table
CREATE TABLE public.stock_takings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_date DATE NOT NULL,
  shift_number SMALLINT NOT NULL CHECK (shift_number BETWEEN 1 AND 4),
  taken_by UUID NOT NULL REFERENCES auth.users(id),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(operational_date, shift_number)
);

-- 3. Create Stock Taking Items Table
CREATE TABLE public.stock_taking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_taking_id UUID NOT NULL REFERENCES public.stock_takings(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  actual_stock NUMERIC NOT NULL CHECK (actual_stock >= 0),
  safety_stock NUMERIC NOT NULL CHECK (safety_stock >= 0),
  stock_status TEXT NOT NULL CHECK (stock_status IN ('SAFE', 'NEED_PO', 'OUT_OF_STOCK')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stock_taking_id, product_id)
);

-- 4. Enable RLS
ALTER TABLE public.stock_takings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_taking_items ENABLE ROW LEVEL SECURITY;

-- 5. Add triggers for updated_at
CREATE TRIGGER update_stock_takings_updated_at
BEFORE UPDATE ON public.stock_takings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_taking_items_updated_at
BEFORE UPDATE ON public.stock_taking_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS Policies for Stock Takings
CREATE POLICY "Barista can insert own stock taking"
ON public.stock_takings FOR INSERT
TO authenticated
WITH CHECK (public.is_leader_barista() AND taken_by = auth.uid());

CREATE POLICY "Barista can read own stock taking"
ON public.stock_takings FOR SELECT
TO authenticated
USING (taken_by = auth.uid());

CREATE POLICY "Admin and Logistics can read all stock takings"
ON public.stock_takings FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 7. RLS Policies for Stock Taking Items
CREATE POLICY "Barista can insert own items"
ON public.stock_taking_items FOR INSERT
TO authenticated
WITH CHECK (
  public.is_leader_barista() AND 
  EXISTS (
    SELECT 1 FROM public.stock_takings 
    WHERE id = stock_taking_id AND taken_by = auth.uid()
  )
);

CREATE POLICY "Barista can read own items"
ON public.stock_taking_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stock_takings 
    WHERE id = stock_taking_id AND taken_by = auth.uid()
  )
);

CREATE POLICY "Admin and Logistics can read all items"
ON public.stock_taking_items FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 8. Create RPC for atomic Stock Taking save
-- p_items should be a JSON array: [{"product_id": "uuid", "actual_stock": 0}]
CREATE OR REPLACE FUNCTION public.save_stock_taking(
  p_shift_number SMALLINT,
  p_operational_date DATE,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stock_taking_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_actual_stock NUMERIC;
  v_safety_stock NUMERIC;
  v_stock_status TEXT;
  v_current_date DATE;
BEGIN
  -- Security Check
  IF NOT public.is_leader_barista() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Leader Barista can save stock taking';
  END IF;

  -- Validate Date (Not Future)
  v_current_date := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  IF p_operational_date > v_current_date THEN
    RAISE EXCEPTION 'INVALID_DATE: Operational date cannot be in the future';
  END IF;

  -- Validate Items not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA: Stock taking items cannot be empty';
  END IF;

  -- Validate for duplicate products in payload
  IF (SELECT count(*) FROM (SELECT DISTINCT v->>'product_id' FROM jsonb_array_elements(p_items) v) sub) < jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'INVALID_DATA: Duplicate product_id detected in payload';
  END IF;

  -- Insert Header
  INSERT INTO public.stock_takings (operational_date, shift_number, taken_by)
  VALUES (p_operational_date, p_shift_number, auth.uid())
  RETURNING id INTO v_stock_taking_id;

  -- Process Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_actual_stock := (v_item->>'actual_stock')::NUMERIC;
    
    IF v_actual_stock < 0 THEN
      RAISE EXCEPTION 'INVALID_DATA: Actual stock cannot be negative';
    END IF;

    -- Fetch and validate product (Must exist and be active)
    SELECT safety_stock INTO v_safety_stock
    FROM public.products
    WHERE id = v_product_id AND active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_PRODUCT: Product % does not exist or is inactive', v_product_id;
    END IF;

    -- Calculate Status
    IF v_actual_stock = 0 THEN
      v_stock_status := 'OUT_OF_STOCK';
    ELSIF v_actual_stock <= v_safety_stock THEN
      v_stock_status := 'NEED_PO';
    ELSE
      v_stock_status := 'SAFE';
    END IF;

    -- Insert Item
    INSERT INTO public.stock_taking_items (
      stock_taking_id,
      product_id,
      actual_stock,
      safety_stock,
      stock_status
    ) VALUES (
      v_stock_taking_id,
      v_product_id,
      v_actual_stock,
      v_safety_stock,
      v_stock_status
    );
  END LOOP;

  RETURN v_stock_taking_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_stock_taking(SMALLINT, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_stock_taking(SMALLINT, DATE, JSONB) TO authenticated;
```

## 9. Regular Purchase Order (PO) Setup
Run the following SQL to set up the Regular PO tables, receipt tracking, RPC functions, and RLS.

```sql
-- 1. Create SECURITY DEFINER function to check LOGISTICS role
CREATE OR REPLACE FUNCTION public.is_logistics()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT role = 'LOGISTICS' 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_logistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_logistics() TO authenticated;

-- 2. Create Purchase Orders Header Table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_date DATE NOT NULL,
  source_shift_number SMALLINT NOT NULL CHECK (source_shift_number IN (2, 4)),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'COMPLETE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Purchase Order Items Table
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  requested_quantity NUMERIC NOT NULL CHECK (requested_quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(purchase_order_id, product_id)
);

-- 4. Create Purchase Order Receipt Operations Table (Idempotency / Grouping)
CREATE TABLE public.purchase_order_receipt_operations (
  id UUID PRIMARY KEY, -- This acts as the UNIQUE(receipt_group_id) constraint
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4b. Create Purchase Order Receipts Table
CREATE TABLE public.purchase_order_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  receipt_group_id UUID NOT NULL REFERENCES public.purchase_order_receipt_operations(id) ON DELETE CASCADE,
  receiving_shift_number SMALLINT NOT NULL CHECK (receiving_shift_number BETWEEN 1 AND 4),
  receiving_operational_date DATE NOT NULL,
  provided_quantity NUMERIC NOT NULL CHECK (provided_quantity >= 0),
  received_by UUID NOT NULL REFERENCES auth.users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_receipt_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_receipts ENABLE ROW LEVEL SECURITY;

-- 6. Add triggers for updated_at
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_order_items_updated_at
BEFORE UPDATE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_order_receipts_updated_at
BEFORE UPDATE ON public.purchase_order_receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS Policies for Purchase Orders
CREATE POLICY "Barista can insert own PO"
ON public.purchase_orders FOR INSERT
TO authenticated
WITH CHECK (public.is_leader_barista() AND requested_by = auth.uid());

CREATE POLICY "Barista can read own PO"
ON public.purchase_orders FOR SELECT
TO authenticated
USING (requested_by = auth.uid());

CREATE POLICY "Admin and Logistics can read all POs"
ON public.purchase_orders FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 8. RLS Policies for Purchase Order Items
CREATE POLICY "Barista can insert own PO items"
ON public.purchase_order_items FOR INSERT
TO authenticated
WITH CHECK (
  public.is_leader_barista() AND 
  EXISTS (
    SELECT 1 FROM public.purchase_orders 
    WHERE id = purchase_order_id AND requested_by = auth.uid()
  )
);

CREATE POLICY "Barista can read own PO items"
ON public.purchase_order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders 
    WHERE id = purchase_order_id AND requested_by = auth.uid()
  )
);

CREATE POLICY "Admin and Logistics can read all PO items"
ON public.purchase_order_items FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 9. RLS Policies for Purchase Order Receipts
CREATE POLICY "Logistics can insert receipts"
ON public.purchase_order_receipts FOR INSERT
TO authenticated
WITH CHECK (public.is_logistics() AND received_by = auth.uid());

CREATE POLICY "Barista can read own PO receipts"
ON public.purchase_order_receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_order_items i
    JOIN public.purchase_orders o ON i.purchase_order_id = o.id
    WHERE i.id = purchase_order_item_id AND o.requested_by = auth.uid()
  )
);

CREATE POLICY "Admin and Logistics can read all receipts"
ON public.purchase_order_receipts FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 10. RPC: Create Regular PO (Leader Barista)
-- p_items: [{"product_id": "uuid", "requested_quantity": 0}]
CREATE OR REPLACE FUNCTION public.create_regular_po(
  p_operational_date DATE,
  p_source_shift_number SMALLINT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_po_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_requested_quantity NUMERIC;
  v_current_date DATE;
BEGIN
  IF NOT public.is_leader_barista() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Leader Barista can create Regular PO';
  END IF;

  IF p_source_shift_number NOT IN (2, 4) THEN
    RAISE EXCEPTION 'INVALID_SHIFT: Regular PO can only be requested on Shift 2 or Shift 4';
  END IF;

  v_current_date := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  IF p_operational_date > v_current_date THEN
    RAISE EXCEPTION 'INVALID_DATE: Operational date cannot be in the future';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA: PO items cannot be empty';
  END IF;

  IF (SELECT count(*) FROM (SELECT DISTINCT v->>'product_id' FROM jsonb_array_elements(p_items) v) sub) < jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'INVALID_DATA: Duplicate product_id detected in payload';
  END IF;

  -- Insert Header
  INSERT INTO public.purchase_orders (operational_date, source_shift_number, requested_by)
  VALUES (p_operational_date, p_source_shift_number, auth.uid())
  RETURNING id INTO v_po_id;

  -- Insert Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_requested_quantity := (v_item->>'requested_quantity')::NUMERIC;
    
    IF v_requested_quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_DATA: Requested quantity must be greater than 0';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product_id AND active = true) THEN
      RAISE EXCEPTION 'INVALID_PRODUCT: Product % does not exist or is inactive', v_product_id;
    END IF;

    INSERT INTO public.purchase_order_items (purchase_order_id, product_id, requested_quantity)
    VALUES (v_po_id, v_product_id, v_requested_quantity);
  END LOOP;

  RETURN v_po_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_regular_po(DATE, SMALLINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_regular_po(DATE, SMALLINT, JSONB) TO authenticated;

-- 11. RPC: Receive Regular PO (Logistics)
-- p_items: [{"purchase_order_item_id": "uuid", "provided_quantity": 0}]
CREATE OR REPLACE FUNCTION public.receive_regular_po(
  p_purchase_order_id UUID,
  p_receipt_group_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_po RECORD;
  v_receiving_shift SMALLINT;
  v_receiving_date DATE;
  v_item JSONB;
  v_poi_id UUID;
  v_provided NUMERIC;
  v_req_qty NUMERIC;
  v_prev_provided NUMERIC;
  v_total_provided NUMERIC;
  v_any_partial BOOLEAN := false;
  v_any_incomplete BOOLEAN := false;
BEGIN
  IF NOT public.is_logistics() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Logistics can receive PO';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA: Receiving items cannot be empty';
  END IF;

  -- Verify and Lock PO
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Purchase Order does not exist';
  END IF;

  -- Calculate receiving shift and date based on source rules
  IF v_po.source_shift_number = 2 THEN
    v_receiving_shift := 3;
    v_receiving_date := v_po.operational_date;
  ELSIF v_po.source_shift_number = 4 THEN
    v_receiving_shift := 2;
    v_receiving_date := v_po.operational_date + INTERVAL '1 day';
  ELSE
    RAISE EXCEPTION 'INVALID_PO: Not a Regular PO source shift';
  END IF;

  -- Idempotency check via UNIQUE constraint on operations table
  BEGIN
    INSERT INTO public.purchase_order_receipt_operations (id, purchase_order_id)
    VALUES (p_receipt_group_id, p_purchase_order_id);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'DUPLICATE_SUBMISSION: This receipt group has already been processed.';
  END;

  -- Process Receipt Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_poi_id := (v_item->>'purchase_order_item_id')::UUID;
    v_provided := (v_item->>'provided_quantity')::NUMERIC;
    
    IF v_provided < 0 THEN
      RAISE EXCEPTION 'INVALID_DATA: Provided quantity cannot be negative';
    END IF;

    -- Verify PO item belongs to this PO, and get requested quantity
    SELECT requested_quantity INTO v_req_qty 
    FROM public.purchase_order_items 
    WHERE id = v_poi_id AND purchase_order_id = p_purchase_order_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_ITEM: PO item % does not belong to this PO', v_poi_id;
    END IF;

    -- Anti Over-receive check
    SELECT COALESCE(SUM(provided_quantity), 0) INTO v_prev_provided
    FROM public.purchase_order_receipts
    WHERE purchase_order_item_id = v_poi_id;

    IF v_prev_provided + v_provided > v_req_qty THEN
      RAISE EXCEPTION 'OVER_RECEIVE_ERROR: Total provided quantity for item % would exceed the requested quantity of % (Prev: %, New: %)', v_poi_id, v_req_qty, v_prev_provided, v_provided;
    END IF;

    -- Insert Receipt Record
    INSERT INTO public.purchase_order_receipts (
      purchase_order_item_id,
      receipt_group_id,
      receiving_shift_number, 
      receiving_operational_date, 
      provided_quantity, 
      received_by
    )
    VALUES (
      v_poi_id,
      p_receipt_group_id,
      v_receiving_shift,
      v_receiving_date,
      v_provided,
      auth.uid()
    );
  END LOOP;

  -- Recalculate PO Status
  FOR v_req_qty, v_total_provided IN 
    SELECT i.requested_quantity, COALESCE(SUM(r.provided_quantity), 0)
    FROM public.purchase_order_items i
    LEFT JOIN public.purchase_order_receipts r ON i.id = r.purchase_order_item_id
    WHERE i.purchase_order_id = p_purchase_order_id
    GROUP BY i.id, i.requested_quantity
  LOOP
    IF v_total_provided = 0 THEN
      v_any_incomplete := true;
    ELSIF v_total_provided > 0 AND v_total_provided < v_req_qty THEN
      v_any_partial := true;
      v_any_incomplete := true;
    END IF;
  END LOOP;

  -- Update PO header status
  IF v_any_incomplete THEN
    IF v_any_partial OR EXISTS (
      SELECT 1 FROM public.purchase_order_receipts r
      JOIN public.purchase_order_items i ON r.purchase_order_item_id = i.id
      WHERE i.purchase_order_id = p_purchase_order_id AND r.provided_quantity > 0
    ) THEN
      UPDATE public.purchase_orders SET status = 'PARTIAL' WHERE id = p_purchase_order_id;
    ELSE
      UPDATE public.purchase_orders SET status = 'PENDING' WHERE id = p_purchase_order_id;
    END IF;
  ELSE
    UPDATE public.purchase_orders SET status = 'COMPLETE' WHERE id = p_purchase_order_id;
  END IF;

END;
$$;
REVOKE EXECUTE ON FUNCTION public.receive_regular_po(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_regular_po(UUID, UUID, JSONB) TO authenticated;
```

## 10. Urgent Purchase Order (PO) Setup

Run the following SQL in your Supabase SQL Editor to implement the Urgent PO module.

```sql
-- 1. Create Urgent Purchase Orders Table
CREATE TABLE public.urgent_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_date DATE NOT NULL,
  source_shift_number SMALLINT NOT NULL CHECK (source_shift_number BETWEEN 1 AND 4),
  receiving_shift_number SMALLINT NOT NULL CHECK (receiving_shift_number BETWEEN 1 AND 4),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'COMPLETE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Urgent Purchase Order Items Table
CREATE TABLE public.urgent_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urgent_purchase_order_id UUID NOT NULL REFERENCES public.urgent_purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  requested_quantity NUMERIC NOT NULL CHECK (requested_quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(urgent_purchase_order_id, product_id)
);

-- 3. Create Urgent Purchase Order Receipt Operations Table (Idempotency)
CREATE TABLE public.urgent_purchase_order_receipt_operations (
  id UUID PRIMARY KEY,
  urgent_purchase_order_id UUID NOT NULL REFERENCES public.urgent_purchase_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Urgent Purchase Order Receipts Table
CREATE TABLE public.urgent_purchase_order_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urgent_purchase_order_item_id UUID NOT NULL REFERENCES public.urgent_purchase_order_items(id) ON DELETE CASCADE,
  receipt_group_id UUID NOT NULL REFERENCES public.urgent_purchase_order_receipt_operations(id) ON DELETE CASCADE,
  receiving_shift_number SMALLINT NOT NULL CHECK (receiving_shift_number BETWEEN 1 AND 4),
  receiving_operational_date DATE NOT NULL,
  provided_quantity NUMERIC NOT NULL CHECK (provided_quantity >= 0),
  received_by UUID NOT NULL REFERENCES auth.users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE public.urgent_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgent_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgent_purchase_order_receipt_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgent_purchase_order_receipts ENABLE ROW LEVEL SECURITY;

-- 6. Add triggers for updated_at
CREATE TRIGGER update_urgent_purchase_orders_updated_at
BEFORE UPDATE ON public.urgent_purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_urgent_purchase_order_items_updated_at
BEFORE UPDATE ON public.urgent_purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_urgent_purchase_order_receipts_updated_at
BEFORE UPDATE ON public.urgent_purchase_order_receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS Policies for Urgent Purchase Orders
CREATE POLICY "Barista can insert own Urgent PO"
ON public.urgent_purchase_orders FOR INSERT
TO authenticated
WITH CHECK (public.is_leader_barista() AND requested_by = auth.uid());

CREATE POLICY "Barista can view own Urgent PO"
ON public.urgent_purchase_orders FOR SELECT
TO authenticated
USING (public.is_leader_barista() AND requested_by = auth.uid());

CREATE POLICY "Admin and Logistics can view all Urgent POs"
ON public.urgent_purchase_orders FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 8. RLS Policies for Urgent Purchase Order Items
CREATE POLICY "Barista can insert items for own Urgent PO"
ON public.urgent_purchase_order_items FOR INSERT
TO authenticated
WITH CHECK (
  public.is_leader_barista() AND 
  EXISTS (
    SELECT 1 FROM public.urgent_purchase_orders
    WHERE id = urgent_purchase_order_id AND requested_by = auth.uid()
  )
);

CREATE POLICY "Barista can view own Urgent PO items"
ON public.urgent_purchase_order_items FOR SELECT
TO authenticated
USING (
  public.is_leader_barista() AND 
  EXISTS (
    SELECT 1 FROM public.urgent_purchase_orders
    WHERE id = urgent_purchase_order_id AND requested_by = auth.uid()
  )
);

CREATE POLICY "Admin and Logistics can view all Urgent PO items"
ON public.urgent_purchase_order_items FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 9. RLS Policies for Urgent Purchase Order Receipts
-- Logistics will insert through RPC, no direct insert policy needed
-- Operations table is intentionally left without policies (default deny)

CREATE POLICY "Barista can view receipts for own Urgent PO"
ON public.urgent_purchase_order_receipts FOR SELECT
TO authenticated
USING (
  public.is_leader_barista() AND 
  EXISTS (
    SELECT 1 FROM public.urgent_purchase_order_items i
    JOIN public.urgent_purchase_orders o ON i.urgent_purchase_order_id = o.id
    WHERE i.id = urgent_purchase_order_item_id AND o.requested_by = auth.uid()
  )
);

CREATE POLICY "Admin and Logistics can view all Urgent PO receipts"
ON public.urgent_purchase_order_receipts FOR SELECT
TO authenticated
USING (public.is_admin_or_logistics());

-- 10. RPC: Create Urgent PO (Barista)
-- p_items: [{"product_id": "uuid", "requested_quantity": 0}]
CREATE OR REPLACE FUNCTION public.create_urgent_po(
  p_operational_date DATE,
  p_source_shift_number SMALLINT,
  p_receiving_shift_number SMALLINT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_po_id UUID;
  v_item JSONB;
  v_prod_id UUID;
  v_qty NUMERIC;
BEGIN
  IF NOT public.is_leader_barista() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Leader Barista can create Urgent PO';
  END IF;

  IF p_source_shift_number NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'INVALID_DATA: Source Shift must be between 1 and 4';
  END IF;

  IF p_receiving_shift_number NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'INVALID_DATA: Receiving Shift must be between 1 and 4';
  END IF;

  IF p_operational_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'INVALID_DATA: Operational Date cannot be in the future';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA: Items array cannot be empty';
  END IF;

  -- Create Header
  INSERT INTO public.urgent_purchase_orders (
    operational_date,
    source_shift_number,
    receiving_shift_number,
    requested_by,
    status
  )
  VALUES (
    p_operational_date,
    p_source_shift_number,
    p_receiving_shift_number,
    auth.uid(),
    'PENDING'
  )
  RETURNING id INTO v_po_id;

  -- Insert Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'requested_quantity')::NUMERIC;
    
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_DATA: Requested quantity must be greater than 0';
    END IF;

    -- Verify product exists and is active
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_prod_id AND is_active = true) THEN
      RAISE EXCEPTION 'INVALID_ITEM: Product % is invalid or inactive', v_prod_id;
    END IF;

    INSERT INTO public.urgent_purchase_order_items (
      urgent_purchase_order_id, product_id, requested_quantity
    )
    VALUES (
      v_po_id, v_prod_id, v_qty
    );
  END LOOP;

  RETURN v_po_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_urgent_po(DATE, SMALLINT, SMALLINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_urgent_po(DATE, SMALLINT, SMALLINT, JSONB) TO authenticated;

-- 11. RPC: Receive Urgent PO (Logistics)
CREATE OR REPLACE FUNCTION public.receive_urgent_po(
  p_urgent_purchase_order_id UUID,
  p_receipt_group_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_po RECORD;
  v_receiving_shift SMALLINT;
  v_receiving_date DATE;
  v_item JSONB;
  v_poi_id UUID;
  v_provided NUMERIC;
  v_req_qty NUMERIC;
  v_prev_provided NUMERIC;
  v_total_provided NUMERIC;
  v_any_partial BOOLEAN := false;
  v_any_incomplete BOOLEAN := false;
BEGIN
  IF NOT public.is_logistics() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Logistics can receive PO';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA: Receiving items cannot be empty';
  END IF;

  -- Verify and Lock PO
  SELECT * INTO v_po FROM public.urgent_purchase_orders WHERE id = p_urgent_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Urgent Purchase Order does not exist';
  END IF;

  -- Get exact destination shift and date from Header (Not Client)
  v_receiving_shift := v_po.receiving_shift_number;
  v_receiving_date := v_po.operational_date;

  -- Idempotency check via UNIQUE constraint on operations table
  BEGIN
    INSERT INTO public.urgent_purchase_order_receipt_operations (id, urgent_purchase_order_id)
    VALUES (p_receipt_group_id, p_urgent_purchase_order_id);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'DUPLICATE_SUBMISSION: This receipt group has already been processed.';
  END;

  -- Process Receipt Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_poi_id := (v_item->>'urgent_purchase_order_item_id')::UUID;
    v_provided := (v_item->>'provided_quantity')::NUMERIC;
    
    IF v_provided < 0 THEN
      RAISE EXCEPTION 'INVALID_DATA: Provided quantity cannot be negative';
    END IF;

    -- Verify PO item belongs to this PO, and get requested quantity
    SELECT requested_quantity INTO v_req_qty 
    FROM public.urgent_purchase_order_items 
    WHERE id = v_poi_id AND urgent_purchase_order_id = p_urgent_purchase_order_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_ITEM: PO item % does not belong to this PO', v_poi_id;
    END IF;


    -- Insert Receipt Record
    INSERT INTO public.urgent_purchase_order_receipts (
      urgent_purchase_order_item_id,
      receipt_group_id,
      receiving_shift_number, 
      receiving_operational_date, 
      provided_quantity, 
      received_by
    )
    VALUES (
      v_poi_id,
      p_receipt_group_id,
      v_receiving_shift,
      v_receiving_date,
      v_provided,
      auth.uid()
    );
  END LOOP;

  -- Recalculate PO Status
  FOR v_req_qty, v_total_provided IN 
    SELECT i.requested_quantity, COALESCE(SUM(r.provided_quantity), 0)
    FROM public.urgent_purchase_order_items i
    LEFT JOIN public.urgent_purchase_order_receipts r ON i.id = r.urgent_purchase_order_item_id
    WHERE i.urgent_purchase_order_id = p_urgent_purchase_order_id
    GROUP BY i.id, i.requested_quantity
  LOOP
    IF v_total_provided = 0 THEN
      v_any_incomplete := true;
    ELSIF v_total_provided > 0 AND v_total_provided < v_req_qty THEN
      v_any_partial := true;
      v_any_incomplete := true;
    END IF;
  END LOOP;

  -- Update PO header status
  IF v_any_incomplete THEN
    IF v_any_partial OR EXISTS (
      SELECT 1 FROM public.urgent_purchase_order_receipts r
      JOIN public.urgent_purchase_order_items i ON r.urgent_purchase_order_item_id = i.id
      WHERE i.urgent_purchase_order_id = p_urgent_purchase_order_id AND r.provided_quantity > 0
    ) THEN
      UPDATE public.urgent_purchase_orders SET status = 'PARTIAL' WHERE id = p_urgent_purchase_order_id;
    ELSE
      UPDATE public.urgent_purchase_orders SET status = 'PENDING' WHERE id = p_urgent_purchase_order_id;
    END IF;
  ELSE
    UPDATE public.urgent_purchase_orders SET status = 'COMPLETE' WHERE id = p_urgent_purchase_order_id;
  END IF;

END;
$$;
REVOKE EXECUTE ON FUNCTION public.receive_urgent_po(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_urgent_po(UUID, UUID, JSONB) TO authenticated;
```

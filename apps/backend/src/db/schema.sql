-- ROLLIFY POS - Production PostgreSQL Relational Database Schema
-- Version 1.0.0

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN')),
    pin_code VARCHAR(6),
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_pin_code ON users(pin_code) WHERE pin_code IS NOT NULL;

-- 2. DINING TABLES & FLOOR AREAS
CREATE TABLE IF NOT EXISTS dining_tables (
    id VARCHAR(50) PRIMARY KEY,
    table_number VARCHAR(20) UNIQUE NOT NULL,
    section VARCHAR(50) NOT NULL DEFAULT 'Main Dining',
    capacity INTEGER NOT NULL DEFAULT 4,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY')),
    current_order_id VARCHAR(50),
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dining_tables_status ON dining_tables(status);
CREATE INDEX IF NOT EXISTS idx_dining_tables_qr_token ON dining_tables(qr_token);

-- 3. MENU CATEGORIES & ITEMS
CREATE TABLE IF NOT EXISTS menu_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_slug ON menu_categories(slug);
CREATE INDEX IF NOT EXISTS idx_menu_categories_order ON menu_categories(display_order);

CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (tax_rate >= 0),
    is_veg BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_chef_special BOOLEAN NOT NULL DEFAULT FALSE,
    is_spicy BOOLEAN NOT NULL DEFAULT FALSE,
    image_url TEXT,
    prep_time_minutes INTEGER NOT NULL DEFAULT 10,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

CREATE TABLE IF NOT EXISTS menu_item_variants (
    id VARCHAR(50) PRIMARY KEY,
    menu_item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    variant_name VARCHAR(50) NOT NULL, -- 'REG', 'LRG', 'Standard'
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_item_variant UNIQUE(menu_item_id, variant_name)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_variants_item ON menu_item_variants(menu_item_id);

-- Migration safety for existing tables
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_chef_special BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_spicy BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. INVENTORY, RECIPES & STOCK LEDGER
CREATE TABLE IF NOT EXISTS ingredients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(20) NOT NULL CHECK (unit IN ('kg', 'g', 'l', 'ml', 'pcs', 'portion')),
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (current_stock >= 0),
    min_threshold NUMERIC(12, 3) NOT NULL DEFAULT 5.000,
    cost_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cost_per_unit >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingredients_stock ON ingredients(current_stock);

CREATE TABLE IF NOT EXISTS menu_item_recipes (
    id VARCHAR(50) PRIMARY KEY,
    menu_item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id VARCHAR(50) NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_recipe_item_ingredient UNIQUE(menu_item_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON menu_item_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient ON menu_item_recipes(ingredient_id);

CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(50) PRIMARY KEY,
    ingredient_id VARCHAR(50) NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('PURCHASE', 'CONSUMPTION', 'WASTAGE', 'ADJUSTMENT', 'REVERSAL')),
    quantity NUMERIC(12, 3) NOT NULL,
    balance_after NUMERIC(12, 3) NOT NULL,
    reference_id VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- 5. ORDERS & ORDER ITEMS
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(30) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'DINE_IN' CHECK (order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR_CUSTOMER')),
    table_id VARCHAR(50) REFERENCES dining_tables(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED')),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED')),
    notes TEXT,
    waiter_id VARCHAR(50) REFERENCES users(id),
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    variant_id VARCHAR(50) REFERENCES menu_item_variants(id) ON DELETE SET NULL,
    variant_name VARCHAR(50),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    notes TEXT,
    item_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (item_status IN ('PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);

CREATE TABLE IF NOT EXISTS order_timeline (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    notes TEXT,
    performed_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_created_at ON order_timeline(created_at);

-- 6. BILLING & PAYMENTS
CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(50) PRIMARY KEY,
    bill_number VARCHAR(30) UNIQUE NOT NULL,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    gross_amount NUMERIC(10, 2) NOT NULL CHECK (gross_amount >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    discount_reason VARCHAR(150),
    taxable_amount NUMERIC(10, 2) NOT NULL CHECK (taxable_amount >= 0),
    tax_amount NUMERIC(10, 2) NOT NULL CHECK (tax_amount >= 0),
    net_amount NUMERIC(10, 2) NOT NULL CHECK (net_amount >= 0),
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED')),
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bills_order ON bills(order_id);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(50) PRIMARY KEY,
    bill_id VARCHAR(50) NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'SPLIT')),
    transaction_reference VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'REFUNDED', 'FAILED')),
    received_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- 7. VENDORS & EXPENSES
CREATE TABLE IF NOT EXISTS vendors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    current_liability NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(50) PRIMARY KEY,
    vendor_id VARCHAR(50) REFERENCES vendors(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('RAW_MATERIALS', 'UTILITIES', 'RENT', 'MAINTENANCE', 'PACKAGING', 'SALARY', 'OTHER')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PENDING_LIABILITY')),
    payment_method VARCHAR(20) CHECK (payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER')),
    description TEXT NOT NULL,
    receipt_url TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 8. SHIFT & DAY CLOSING
CREATE TABLE IF NOT EXISTS day_closings (
    id VARCHAR(50) PRIMARY KEY,
    business_date DATE UNIQUE NOT NULL,
    opening_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cash_sales NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_upi_sales NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_card_sales NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_discounts NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_refunds NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_expenses_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    expected_cash_in_drawer NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    actual_cash_counted NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cash_variance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    closed_by VARCHAR(50) REFERENCES users(id),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_day_closings_date ON day_closings(business_date);

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('AUTH', 'PAYMENT', 'ORDER', 'INVENTORY', 'EXPENSE', 'DAY_CLOSE', 'USER', 'SYSTEM')),
    entity_id VARCHAR(50),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 10. STAFF SHIFTS & ATTENDANCE
CREATE TABLE IF NOT EXISTS staff_shifts (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clock_out TIMESTAMPTZ,
    total_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 120.00,
    shift_wage NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_user ON staff_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON staff_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON staff_shifts(status);

ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 120.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10, 2) NOT NULL DEFAULT 25000.00;

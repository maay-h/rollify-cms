import { OFFICIAL_CATEGORIES, OFFICIAL_MENU_ITEMS } from './officialMenu.js';

export interface DemoUser {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';
  pin_code: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'usr-admin-01', username: 'admin', email: 'admin@rollify.com', role: 'ADMIN', pin_code: '1111', full_name: 'System Admin', phone: '+91 98455 71817', is_active: true },
  { id: 'usr-mgr-01', username: 'manager', email: 'manager@rollify.com', role: 'MANAGER', pin_code: '2222', full_name: 'Cafe Manager', phone: '+91 96116 39964', is_active: true },
  { id: 'usr-cashier-01', username: 'cashier', email: 'cashier@rollify.com', role: 'CASHIER', pin_code: '3333', full_name: 'Cafe Cashier', phone: '+91 96119 64366', is_active: true },
  { id: 'usr-waiter-01', username: 'waiter', email: 'waiter@rollify.com', role: 'WAITER', pin_code: '4444', full_name: 'Floor Waiter', phone: '+91 98765 43213', is_active: true },
  { id: 'usr-kitchen-01', username: 'kitchen', email: 'kitchen@rollify.com', role: 'KITCHEN', pin_code: '5555', full_name: 'Kitchen Staff', phone: '+91 98765 43214', is_active: true },
];

export const DEMO_TABLES = [
  { id: 'tbl-01', table_number: 'T-01', section: 'Main Indoor', capacity: 4, status: 'OCCUPIED', qr_token: 'QR_TBL_01_ROL' },
  { id: 'tbl-02', table_number: 'T-02', section: 'Main Indoor', capacity: 2, status: 'AVAILABLE', qr_token: 'QR_TBL_02_ROL' },
  { id: 'tbl-03', table_number: 'T-03', section: 'Main Indoor', capacity: 6, status: 'AVAILABLE', qr_token: 'QR_TBL_03_ROL' },
  { id: 'tbl-04', table_number: 'T-04', section: 'Main Indoor', capacity: 4, status: 'OCCUPIED', qr_token: 'QR_TBL_04_ROL' },
  { id: 'tbl-05', table_number: 'T-05', section: 'Garden Patio', capacity: 4, status: 'AVAILABLE', qr_token: 'QR_TBL_05_ROL' },
  { id: 'tbl-06', table_number: 'T-06', section: 'Garden Patio', capacity: 4, status: 'AVAILABLE', qr_token: 'QR_TBL_06_ROL' },
  { id: 'tbl-07', table_number: 'T-07', section: 'Balcony View', capacity: 2, status: 'AVAILABLE', qr_token: 'QR_TBL_07_ROL' },
  { id: 'tbl-08', table_number: 'T-08', section: 'Balcony View', capacity: 2, status: 'AVAILABLE', qr_token: 'QR_TBL_08_ROL' },
  { id: 'tbl-09', table_number: 'BAR-01', section: 'Quick Counter', capacity: 1, status: 'AVAILABLE', qr_token: 'QR_BAR_01_ROL' },
  { id: 'tbl-10', table_number: 'BAR-02', section: 'Quick Counter', capacity: 1, status: 'AVAILABLE', qr_token: 'QR_BAR_02_ROL' },
];

function getProductImage(categoryId: string, name: string): string {
  const n = name.toLowerCase();
  if (n.includes('espresso')) return 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&q=80';
  if (n.includes('cappuccino')) return 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&q=80';
  if (n.includes('latte')) return 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&q=80';
  if (n.includes('cold coffee') || n.includes('cold brew')) return 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&q=80';
  if (n.includes('macchiato') || n.includes('mocha')) return 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=500&q=80';
  if (n.includes('chai') || n.includes('tea')) return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80';
  if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80';
  if (n.includes('fries')) return 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&q=80';
  if (n.includes('sandwich')) return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80';
  if (n.includes('lava') || n.includes('brownie') || n.includes('cake') || n.includes('dessert')) return 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&q=80';
  if (n.includes('shake')) return 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80';
  if (n.includes('mojito')) return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80';
  if (n.includes('wing') || n.includes('popcorn') || n.includes('lollipop') || n.includes('strip')) return 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500&q=80';
  if (n.includes('roll') || n.includes('wrap')) return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&q=80';
  if (n.includes('rice') || n.includes('bowl')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
  if (n.includes('water') || n.includes('coke') || n.includes('drink') || n.includes('beverage')) return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&q=80';
  return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80';
}

export const DEMO_CATEGORIES = OFFICIAL_CATEGORIES;

export const DEMO_MENU_ITEMS = OFFICIAL_MENU_ITEMS.map((item) => {
  const cat = OFFICIAL_CATEGORIES.find((c) => c.id === item.category_id);
  const variants = item.variants && item.variants.length > 0
    ? item.variants.map((v, i) => ({
        id: `var-${item.id}-${v.name.toLowerCase()}`,
        variant_name: v.name,
        price: v.price,
        is_available: true,
      }))
    : [{
        id: `var-${item.id}-single`,
        variant_name: 'Single',
        price: item.price,
        is_available: true,
      }];

  return {
    id: item.id,
    category_id: item.category_id,
    category_name: cat ? cat.name : 'Cafe Spec',
    name: item.name,
    description: item.description || '',
    price: item.price.toString(),
    tax_rate: '5.00',
    is_veg: item.is_veg,
    is_available: true,
    is_chef_special: item.is_chef_special || false,
    is_spicy: item.is_spicy || false,
    image_url: (item as any).image_url || getProductImage(item.category_id, item.name),
    prep_time_minutes: item.prep_time_minutes || 6,
    variants,
  };
});

export const DEMO_INGREDIENTS = [
  { id: 'ing-flour-wrap', name: 'Handcrafted Paratha Wraps', unit: 'pcs', current_stock: 450, min_threshold: 50, cost_per_unit: 7, stock_valuation: 3150, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-chicken', name: 'Fresh Boneless Chicken', unit: 'kg', current_stock: 48, min_threshold: 10, cost_per_unit: 240, stock_valuation: 11520, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-paneer', name: 'Fresh Malai Paneer', unit: 'kg', current_stock: 28, min_threshold: 8, cost_per_unit: 320, stock_valuation: 8960, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-cheese', name: 'Processed Cheddar Cheese', unit: 'kg', current_stock: 18, min_threshold: 5, cost_per_unit: 420, stock_valuation: 7560, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-egg', name: 'Farm Fresh Eggs', unit: 'pcs', current_stock: 240, min_threshold: 40, cost_per_unit: 6, stock_valuation: 1440, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-fries', name: 'Skinny Cut Potato Fries', unit: 'kg', current_stock: 65, min_threshold: 15, cost_per_unit: 95, stock_valuation: 6175, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-burger-bun', name: 'Brioche Burger Buns', unit: 'pcs', current_stock: 120, min_threshold: 25, cost_per_unit: 15, stock_valuation: 1800, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-garlic-mayo', name: 'House Toum Garlic Mayo', unit: 'l', current_stock: 22, min_threshold: 5, cost_per_unit: 160, stock_valuation: 3520, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-peri-peri', name: 'Signature Peri Peri Seasoning', unit: 'kg', current_stock: 2.5, min_threshold: 3, cost_per_unit: 350, stock_valuation: 875, stock_status: 'LOW_STOCK', is_active: true },
  { id: 'ing-milk', name: 'Pasteurized Full Cream Milk', unit: 'l', current_stock: 45, min_threshold: 10, cost_per_unit: 68, stock_valuation: 3060, stock_status: 'OPTIMAL', is_active: true },
  { id: 'ing-ice-cream', name: 'Vanilla Ice Cream Base', unit: 'kg', current_stock: 18, min_threshold: 5, cost_per_unit: 180, stock_valuation: 3240, stock_status: 'OPTIMAL', is_active: true },
];

export const DEMO_VENDORS = [
  { id: 'ven-01', name: 'Fresh Poultry & Farm Wholesale', contact_person: 'Rajesh Verma', phone: '+91 98451 12233', email: 'poultry@freshfarm.in', address: 'APMC Market Yard, Bengaluru', current_liability: 12000, total_business_volume: 45000, total_invoices: 4 },
  { id: 'ven-02', name: 'Dairy Pure & Malai Paneer Hub', contact_person: 'Amit Patel', phone: '+91 98452 23344', email: 'orders@dairypure.com', address: 'Dairy Circle, Bannerghatta Rd', current_liability: 0, total_business_volume: 28000, total_invoices: 3 },
  { id: 'ven-03', name: 'Metro Eco Packaging & Paper', contact_person: 'Sunil Rao', phone: '+91 98453 34455', email: 'sales@metropack.co', address: 'Peenya Industrial Area', current_liability: 3500, total_business_volume: 16500, total_invoices: 2 },
  { id: 'ven-04', name: 'Rollify Store Realty & Estates', contact_person: 'Anand Kumar', phone: '+91 98454 45566', email: 'lease@indiranagar.realty', address: '100ft Road, Indiranagar', current_liability: 0, total_business_volume: 90000, total_invoices: 2 },
  { id: 'ven-05', name: 'Commercial Gas & Utility Corp', contact_person: 'Utility Desk', phone: '+91 98455 56677', email: 'gas@commercialenergy.in', address: 'Domlur Sub-Station', current_liability: 0, total_business_volume: 17000, total_invoices: 2 },
];

export const DEMO_EXPENSES = [
  { id: 'exp-01', vendor_id: 'ven-04', vendor_name: 'Rollify Store Realty & Estates', category: 'RENT' as const, amount: 45000, payment_status: 'PAID' as const, payment_method: 'BANK_TRANSFER' as const, description: 'Monthly store rent for Rollify flagship outlet', expense_date: '2026-11-01', created_by_name: 'System Admin' },
  { id: 'exp-02', vendor_id: 'ven-05', vendor_name: 'Commercial Gas & Utility Corp', category: 'UTILITIES' as const, amount: 8500, payment_status: 'PAID' as const, payment_method: 'UPI' as const, description: 'Commercial LPG cylinders (x4) and utility bill', expense_date: '2026-11-05', created_by_name: 'Cafe Manager' },
  { id: 'exp-03', vendor_id: 'ven-03', vendor_name: 'Metro Eco Packaging & Paper', category: 'PACKAGING' as const, amount: 6200, payment_status: 'PAID' as const, payment_method: 'UPI' as const, description: 'Branded butter paper, foil wraps, parcel containers', expense_date: '2026-11-10', created_by_name: 'Cafe Manager' },
  { id: 'exp-04', vendor_id: 'ven-01', vendor_name: 'Fresh Poultry & Farm Wholesale', category: 'RAW_MATERIALS' as const, amount: 12000, payment_status: 'PENDING_LIABILITY' as const, description: 'Fresh chicken supply credit invoice #PV-8831', expense_date: '2026-11-18', created_by_name: 'System Admin' },
];

export const DEMO_INITIAL_ORDERS = [
  {
    id: 'ord-01',
    order_number: 'ROL-20261122-001',
    order_type: 'DINE_IN',
    table_id: 'tbl-01',
    table_number: 'T-01',
    table_section: 'Main Indoor',
    customer_name: 'Priya Sharma',
    customer_phone: '+91 98450 11223',
    status: 'PREPARING',
    order_notes: 'Extra spicy chicken roll, mint dip on side',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    elapsed_minutes: 12,
    total_amount: '417.90',
    items: [
      { id: 'oit-01', order_id: 'ord-01', menu_item_id: 'rnv-05', item_name: 'Rollify Signature Chicken Roll', variant_name: 'LRG', quantity: 2, unit_price: '169.00', subtotal: '338.00', item_status: 'PREPARING', is_veg: false, prep_time_minutes: 8 },
      { id: 'oit-02', order_id: 'ord-01', menu_item_id: 'fry-02', item_name: 'Peri Peri Fries', variant_name: 'REG', quantity: 1, unit_price: '99.00', subtotal: '99.00', item_status: 'PREPARING', is_veg: true, prep_time_minutes: 5 },
    ],
  },
  {
    id: 'ord-02',
    order_number: 'ROL-20261122-002',
    order_type: 'DINE_IN',
    table_id: 'tbl-04',
    table_number: 'T-04',
    table_section: 'Main Indoor',
    customer_name: 'Amitabh Sen',
    customer_phone: '+91 98450 99887',
    status: 'READY',
    order_notes: 'Served hot with fries',
    created_at: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    elapsed_minutes: 6,
    total_amount: '354.90',
    items: [
      { id: 'oit-03', order_id: 'ord-02', menu_item_id: 'bgr-01', item_name: 'Chicken Zinger Burger + Fries', variant_name: 'Single', quantity: 1, unit_price: '189.00', subtotal: '189.00', item_status: 'READY', is_veg: false, prep_time_minutes: 7 },
      { id: 'oit-04', order_id: 'ord-02', menu_item_id: 'moj-01', item_name: 'Virgin Mojito', variant_name: 'Single', quantity: 1, unit_price: '149.00', subtotal: '149.00', item_status: 'READY', is_veg: true, prep_time_minutes: 3 },
    ],
  },
];

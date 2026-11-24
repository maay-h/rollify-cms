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
  { id: 'usr-cashier-01', username: 'cashier', email: 'cashier@rollify.com', role: 'CASHIER', pin_code: '3333', full_name: 'Cafe Cashier', phone: '+91 96119 64366', is_active: true },
  { id: 'usr-waiter-01', username: 'waiter', email: 'waiter@rollify.com', role: 'WAITER', pin_code: '4444', full_name: 'Floor Waiter', phone: '+91 98765 43213', is_active: true },
  { id: 'usr-kitchen-01', username: 'kitchen', email: 'kitchen@rollify.com', role: 'KITCHEN', pin_code: '5555', full_name: 'Kitchen Staff', phone: '+91 98765 43214', is_active: true },
];

export const DEMO_TABLES = [
  { id: 'tbl-01', table_number: 'T-01', section: 'Main Indoor', capacity: 4, status: 'AVAILABLE', qr_token: 'QR_TBL_01_ROL' },
  { id: 'tbl-02', table_number: 'T-02', section: 'Main Indoor', capacity: 2, status: 'AVAILABLE', qr_token: 'QR_TBL_02_ROL' },
  { id: 'tbl-03', table_number: 'T-03', section: 'Main Indoor', capacity: 6, status: 'AVAILABLE', qr_token: 'QR_TBL_03_ROL' },
  { id: 'tbl-04', table_number: 'T-04', section: 'Main Indoor', capacity: 4, status: 'AVAILABLE', qr_token: 'QR_TBL_04_ROL' },
  { id: 'tbl-05', table_number: 'T-05', section: 'Garden Patio', capacity: 4, status: 'AVAILABLE', qr_token: 'QR_TBL_05_ROL' },
  { id: 'tbl-06', table_number: 'T-06', section: 'Garden Patio', capacity: 4, status: 'AVAILABLE', qr_token: 'QR_TBL_06_ROL' },
  { id: 'tbl-07', table_number: 'T-07', section: 'Balcony View', capacity: 2, status: 'AVAILABLE', qr_token: 'QR_TBL_07_ROL' },
  { id: 'tbl-08', table_number: 'T-08', section: 'Balcony View', capacity: 2, status: 'AVAILABLE', qr_token: 'QR_TBL_08_ROL' },
  { id: 'tbl-09', table_number: 'BAR-01', section: 'Quick Counter', capacity: 1, status: 'AVAILABLE', qr_token: 'QR_BAR_01_ROL' },
  { id: 'tbl-10', table_number: 'BAR-02', section: 'Quick Counter', capacity: 1, status: 'AVAILABLE', qr_token: 'QR_BAR_02_ROL' },
];

export function getProductImage(categoryId: string, name: string): string {
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

export const DEMO_VENDORS: any[] = [];

export const DEMO_EXPENSES: any[] = [];

export const DEMO_INITIAL_ORDERS: any[] = [];

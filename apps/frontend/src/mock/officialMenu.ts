export interface SeedCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  display_order: number;
}

export interface SeedVariant {
  name: 'REG' | 'LRG' | 'Single';
  price: number;
}

export interface SeedMenuItem {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number; // default/base price
  is_veg: boolean;
  is_chef_special?: boolean;
  is_spicy?: boolean;
  prep_time_minutes: number;
  variants?: SeedVariant[];
}

export const OFFICIAL_CATEGORIES: SeedCategory[] = [
  { id: 'cat-starters-nv', name: 'Starters – Non-Veg', slug: 'starters-non-veg', description: 'Crispy wings, pops, tikkas and lollipops', display_order: 1 },
  { id: 'cat-starters-veg', name: 'Starters – Veg', slug: 'starters-veg', description: 'Crispy paneer, kurkure, mushrooms and tandoori bites', display_order: 2 },
  { id: 'cat-rolls-nv', name: 'Rolls – Non-Veg', slug: 'rolls-non-veg', description: 'Hand-rolled warm paratha rolls loaded with chicken & egg', display_order: 3 },
  { id: 'cat-rolls-veg', name: 'Rolls – Veg', slug: 'rolls-veg', description: 'Signature veg, paneer tikka, and Mexican wraps', display_order: 4 },
  { id: 'cat-fries', name: 'Fries', slug: 'fries', description: 'Classic, peri-peri, and overloaded gourmet fries', display_order: 5 },
  { id: 'cat-sandwich', name: 'Sandwich', slug: 'sandwich', description: 'Toasted club sandwiches served with crispy golden fries', display_order: 6 },
  { id: 'cat-rice-bowl', name: 'Rice Bowl', slug: 'rice-bowl', description: 'Flavourful seasoned rice bowls with fresh toppings', display_order: 7 },
  { id: 'cat-burgers', name: 'Burgers', slug: 'burgers', description: 'Brioche burgers with crunchy patties and fries', display_order: 8 },
  { id: 'cat-byob', name: 'BYOB', slug: 'byob', description: 'Build Your Own Bowl / Roll custom creations', display_order: 9 },
  { id: 'cat-combo', name: 'Combo', slug: 'combo', description: 'Value meal combinations with sides and beverage', display_order: 10 },
  { id: 'cat-dips', name: 'Dips', slug: 'dips', description: 'House-crafted signature artisanal dips', display_order: 11 },
  { id: 'cat-addons', name: 'Add-Ons', slug: 'add-ons', description: 'Extra cheese, egg, peri peri seasoning and drinks', display_order: 12 },
  { id: 'cat-shakes', name: 'Thick Shakes', slug: 'thick-shakes', description: 'Rich creamy artisanal dairy thickshakes and coffees', display_order: 13 },
  { id: 'cat-mojitos', name: "Mojito's", slug: 'mojitos', description: 'Refreshing sparkling fruit coolers with fresh mint and citrus', display_order: 14 },
  { id: 'cat-beverages', name: 'Beverages', slug: 'beverages', description: 'Chilled packaged water and soft beverages', display_order: 15 },
];

export const OFFICIAL_MENU_ITEMS: SeedMenuItem[] = [
  // 1. STARTERS – NON-VEG
  {
    id: 'snv-01',
    category_id: 'cat-starters-nv',
    name: 'Chicken Popcorn',
    price: 129,
    is_veg: false,
    prep_time_minutes: 6,
    variants: [{ name: 'REG', price: 129 }, { name: 'LRG', price: 159 }],
  },
  {
    id: 'snv-02',
    category_id: 'cat-starters-nv',
    name: 'Peri Peri Wings',
    price: 139,
    is_veg: false,
    is_spicy: true,
    prep_time_minutes: 8,
    variants: [{ name: 'REG', price: 139 }, { name: 'LRG', price: 179 }],
  },
  {
    id: 'snv-03',
    category_id: 'cat-starters-nv',
    name: 'BBQ Hot Wings',
    price: 139,
    is_veg: false,
    prep_time_minutes: 8,
    variants: [{ name: 'REG', price: 139 }, { name: 'LRG', price: 179 }],
  },
  {
    id: 'snv-04',
    category_id: 'cat-starters-nv',
    name: 'Crispy Hot Wings',
    price: 139,
    is_veg: false,
    is_spicy: true,
    prep_time_minutes: 8,
    variants: [{ name: 'REG', price: 139 }, { name: 'LRG', price: 179 }],
  },
  {
    id: 'snv-05',
    category_id: 'cat-starters-nv',
    name: 'Chicken Strips',
    price: 149,
    is_veg: false,
    prep_time_minutes: 7,
    variants: [{ name: 'REG', price: 149 }, { name: 'LRG', price: 189 }],
  },
  {
    id: 'snv-06',
    category_id: 'cat-starters-nv',
    name: 'Crispy Lollipop',
    price: 139,
    is_veg: false,
    prep_time_minutes: 8,
    variants: [{ name: 'REG', price: 139 }, { name: 'LRG', price: 179 }],
  },
  {
    id: 'snv-07',
    category_id: 'cat-starters-nv',
    name: 'Crispy Chicken Cigar',
    price: 159,
    is_veg: false,
    prep_time_minutes: 7,
    variants: [{ name: 'LRG', price: 159 }],
  },
  {
    id: 'snv-08',
    category_id: 'cat-starters-nv',
    name: 'Crispy Chicken N Cheese Balls',
    price: 169,
    is_veg: false,
    prep_time_minutes: 8,
    variants: [{ name: 'LRG', price: 169 }],
  },
  {
    id: 'snv-09',
    category_id: 'cat-starters-nv',
    name: 'Tawa Chicken',
    price: 169,
    is_veg: false,
    prep_time_minutes: 9,
    variants: [{ name: 'LRG', price: 169 }],
  },
  {
    id: 'snv-10',
    category_id: 'cat-starters-nv',
    name: 'Tandoori Chicken Lollipop',
    price: 169,
    is_veg: false,
    prep_time_minutes: 10,
    variants: [{ name: 'LRG', price: 169 }],
  },
  {
    id: 'snv-11',
    category_id: 'cat-starters-nv',
    name: 'Tandoori Chicken Tikka',
    price: 179,
    is_veg: false,
    prep_time_minutes: 10,
    variants: [{ name: 'LRG', price: 179 }],
  },
  {
    id: 'snv-12',
    category_id: 'cat-starters-nv',
    name: 'Tandoori Hariyali Chicken Tikka',
    price: 179,
    is_veg: false,
    prep_time_minutes: 10,
    variants: [{ name: 'LRG', price: 179 }],
  },
  {
    id: 'snv-13',
    category_id: 'cat-starters-nv',
    name: 'Egg Chilly',
    price: 159,
    is_veg: false,
    prep_time_minutes: 7,
    variants: [{ name: 'LRG', price: 159 }],
  },

  // 2. STARTERS – VEG
  {
    id: 'sveg-01',
    category_id: 'cat-starters-veg',
    name: 'Paneer Popcorn',
    price: 129,
    is_veg: true,
    prep_time_minutes: 6,
    variants: [{ name: 'REG', price: 129 }, { name: 'LRG', price: 159 }],
  },
  {
    id: 'sveg-02',
    category_id: 'cat-starters-veg',
    name: 'Onion Rings',
    price: 129,
    is_veg: true,
    prep_time_minutes: 5,
    variants: [{ name: 'LRG', price: 129 }],
  },
  {
    id: 'sveg-03',
    category_id: 'cat-starters-veg',
    name: 'Paneer Strips',
    price: 149,
    is_veg: true,
    prep_time_minutes: 6,
    variants: [{ name: 'REG', price: 149 }, { name: 'LRG', price: 189 }],
  },
  {
    id: 'sveg-04',
    category_id: 'cat-starters-veg',
    name: 'Cheese Corn Ball',
    price: 169,
    is_veg: true,
    prep_time_minutes: 7,
    variants: [{ name: 'LRG', price: 169 }],
  },
  {
    id: 'sveg-05',
    category_id: 'cat-starters-veg',
    name: 'Cheese Kurkure',
    price: 169,
    is_veg: true,
    prep_time_minutes: 6,
    variants: [{ name: 'LRG', price: 169 }],
  },
  {
    id: 'sveg-06',
    category_id: 'cat-starters-veg',
    name: 'Rollify Signature Paneer Dry',
    price: 179,
    is_veg: true,
    is_chef_special: true,
    prep_time_minutes: 8,
    variants: [{ name: 'LRG', price: 179 }],
  },
  {
    id: 'sveg-07',
    category_id: 'cat-starters-veg',
    name: 'Paneer - 65',
    price: 169,
    is_veg: true,
    prep_time_minutes: 7,
    variants: [{ name: 'LRG', price: 169 }],
  },
  {
    id: 'sveg-08',
    category_id: 'cat-starters-veg',
    name: 'Tandoori Paneer Tikka',
    price: 189,
    is_veg: true,
    prep_time_minutes: 10,
    variants: [{ name: 'LRG', price: 189 }],
  },
  {
    id: 'sveg-09',
    category_id: 'cat-starters-veg',
    name: 'Signature Cheese Stuffed Mushroom',
    price: 189,
    is_veg: true,
    is_chef_special: true,
    prep_time_minutes: 10,
    variants: [{ name: 'LRG', price: 189 }],
  },
  {
    id: 'sveg-10',
    category_id: 'cat-starters-veg',
    name: 'Butter Garlic Mushroom',
    price: 189,
    is_veg: true,
    prep_time_minutes: 8,
    variants: [{ name: 'LRG', price: 189 }],
  },
  {
    id: 'sveg-11',
    category_id: 'cat-starters-veg',
    name: 'Tandoori Mushroom',
    price: 179,
    is_veg: true,
    prep_time_minutes: 9,
    variants: [{ name: 'LRG', price: 179 }],
  },
  {
    id: 'sveg-12',
    category_id: 'cat-starters-veg',
    name: 'Tandoori Broccoli',
    price: 179,
    is_veg: true,
    prep_time_minutes: 8,
    variants: [{ name: 'LRG', price: 179 }],
  },
  {
    id: 'sveg-13',
    category_id: 'cat-starters-veg',
    name: 'Hariyali Paneer Tikka',
    price: 189,
    is_veg: true,
    prep_time_minutes: 10,
    variants: [{ name: 'LRG', price: 189 }],
  },
  {
    id: 'sveg-14',
    category_id: 'cat-starters-veg',
    name: 'Hariyali Mushroom Tikka',
    price: 179,
    is_veg: true,
    prep_time_minutes: 9,
    variants: [{ name: 'LRG', price: 179 }],
  },

  // 3. ROLLS – NON-VEG
  { id: 'rnv-01', category_id: 'cat-rolls-nv', name: 'Crispy Chicken Roll', price: 109, is_veg: false, prep_time_minutes: 6 },
  { id: 'rnv-02', category_id: 'cat-rolls-nv', name: 'Chicken Popcorn Roll', price: 119, is_veg: false, prep_time_minutes: 6 },
  { id: 'rnv-03', category_id: 'cat-rolls-nv', name: 'Chicken Kathi Roll', price: 129, is_veg: false, prep_time_minutes: 7 },
  { id: 'rnv-04', category_id: 'cat-rolls-nv', name: 'Spicy Chicken Roll', price: 119, is_veg: false, is_spicy: true, prep_time_minutes: 7 },
  { id: 'rnv-05', category_id: 'cat-rolls-nv', name: 'Rollify Signature Chicken Roll', price: 139, is_veg: false, is_chef_special: true, prep_time_minutes: 8 },
  { id: 'rnv-06', category_id: 'cat-rolls-nv', name: 'Rollify Signature Spicy Chicken Roll', price: 159, is_veg: false, is_chef_special: true, is_spicy: true, prep_time_minutes: 8 },
  { id: 'rnv-07', category_id: 'cat-rolls-nv', name: 'Chicken Tikka Roll', price: 139, is_veg: false, prep_time_minutes: 8 },
  { id: 'rnv-08', category_id: 'cat-rolls-nv', name: 'Hariyali Tikka Roll', price: 139, is_veg: false, prep_time_minutes: 8 },
  { id: 'rnv-09', category_id: 'cat-rolls-nv', name: 'Egg Roll', price: 109, is_veg: false, prep_time_minutes: 5 },
  { id: 'rnv-10', category_id: 'cat-rolls-nv', name: 'Egg Kathi Roll', price: 119, is_veg: false, prep_time_minutes: 6 },
  { id: 'rnv-11', category_id: 'cat-rolls-nv', name: 'Rollify Signature Egg Roll', price: 129, is_veg: false, is_chef_special: true, prep_time_minutes: 7 },
  { id: 'rnv-12', category_id: 'cat-rolls-nv', name: 'Garden Egg Melt Roll', price: 149, is_veg: false, prep_time_minutes: 7 },

  // 4. ROLLS – VEG
  { id: 'rveg-01', category_id: 'cat-rolls-veg', name: 'Veg Mexican Roll', price: 109, is_veg: true, prep_time_minutes: 6 },
  { id: 'rveg-02', category_id: 'cat-rolls-veg', name: 'Paneer Popcorn Roll', price: 119, is_veg: true, prep_time_minutes: 6 },
  { id: 'rveg-03', category_id: 'cat-rolls-veg', name: 'Falafel Roll', price: 119, is_veg: true, prep_time_minutes: 6 },
  { id: 'rveg-04', category_id: 'cat-rolls-veg', name: 'Aloo Tikki Roll', price: 99, is_veg: true, prep_time_minutes: 5 },
  { id: 'rveg-05', category_id: 'cat-rolls-veg', name: 'Paneer Tikka Roll', price: 139, is_veg: true, prep_time_minutes: 8 },
  { id: 'rveg-06', category_id: 'cat-rolls-veg', name: 'Rollify Signature Veg Roll', price: 149, is_veg: true, is_chef_special: true, prep_time_minutes: 7 },

  // 5. FRIES
  {
    id: 'fry-01',
    category_id: 'cat-fries',
    name: 'Classic Fries',
    price: 89,
    is_veg: true,
    prep_time_minutes: 5,
    variants: [{ name: 'REG', price: 89 }, { name: 'LRG', price: 119 }],
  },
  {
    id: 'fry-02',
    category_id: 'cat-fries',
    name: 'Peri Peri Fries',
    price: 99,
    is_veg: true,
    is_spicy: true,
    prep_time_minutes: 5,
    variants: [{ name: 'REG', price: 99 }, { name: 'LRG', price: 129 }],
  },
  {
    id: 'fry-03',
    category_id: 'cat-fries',
    name: 'Veg Loaded Fries',
    price: 129,
    is_veg: true,
    prep_time_minutes: 6,
    variants: [{ name: 'LRG', price: 129 }],
  },
  {
    id: 'fry-04',
    category_id: 'cat-fries',
    name: 'Paneer Loaded Fries',
    price: 159,
    is_veg: true,
    prep_time_minutes: 7,
    variants: [{ name: 'LRG', price: 159 }],
  },
  {
    id: 'fry-05',
    category_id: 'cat-fries',
    name: 'Tandoor Veggies Loaded Fries',
    price: 159,
    is_veg: true,
    prep_time_minutes: 7,
    variants: [{ name: 'LRG', price: 159 }],
  },
  {
    id: 'fry-06',
    category_id: 'cat-fries',
    name: 'Chicken Loaded Fry',
    price: 159,
    is_veg: false,
    prep_time_minutes: 7,
    variants: [{ name: 'LRG', price: 159 }],
  },
  {
    id: 'fry-07',
    category_id: 'cat-fries',
    name: 'Tandoor Chicken Loaded Fries',
    price: 169,
    is_veg: false,
    prep_time_minutes: 8,
    variants: [{ name: 'LRG', price: 169 }],
  },

  // 6. SANDWICH
  { id: 'sdw-01', category_id: 'cat-sandwich', name: 'Veg Club Sandwich + Fries', price: 129, is_veg: true, prep_time_minutes: 8 },
  { id: 'sdw-02', category_id: 'cat-sandwich', name: 'Chicken Club Sandwich + Fries', price: 149, is_veg: false, prep_time_minutes: 9 },
  { id: 'sdw-03', category_id: 'cat-sandwich', name: 'Paneer Cheese Sandwich + Fries', price: 159, is_veg: true, prep_time_minutes: 8 },
  { id: 'sdw-04', category_id: 'cat-sandwich', name: 'Chicken Tikka Sandwich + Fries', price: 179, is_veg: false, prep_time_minutes: 9 },
  { id: 'sdw-05', category_id: 'cat-sandwich', name: 'Paneer Tikka Sandwich + Fries', price: 179, is_veg: true, prep_time_minutes: 9 },

  // 7. RICE BOWL
  { id: 'rb-01', category_id: 'cat-rice-bowl', name: 'Chicken Popcorn - Rice Bowl', price: 159, is_veg: false, prep_time_minutes: 8 },
  { id: 'rb-02', category_id: 'cat-rice-bowl', name: 'Paneer Popcorn - Rice Bowl', price: 159, is_veg: true, prep_time_minutes: 8 },
  { id: 'rb-03', category_id: 'cat-rice-bowl', name: 'Tawa Chicken - Rice Bowl', price: 159, is_veg: false, prep_time_minutes: 9 },
  { id: 'rb-04', category_id: 'cat-rice-bowl', name: 'Chicken Tikka - Rice Bowl', price: 179, is_veg: false, prep_time_minutes: 9 },
  { id: 'rb-05', category_id: 'cat-rice-bowl', name: 'Hariyali Tikka - Rice Bowl', price: 189, is_veg: false, prep_time_minutes: 9 },
  { id: 'rb-06', category_id: 'cat-rice-bowl', name: 'Paneer Tikka - Rice Bowl', price: 179, is_veg: true, prep_time_minutes: 9 },

  // 8. BURGERS
  { id: 'bgr-01', category_id: 'cat-burgers', name: 'Chicken Zinger Burger + Fries', price: 159, is_veg: false, prep_time_minutes: 9 },
  { id: 'bgr-02', category_id: 'cat-burgers', name: 'Smash Chicken Burger + Fries', price: 179, is_veg: false, prep_time_minutes: 9 },
  { id: 'bgr-03', category_id: 'cat-burgers', name: 'Aloo Tikki Burger + Fries', price: 129, is_veg: true, prep_time_minutes: 7 },
  { id: 'bgr-04', category_id: 'cat-burgers', name: 'Paneer Zinger Burger + Fries', price: 159, is_veg: true, prep_time_minutes: 8 },
  { id: 'bgr-05', category_id: 'cat-burgers', name: 'Signature Chicken Burger + Fries', price: 189, is_veg: false, is_chef_special: true, prep_time_minutes: 10 },
  { id: 'bgr-06', category_id: 'cat-burgers', name: 'Signature Veg Burger + Fries', price: 159, is_veg: true, is_chef_special: true, prep_time_minutes: 9 },
  { id: 'bgr-07', category_id: 'cat-burgers', name: 'Double Patty Smash Chicken Burger + Fries', price: 209, is_veg: false, prep_time_minutes: 11 },

  // 9. BYOB
  { id: 'byob-01', category_id: 'cat-byob', name: 'BYOB - Nonveg', price: 149, is_veg: false, prep_time_minutes: 8 },
  { id: 'byob-02', category_id: 'cat-byob', name: 'BYOB - Veg', price: 129, is_veg: true, prep_time_minutes: 7 },
  { id: 'byob-03', category_id: 'cat-byob', name: 'BYOB - Tandoor Chicken', price: 179, is_veg: false, prep_time_minutes: 9 },
  { id: 'byob-04', category_id: 'cat-byob', name: 'BYOB - Tandoor Veggies', price: 169, is_veg: true, prep_time_minutes: 9 },

  // 10. COMBO
  { id: 'cmb-01', category_id: 'cat-combo', name: 'Veg Combo', price: 139, is_veg: true, prep_time_minutes: 8 },
  { id: 'cmb-02', category_id: 'cat-combo', name: 'Nonveg Combo', price: 169, is_veg: false, prep_time_minutes: 9 },
  { id: 'cmb-03', category_id: 'cat-combo', name: 'Falafel Veg Combo', price: 159, is_veg: true, prep_time_minutes: 8 },
  { id: 'cmb-04', category_id: 'cat-combo', name: 'Tandoor Chicken Combo', price: 179, is_veg: false, prep_time_minutes: 10 },

  // 11. DIPS
  { id: 'dip-01', category_id: 'cat-dips', name: 'Mayo Dip', price: 20, is_veg: true, prep_time_minutes: 1 },
  { id: 'dip-02', category_id: 'cat-dips', name: 'BBQ Dip', price: 25, is_veg: true, prep_time_minutes: 1 },
  { id: 'dip-03', category_id: 'cat-dips', name: 'Tandoor Mayo Dip', price: 25, is_veg: true, prep_time_minutes: 1 },

  // 12. ADD-ONS
  { id: 'add-01', category_id: 'cat-addons', name: 'Egg', price: 20, is_veg: false, prep_time_minutes: 3 },
  { id: 'add-02', category_id: 'cat-addons', name: 'Cheese', price: 20, is_veg: true, prep_time_minutes: 1 },
  { id: 'add-03', category_id: 'cat-addons', name: 'Peri Peri Masala', price: 20, is_veg: true, prep_time_minutes: 1 },
  { id: 'add-04', category_id: 'cat-addons', name: 'Coke - Small', price: 20, is_veg: true, prep_time_minutes: 1 },

  // 13. THICK SHAKES
  { id: 'shk-01', category_id: 'cat-shakes', name: 'Classic Vanilla Thick Shake', price: 119, is_veg: true, prep_time_minutes: 4 },
  { id: 'shk-02', category_id: 'cat-shakes', name: 'Classic Cold Coffee', price: 129, is_veg: true, prep_time_minutes: 4 },
  { id: 'shk-03', category_id: 'cat-shakes', name: 'Dark Chocolate Bliss Shake', price: 139, is_veg: true, prep_time_minutes: 5 },
  { id: 'shk-04', category_id: 'cat-shakes', name: 'Strawberry Bliss Thick Shake', price: 129, is_veg: true, prep_time_minutes: 4 },
  { id: 'shk-05', category_id: 'cat-shakes', name: 'Oreo Crunch Thick Shake', price: 139, is_veg: true, prep_time_minutes: 5 },
  { id: 'shk-06', category_id: 'cat-shakes', name: 'Caramel Coffee Thick Shake', price: 139, is_veg: true, prep_time_minutes: 5 },
  { id: 'shk-07', category_id: 'cat-shakes', name: 'Signature Mango Delight Thick Shake', price: 149, is_veg: true, is_chef_special: true, prep_time_minutes: 5 },

  // 14. MOJITO'S
  { id: 'moj-01', category_id: 'cat-mojitos', name: 'Blue Lagoon Mojito', price: 99, is_veg: true, prep_time_minutes: 3 },
  { id: 'moj-02', category_id: 'cat-mojitos', name: 'Classic Green Mint Mojito', price: 99, is_veg: true, prep_time_minutes: 3 },
  { id: 'moj-03', category_id: 'cat-mojitos', name: 'Tropical Passion Fruit Mojito', price: 109, is_veg: true, prep_time_minutes: 3 },
  { id: 'moj-04', category_id: 'cat-mojitos', name: 'Ginger Lemon Fizz Mojito', price: 109, is_veg: true, prep_time_minutes: 3 },
  { id: 'moj-05', category_id: 'cat-mojitos', name: 'Ruby Pomegranate Mojito', price: 119, is_veg: true, prep_time_minutes: 3 },
  { id: 'moj-06', category_id: 'cat-mojitos', name: 'Peach Apricot Bliss Mojito', price: 119, is_veg: true, prep_time_minutes: 3 },

  // 15. BEVERAGES
  { id: 'bev-01', category_id: 'cat-beverages', name: 'Water - 1 Ltr', price: 20, is_veg: true, prep_time_minutes: 1 },
  { id: 'bev-02', category_id: 'cat-beverages', name: 'Water - 500ml', price: 10, is_veg: true, prep_time_minutes: 1 },
  { id: 'bev-03', category_id: 'cat-beverages', name: 'Soft Drinks', price: 20, is_veg: true, prep_time_minutes: 1 },
];

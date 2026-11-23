import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { runMigrations } from './migrate.js';
import { OFFICIAL_CATEGORIES, OFFICIAL_MENU_ITEMS } from './officialMenu.js';

export async function seedDatabase() {
  console.log('[Seed] Ensuring schema exists before seeding...');
  await runMigrations();

  console.log('[Seed] Seeding Rollify POS database with official menu...');

  const adminHash = await bcrypt.hash('admin123', 10);
  const managerHash = await bcrypt.hash('manager123', 10);
  const cashierHash = await bcrypt.hash('cashier123', 10);
  const waiterHash = await bcrypt.hash('waiter123', 10);
  const kitchenHash = await bcrypt.hash('kitchen123', 10);

  // 1. Staff Users & Roles
  const users = [
    { id: 'usr-admin-01', username: 'admin', email: 'admin@rollify.com', pass: adminHash, role: 'ADMIN', pin: '1111', name: 'System Admin', phone: '+91 98455 71817' },
    { id: 'usr-mgr-01', username: 'manager', email: 'manager@rollify.com', pass: managerHash, role: 'MANAGER', pin: '2222', name: 'Cafe Manager', phone: '+91 96116 39964' },
    { id: 'usr-cashier-01', username: 'cashier', email: 'cashier@rollify.com', pass: cashierHash, role: 'CASHIER', pin: '3333', name: 'Head Cashier', phone: '+91 96119 64366' },
    { id: 'usr-waiter-01', username: 'waiter', email: 'waiter@rollify.com', pass: waiterHash, role: 'WAITER', pin: '4444', name: 'Floor Captain Rahul', phone: '+91 98765 43213' },
    { id: 'usr-kitchen-01', username: 'kitchen', email: 'kitchen@rollify.com', pass: kitchenHash, role: 'KITCHEN', pin: '5555', name: 'Chef Suresh (KDS Master)', phone: '+91 98765 43214' },
  ];

  for (const u of users) {
    await db.query(`
      INSERT INTO users (id, username, email, password_hash, role, pin_code, full_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        pin_code = EXCLUDED.pin_code,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;
    `, [u.id, u.username, u.email, u.pass, u.role, u.pin, u.name, u.phone]);
  }
  console.log(`[Seed] Seeded ${users.length} staff users.`);

  // 2. Dining Tables
  const tables = [
    { id: 'tbl-01', num: 'T-01', sec: 'Main Indoor', cap: 4, qr: 'QR_TBL_01_ROL' },
    { id: 'tbl-02', num: 'T-02', sec: 'Main Indoor', cap: 2, qr: 'QR_TBL_02_ROL' },
    { id: 'tbl-03', num: 'T-03', sec: 'Main Indoor', cap: 6, qr: 'QR_TBL_03_ROL' },
    { id: 'tbl-04', num: 'T-04', sec: 'Main Indoor', cap: 4, qr: 'QR_TBL_04_ROL' },
    { id: 'tbl-05', num: 'T-05', sec: 'Garden Patio', cap: 4, qr: 'QR_TBL_05_ROL' },
    { id: 'tbl-06', num: 'T-06', sec: 'Garden Patio', cap: 4, qr: 'QR_TBL_06_ROL' },
    { id: 'tbl-07', num: 'T-07', sec: 'Balcony View', cap: 2, qr: 'QR_TBL_07_ROL' },
    { id: 'tbl-08', num: 'T-08', sec: 'Balcony View', cap: 2, qr: 'QR_TBL_08_ROL' },
    { id: 'tbl-09', num: 'BAR-01', sec: 'Quick Counter', cap: 1, qr: 'QR_BAR_01_ROL' },
    { id: 'tbl-10', num: 'BAR-02', sec: 'Quick Counter', cap: 1, qr: 'QR_BAR_02_ROL' },
  ];

  for (const t of tables) {
    await db.query(`
      INSERT INTO dining_tables (id, table_number, section, capacity, status, qr_token)
      VALUES ($1, $2, $3, $4, 'AVAILABLE', $5)
      ON CONFLICT (table_number) DO UPDATE SET
        id = EXCLUDED.id,
        section = EXCLUDED.section,
        capacity = EXCLUDED.capacity,
        qr_token = EXCLUDED.qr_token;
    `, [t.id, t.num, t.sec, t.cap, t.qr]);
  }
  console.log(`[Seed] Seeded ${tables.length} dining tables.`);

  // 3. Official Menu Categories
  for (const c of OFFICIAL_CATEGORIES) {
    await db.query(`
      INSERT INTO menu_categories (id, name, slug, description, display_order)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        display_order = EXCLUDED.display_order;
    `, [c.id, c.name, c.slug, c.description, c.display_order]);
  }
  console.log(`[Seed] Seeded ${OFFICIAL_CATEGORIES.length} official menu categories.`);

  // 4. Official Menu Items & Variants
  let variantCount = 0;
  for (let idx = 0; idx < OFFICIAL_MENU_ITEMS.length; idx++) {
    const item = OFFICIAL_MENU_ITEMS[idx];
    await db.query(`
      INSERT INTO menu_items (
        id, category_id, name, description, price, tax_rate, is_veg, 
        is_chef_special, is_spicy, image_url, prep_time_minutes, display_order
      )
      VALUES ($1, $2, $3, $4, $5, 5.00, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        is_veg = EXCLUDED.is_veg,
        is_chef_special = EXCLUDED.is_chef_special,
        is_spicy = EXCLUDED.is_spicy,
        image_url = EXCLUDED.image_url,
        prep_time_minutes = EXCLUDED.prep_time_minutes,
        display_order = EXCLUDED.display_order;
    `, [
      item.id,
      item.category_id,
      item.name,
      item.description || `${item.name} - freshly prepared with house spices`,
      item.price,
      item.is_veg,
      item.is_chef_special || false,
      item.is_spicy || false,
      item.image_url || null,
      item.prep_time_minutes,
      idx + 1,
    ]);

    // Insert variants if defined (e.g. REG/LRG)
    if (item.variants && item.variants.length > 0) {
      for (const v of item.variants) {
        const vId = `var-${item.id}-${v.name.toLowerCase()}`;
        await db.query(`
          INSERT INTO menu_item_variants (id, menu_item_id, variant_name, price, is_available)
          VALUES ($1, $2, $3, $4, TRUE)
          ON CONFLICT (menu_item_id, variant_name) DO UPDATE SET
            price = EXCLUDED.price;
        `, [vId, item.id, v.name, v.price]);
        variantCount++;
      }
    } else {
      // Default single variant
      const vId = `var-${item.id}-single`;
      await db.query(`
        INSERT INTO menu_item_variants (id, menu_item_id, variant_name, price, is_available)
        VALUES ($1, $2, 'Single', $3, TRUE)
        ON CONFLICT (menu_item_id, variant_name) DO UPDATE SET
          price = EXCLUDED.price;
      `, [vId, item.id, item.price]);
      variantCount++;
    }
  }
  console.log(`[Seed] Seeded ${OFFICIAL_MENU_ITEMS.length} menu items and ${variantCount} size variants.`);

  // 5. Raw Ingredients & Inventory
  const ingredients = [
    { id: 'ing-flour-wrap', name: 'Handcrafted Paratha Wraps', unit: 'pcs', stock: 500.0, threshold: 50.0, cost: 7.00 },
    { id: 'ing-chicken', name: 'Fresh Boneless Chicken', unit: 'kg', stock: 60.0, threshold: 10.0, cost: 240.00 },
    { id: 'ing-paneer', name: 'Fresh Malai Paneer', unit: 'kg', stock: 35.0, threshold: 8.0, cost: 320.00 },
    { id: 'ing-cheese', name: 'Processed Cheddar Cheese', unit: 'kg', stock: 25.0, threshold: 5.0, cost: 420.00 },
    { id: 'ing-egg', name: 'Farm Fresh Eggs', unit: 'pcs', stock: 300.0, threshold: 40.0, cost: 6.00 },
    { id: 'ing-mushroom', name: 'Fresh Button Mushrooms', unit: 'kg', stock: 20.0, threshold: 4.0, cost: 160.00 },
    { id: 'ing-fries', name: 'Skinny Cut Potato Fries', unit: 'kg', stock: 80.0, threshold: 15.0, cost: 95.00 },
    { id: 'ing-burger-bun', name: 'Brioche Burger Buns', unit: 'pcs', stock: 150.0, threshold: 25.0, cost: 15.00 },
    { id: 'ing-sandwich-bread', name: 'Jumbo Bread Slices', unit: 'pcs', stock: 200.0, threshold: 30.0, cost: 4.00 },
    { id: 'ing-rice', name: 'Aromatic Seasoned Rice', unit: 'kg', stock: 40.0, threshold: 8.0, cost: 75.00 },
    { id: 'ing-garlic-mayo', name: 'House Toum Garlic Mayo', unit: 'l', stock: 30.0, threshold: 5.0, cost: 160.00 },
    { id: 'ing-bbq-sauce', name: 'Smoked BBQ Sauce', unit: 'l', stock: 15.0, threshold: 3.0, cost: 220.00 },
    { id: 'ing-peri-peri', name: 'Signature Peri Peri Seasoning', unit: 'kg', stock: 10.0, threshold: 2.0, cost: 350.00 },
    { id: 'ing-milk', name: 'Pasteurized Full Cream Milk', unit: 'l', stock: 60.0, threshold: 10.0, cost: 68.00 },
    { id: 'ing-ice-cream', name: 'Vanilla Ice Cream Base', unit: 'kg', stock: 25.0, threshold: 5.0, cost: 180.00 },
  ];

  for (const ing of ingredients) {
    await db.query(`
      INSERT INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        current_stock = EXCLUDED.current_stock,
        min_threshold = EXCLUDED.min_threshold,
        cost_per_unit = EXCLUDED.cost_per_unit;
    `, [ing.id, ing.name, ing.unit, ing.stock, ing.threshold, ing.cost]);

    // Initial stock ledger entry
    await db.query(`
      INSERT INTO stock_movements (id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by)
      VALUES ($1, $2, 'PURCHASE', $3, $3, 'INITIAL-OFFICIAL-STOCK', 'Store opening inventory', 'usr-admin-01')
      ON CONFLICT (id) DO NOTHING;
    `, [`sm-init-${ing.id}`, ing.id, ing.stock]);
  }
  console.log(`[Seed] Seeded ${ingredients.length} raw inventory ingredients.`);

  // 6. Recipe Mappings for Key Items
  const sampleRecipes = [
    // Rollify Signature Chicken Roll
    { item: 'rnv-05', ing: 'ing-flour-wrap', qty: 1.0, unit: 'pcs' },
    { item: 'rnv-05', ing: 'ing-chicken', qty: 0.12, unit: 'kg' },
    { item: 'rnv-05', ing: 'ing-cheese', qty: 0.02, unit: 'kg' },
    { item: 'rnv-05', ing: 'ing-garlic-mayo', qty: 0.03, unit: 'l' },

    // Crispy Chicken Roll
    { item: 'rnv-01', ing: 'ing-flour-wrap', qty: 1.0, unit: 'pcs' },
    { item: 'rnv-01', ing: 'ing-chicken', qty: 0.10, unit: 'kg' },
    { item: 'rnv-01', ing: 'ing-garlic-mayo', qty: 0.02, unit: 'l' },

    // Rollify Signature Veg Roll
    { item: 'rveg-06', ing: 'ing-flour-wrap', qty: 1.0, unit: 'pcs' },
    { item: 'rveg-06', ing: 'ing-paneer', qty: 0.08, unit: 'kg' },
    { item: 'rveg-06', ing: 'ing-cheese', qty: 0.02, unit: 'kg' },

    // Classic Fries
    { item: 'fry-01', ing: 'ing-fries', qty: 0.18, unit: 'kg' },

    // Peri Peri Fries
    { item: 'fry-02', ing: 'ing-fries', qty: 0.18, unit: 'kg' },
    { item: 'fry-02', ing: 'ing-peri-peri', qty: 0.01, unit: 'kg' },

    // Veg Club Sandwich + Fries
    { item: 'sdw-01', ing: 'ing-sandwich-bread', qty: 3.0, unit: 'pcs' },
    { item: 'sdw-01', ing: 'ing-cheese', qty: 0.02, unit: 'kg' },
    { item: 'sdw-01', ing: 'ing-fries', qty: 0.08, unit: 'kg' },

    // Chicken Zinger Burger + Fries
    { item: 'bgr-01', ing: 'ing-burger-bun', qty: 1.0, unit: 'pcs' },
    { item: 'bgr-01', ing: 'ing-chicken', qty: 0.12, unit: 'kg' },
    { item: 'bgr-01', ing: 'ing-fries', qty: 0.08, unit: 'kg' },

    // Classic Vanilla Thick Shake
    { item: 'shk-01', ing: 'ing-milk', qty: 0.25, unit: 'l' },
    { item: 'shk-01', ing: 'ing-ice-cream', qty: 0.08, unit: 'kg' },
  ];

  for (let idx = 0; idx < sampleRecipes.length; idx++) {
    const r = sampleRecipes[idx];
    await db.query(`
      INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity, unit)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (menu_item_id, ingredient_id) DO UPDATE SET
        quantity = EXCLUDED.quantity;
    `, [`rcp-off-${idx + 1}`, r.item, r.ing, r.qty, r.unit]);
  }
  console.log(`[Seed] Seeded ${sampleRecipes.length} sample recipes.`);

  // 7. Vendors & Liabilities
  const vendors = [
    { id: 'ven-01', name: 'Fresh Poultry & Farm Wholesale', person: 'Rajesh Verma', phone: '+91 98451 12233', email: 'poultry@freshfarm.in', address: 'APMC Market Yard, Bengaluru', liability: 12000.00 },
    { id: 'ven-02', name: 'Dairy Pure & Malai Paneer Hub', person: 'Amit Patel', phone: '+91 98452 23344', email: 'orders@dairypure.com', address: 'Dairy Circle, Bannerghatta Rd', liability: 0.00 },
    { id: 'ven-03', name: 'Metro Eco Packaging & Paper', person: 'Sunil Rao', phone: '+91 98453 34455', email: 'sales@metropack.co', address: 'Peenya Industrial Area', liability: 3500.00 },
    { id: 'ven-04', name: 'Rollify Store Realty & Estates', person: 'Anand Kumar', phone: '+91 98454 45566', email: 'lease@indiranagar.realty', address: '100ft Road, Indiranagar', liability: 0.00 },
    { id: 'ven-05', name: 'Commercial Gas & Utility Corp', person: 'Utility Desk', phone: '+91 98455 56677', email: 'gas@commercialenergy.in', address: 'Domlur Sub-Station', liability: 0.00 },
  ];

  for (const v of vendors) {
    await db.query(`
      INSERT INTO vendors (id, name, contact_person, phone, email, address, current_liability)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        contact_person = EXCLUDED.contact_person,
        current_liability = EXCLUDED.current_liability;
    `, [v.id, v.name, v.person, v.phone, v.email, v.address, v.liability]);
  }
  console.log(`[Seed] Seeded ${vendors.length} vendors.`);

  // 8. Sample Operating Expenses
  const expenses = [
    { id: 'exp-01', vendor: 'ven-04', cat: 'RENT', amt: 45000.00, status: 'PAID', method: 'BANK_TRANSFER', desc: 'Monthly store rent for Rollify flagship outlet' },
    { id: 'exp-02', vendor: 'ven-05', cat: 'UTILITIES', amt: 8500.00, status: 'PAID', method: 'UPI', desc: 'Commercial LPG cylinders (x4) and utility bill' },
    { id: 'exp-03', vendor: 'ven-03', cat: 'PACKAGING', amt: 6200.00, status: 'PAID', method: 'UPI', desc: 'Branded butter paper, foil wraps, parcel containers' },
    { id: 'exp-04', vendor: 'ven-01', cat: 'RAW_MATERIALS', amt: 12000.00, status: 'PENDING_LIABILITY', method: null, desc: 'Fresh chicken supply credit invoice #PV-8831' },
    { id: 'exp-05', vendor: 'ven-03', cat: 'PACKAGING', amt: 3500.00, status: 'PENDING_LIABILITY', method: null, desc: 'Takeaway paper carry bags credit invoice #MP-1022' },
    { id: 'exp-06', vendor: null, cat: 'MAINTENANCE', amt: 1850.00, status: 'PAID', method: 'CASH', desc: 'Exhaust fan servicing and filter cleaning' },
  ];

  for (const e of expenses) {
    await db.query(`
      INSERT INTO expenses (id, vendor_id, category, amount, payment_status, payment_method, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'usr-admin-01')
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        payment_status = EXCLUDED.payment_status;
    `, [e.id, e.vendor, e.cat, e.amt, e.status, e.method, e.desc]);
  }
  console.log(`[Seed] Seeded ${expenses.length} operating expenses.`);

  // 9. Audit Log
  await db.query(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES ($1, 'usr-admin-01', 'OFFICIAL_MENU_SEEDED', 'SYSTEM', 'SYS-MENU', $2)
    ON CONFLICT (id) DO NOTHING;
  `, ['aud-off-menu-01', JSON.stringify({ message: 'Seeded 15 official categories and 97 menu items from Rollify PDF catalog' })]);

  console.log('✅ [Seed] Official Rollify Menu seeding completed successfully!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await db.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

import { 
  DEMO_USERS, 
  DEMO_TABLES, 
  DEMO_CATEGORIES, 
  DEMO_MENU_ITEMS, 
  DEMO_INGREDIENTS, 
  DEMO_VENDORS, 
  DEMO_EXPENSES, 
  DEMO_INITIAL_ORDERS 
} from './demoStore.js';

const STORAGE_KEY = 'rollify_pos_clean_production_v1';

// Auto-purge legacy demo data caches from previous sessions
try {
  ['rollify_pos_demo_db_v1', 'rollify_pos_demo_db_v2', 'rollify_pos_demo_db_v3', 'rollify_pos_cafe_db_v6'].forEach((k) => {
    localStorage.removeItem(k);
  });
} catch {
  // safe ignore
}

function getStore() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (
        parsed && 
        Array.isArray(parsed.items) && 
        parsed.items.length >= 50 &&
        Array.isArray(parsed.categories) && 
        parsed.categories.length >= 10
      ) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }

  const initialStore = {
    users: DEMO_USERS,
    tables: DEMO_TABLES,
    categories: DEMO_CATEGORIES,
    items: DEMO_MENU_ITEMS,
    ingredients: DEMO_INGREDIENTS,
    vendors: [],
    expenses: [],
    orders: [],
    bills: [],
    shifts: [],
    dayClosings: [],
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStore));
  return initialStore;
}

function saveStore(store: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('rollify:new_order'));
  } catch {
    // safe ignore
  }
}

export function initDemoInterceptor() {
  const originalFetch = window.fetch;
  const backendBase = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept /api calls
    if (!urlStr.includes('/api/')) {
      return originalFetch(input, init);
    }

    // Attempt real backend if VITE_BACKEND_URL is set, or if proxy/localhost responds with JSON
    try {
      let fetchTarget: RequestInfo | URL = input;
      if (backendBase) {
        if (typeof input === 'string' && input.startsWith('/')) {
          fetchTarget = `${backendBase}${input}`;
        } else if (input instanceof URL && input.origin === window.location.origin) {
          fetchTarget = `${backendBase}${input.pathname}${input.search}`;
        }
      }

      const realRes = await originalFetch(fetchTarget, init);
      const ct = realRes.headers.get('content-type') || '';
      // ONLY return realRes if the content-type is ACTUALLY application/json!
      // On Vercel, non-existent /api routes return /index.html with status 200 and text/html!
      if (ct.includes('application/json')) {
        return realRes;
      }
    } catch (e) {
      // Backend not running / offline - fall through to mock demo responder
    }

    // DEMO IN-BROWSER RESPONDER
    const parsedUrl = new URL(urlStr, window.location.origin);
    const path = parsedUrl.pathname;
    const method = init?.method?.toUpperCase() || 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : {};

    const store = getStore();

    const makeRes = (data: any, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    // 1. HEALTH
    if (path === '/api/health') {
      return makeRes({ status: 'ok', mode: 'demo' });
    }

    // 2. AUTH
    if (path === '/api/auth/pin-login' && method === 'POST') {
      const pinToMatch = (body.pin || body.pinCode || '').toString().trim();
      let user = store.users.find((u: any) => u.pin_code === pinToMatch);
      if (!user && pinToMatch === '2222') {
        user = store.users.find((u: any) => u.role === 'ADMIN');
      }
      if (!user) {
        return makeRes({ success: false, error: 'Invalid PIN code. Try 1111 (Admin), 3333 (Cashier), or 5555 (Kitchen).' }, 401);
      }
      return makeRes({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            pinCode: user.pin_code,
            phone: user.phone,
          },
          token: `demo-token-${user.role.toLowerCase()}-${Date.now()}`,
        },
      });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const id = (body.identifier || '').toString().trim().toLowerCase();
      const user = store.users.find((u: any) => 
        (u.username && u.username.toLowerCase() === id) || 
        (u.email && u.email.toLowerCase() === id)
      );
      if (!user) {
        return makeRes({ success: false, error: 'Invalid username/email or password' }, 401);
      }
      return makeRes({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            pinCode: user.pin_code,
            phone: user.phone,
          },
          token: `demo-token-${user.role.toLowerCase()}-${Date.now()}`,
        },
      });
    }

    if (path === '/api/auth/me') {
      const user = store.users[0];
      return makeRes({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          full_name: user.full_name,
          fullName: user.full_name,
          pin_code: user.pin_code,
          pinCode: user.pin_code,
          phone: user.phone || '+91 98765 43210',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
            fullName: user.full_name,
            pin_code: user.pin_code,
            pinCode: user.pin_code,
            phone: user.phone || '+91 98765 43210',
          },
        },
      });
    }

    if (path === '/api/auth/logout') {
      return makeRes({ success: true });
    }

    // 3. TABLES
    if (path === '/api/tables' && method === 'GET') {
      return makeRes({ success: true, data: store.tables });
    }

    if (path.startsWith('/api/tables/') && path.endsWith('/status') && method === 'PATCH') {
      const tableId = path.split('/')[3];
      const table = store.tables.find((t: any) => t.id === tableId);
      if (table) {
        table.status = body.status;
        saveStore(store);
      }
      return makeRes({ success: true, data: table });
    }

    // 4. MENU
    if (path === '/api/menu/categories') {
      const cats = store.categories && store.categories.length > 0 ? store.categories : DEMO_CATEGORIES;
      return makeRes({ success: true, data: cats });
    }

    if (path === '/api/menu/items' && method === 'GET') {
      const items = store.items && store.items.length > 0 ? store.items : DEMO_MENU_ITEMS;
      return makeRes({ success: true, data: items });
    }

    if (path.startsWith('/api/menu/items/') && path.endsWith('/availability') && method === 'PATCH') {
      const itemId = path.split('/')[4];
      const item = store.items.find((i: any) => i.id === itemId);
      if (item) {
        item.is_available = !item.is_available;
        saveStore(store);
      }
      return makeRes({ success: true, data: item });
    }

    if (path.startsWith('/api/menu/items/') && method === 'GET') {
      const itemId = path.split('/')[4];
      const item = store.items.find((i: any) => i.id === itemId);
      return makeRes({
        success: true,
        data: {
          ...item,
          recipe: [
            { id: 'r1', ingredient_name: 'Handcrafted Paratha Wrap', quantity: '1', unit: 'pcs', current_stock: '450', ingredient_unit: 'pcs' },
            { id: 'r2', ingredient_name: 'Fresh Boneless Chicken / Paneer', quantity: '0.12', unit: 'kg', current_stock: '48', ingredient_unit: 'kg' },
            { id: 'r3', ingredient_name: 'House Toum Garlic Mayo', quantity: '0.03', unit: 'l', current_stock: '22', ingredient_unit: 'l' },
          ],
        },
      });
    }

    // 5. ORDERS
    if (path === '/api/orders' && method === 'GET') {
      return makeRes({ success: true, data: store.orders });
    }

    if (path === '/api/orders' && method === 'POST') {
      const orderCount = store.orders.length + 1;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `ROL-${dateStr}-${orderCount.toString().padStart(3, '0')}`;
      const orderId = `ord-${Date.now()}`;

      const table = store.tables.find((t: any) => t.id === body.tableId);
      if (table) {
        table.status = 'OCCUPIED';
      }

      let subtotal = 0;
      const orderItems = (body.items || []).map((it: any, idx: number) => {
        const itemObj = store.items.find((m: any) => m.id === it.menuItemId);
        const itemSubtotal = it.quantity * it.unitPrice;
        subtotal += itemSubtotal;
        return {
          id: `oit-${orderId}-${idx + 1}`,
          order_id: orderId,
          menu_item_id: it.menuItemId,
          item_name: itemObj?.name || 'Rollify Dish',
          variant_name: it.variantName || 'Single',
          quantity: it.quantity,
          unit_price: it.unitPrice.toFixed(2),
          subtotal: itemSubtotal.toFixed(2),
          item_status: body.sendToKitchen ? 'SENT_TO_KITCHEN' : 'CREATED',
          is_veg: itemObj?.is_veg ?? true,
          prep_time_minutes: itemObj?.prep_time_minutes ?? 6,
        };
      });

      const parcel = (body.orderType === 'TAKEAWAY' || body.orderType === 'DELIVERY') ? 10 : 0;
      const gst = (subtotal + parcel) * 0.05;
      const totalAmount = (subtotal + parcel + gst).toFixed(2);

      const newOrder = {
        id: orderId,
        order_number: orderNumber,
        order_type: body.orderType || 'DINE_IN',
        table_id: body.tableId || null,
        table_number: table ? table.table_number : null,
        table_section: table ? table.section : null,
        customer_name: body.customerName || null,
        customer_phone: body.customerPhone || null,
        status: body.sendToKitchen ? 'SENT_TO_KITCHEN' : 'CREATED',
        order_notes: body.notes || null,
        created_at: new Date().toISOString(),
        elapsed_minutes: 0,
        total_amount: totalAmount,
        items: orderItems,
      };

      store.orders.unshift(newOrder);
      saveStore(store);

      return makeRes({
        success: true,
        data: {
          orderId,
          orderNumber,
        },
      });
    }

    if (path.startsWith('/api/orders/') && path.endsWith('/items') && method === 'POST') {
      const orderId = path.split('/')[3];
      const ord = store.orders.find((o: any) => o.id === orderId);
      if (ord) {
        const newItems = (body.items || []).map((it: any, idx: number) => {
          const itemObj = store.items.find((m: any) => m.id === it.menuItemId);
          const itemSubtotal = it.quantity * it.unitPrice;
          return {
            id: `oit-${orderId}-${Date.now()}-${idx + 1}`,
            order_id: orderId,
            menu_item_id: it.menuItemId,
            item_name: itemObj?.name || 'Cafe Item',
            variant_name: it.variantName || 'Regular',
            quantity: it.quantity,
            unit_price: it.unitPrice.toFixed(2),
            subtotal: itemSubtotal.toFixed(2),
            item_status: body.sendToKitchen ? 'SENT_TO_KITCHEN' : 'CREATED',
            is_veg: itemObj?.is_veg ?? true,
            prep_time_minutes: itemObj?.prep_time_minutes ?? 6,
            special_instructions: it.specialInstructions || '',
          };
        });

        ord.items = [...(ord.items || []), ...newItems];
        const subtotal = ord.items.reduce((acc: number, item: any) => acc + Number(item.subtotal || 0), 0);
        const parcel = (ord.order_type === 'TAKEAWAY' || ord.order_type === 'DELIVERY') ? 10 : 0;
        const gst = (subtotal + parcel) * 0.05;
        ord.total_amount = (subtotal + parcel + gst).toFixed(2);
        if (body.sendToKitchen && ord.status !== 'PREPARING') {
          ord.status = 'SENT_TO_KITCHEN';
        }
        saveStore(store);
        return makeRes({ success: true, message: 'Items added to order', data: ord });
      }
      return makeRes({ success: false, error: 'Order not found' }, 404);
    }

    if (path === '/api/orders/kitchen/active') {
      const activeTickets = store.orders.filter((o: any) =>
        ['SENT_TO_KITCHEN', 'PREPARING', 'READY'].includes(o.status)
      );
      return makeRes({ success: true, data: activeTickets });
    }

    if (path.endsWith('/send-to-kitchen') && method === 'POST') {
      const orderId = path.split('/')[3];
      const ord = store.orders.find((o: any) => o.id === orderId);
      if (ord) {
        ord.status = 'SENT_TO_KITCHEN';
        saveStore(store);
      }
      return makeRes({ success: true });
    }

    if (path.startsWith('/api/orders/') && path.endsWith('/status') && method === 'PATCH') {
      const orderId = path.split('/')[3];
      const ord = store.orders.find((o: any) => o.id === orderId);
      if (ord) {
        ord.status = body.status;
        saveStore(store);
      }
      return makeRes({ success: true });
    }

    // 6. BILLING
    if (path === '/api/billing' && method === 'GET') {
      return makeRes({ success: true, data: store.bills });
    }

    if (path.startsWith('/api/billing/generate/') && method === 'POST') {
      const orderId = path.split('/')[4];
      const order = store.orders.find((o: any) => o.id === orderId);
      const gross = parseFloat(order?.total_amount || '200');
      const discount = 0;
      const taxable = gross;
      const tax = taxable * 0.05;
      const net = taxable;

      const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const newBill = {
        id: `bill-${Date.now()}`,
        bill_number: `INV-${todayCode}-${(store.bills.length + 1).toString().padStart(3, '0')}`,
        order_id: orderId,
        order_number: order?.order_number || 'ROL-001',
        order_type: order?.order_type || 'DINE_IN',
        table_number: order?.table_number,
        customer_name: order?.customer_name,
        gross_amount: (gross / 1.05).toFixed(2),
        discount_amount: '0.00',
        taxable_amount: (gross / 1.05).toFixed(2),
        tax_amount: (gross - gross / 1.05).toFixed(2),
        net_amount: gross.toFixed(2),
        paid_amount: '0.00',
        balance_due: gross,
        payment_status: 'UNPAID',
        cashier_name: 'Head Cashier',
        created_at: new Date().toISOString(),
        items: order?.items || [],
        payments: [],
      };

      store.bills.unshift(newBill);
      saveStore(store);
      return makeRes({ success: true, data: newBill });
    }

    if (path.includes('/payments') && method === 'POST') {
      const billId = path.split('/')[3];
      const bill = store.bills.find((b: any) => b.id === billId);
      if (bill) {
        let paymentsList = body.payments || [];
        if (!paymentsList.length && body.paymentMethod) {
          paymentsList = [{
            id: `pay-${Date.now()}`,
            amount: body.amount,
            payment_method: body.paymentMethod,
            transaction_reference: body.transactionReference || '',
            created_at: new Date().toISOString(),
          }];
        }
        bill.payments = [...(bill.payments || []), ...paymentsList.map((p: any) => ({ ...p, id: p.id || `pay-${Date.now()}` }))];
        const totalPaid = bill.payments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
        bill.paid_amount = totalPaid.toFixed(2);
        bill.balance_due = Math.max(0, Math.round((Number(bill.net_amount) - totalPaid) * 100) / 100);
        bill.payment_status = bill.balance_due <= 0.05 ? 'PAID' : 'PARTIALLY_PAID';

        // complete the corresponding order
        const order = store.orders.find((o: any) => o.id === bill.order_id);
        if (order && bill.payment_status === 'PAID') {
          order.status = 'COMPLETED';
          const table = store.tables.find((t: any) => t.id === order.table_id);
          if (table) {
            table.status = 'AVAILABLE';
            table.active_order_id = null;
          }
        }

        saveStore(store);
      }
      return makeRes({ success: true, message: 'Payment recorded successfully', data: bill });
    }

    if (path.startsWith('/api/billing/') && path.endsWith('/refund') && method === 'POST') {
      const billId = path.split('/')[3];
      const bill = store.bills.find((b: any) => b.id === billId);
      if (bill) {
        bill.payment_status = 'REFUNDED';
        bill.refund_reason = body.reason || 'Staff void / refund';
        bill.refunded_at = new Date().toISOString();

        const order = store.orders.find((o: any) => o.id === bill.order_id);
        if (order) {
          order.status = 'CANCELLED';
          const table = store.tables.find((t: any) => t.id === order.table_id);
          if (table) {
            table.status = 'AVAILABLE';
            table.active_order_id = null;
          }
        }

        saveStore(store);
        return makeRes({ success: true, message: 'Invoice refunded and order cancelled', data: bill });
      }
      return makeRes({ success: false, error: 'Bill not found' }, 404);
    }

    if (path.startsWith('/api/billing/') && method === 'GET' && !path.includes('day-close')) {
      const billId = path.split('/')[3];
      const bill = store.bills.find((b: any) => b.id === billId);
      return makeRes({ success: true, data: bill });
    }

    if (path === '/api/billing/day-close/preview') {
      const paidBills = (store.bills || []).filter((b: any) => b.payment_status === 'PAID');
      const totalSettled = paidBills.reduce((acc: number, b: any) => acc + Number(b.net_amount || 0), 0);
      const totalGST = paidBills.reduce((acc: number, b: any) => acc + Number(b.tax_amount || 0), 0);

      return makeRes({
        success: true,
        data: {
          businessDate: new Date().toISOString().slice(0, 10),
          totalBills: paidBills.length,
          totalGross: totalSettled,
          totalDiscounts: 0,
          totalGST: totalGST,
          totalNet: totalSettled,
          cashSales: totalSettled,
          upiSales: 0,
          cardSales: 0,
          refunds: 0,
          totalSettledSales: totalSettled,
        },
      });
    }

    if (path === '/api/billing/day-close' && method === 'POST') {
      return makeRes({ success: true });
    }

    // 7. INVENTORY
    if (path.startsWith('/api/inventory/ingredients')) {
      return makeRes({ success: true, data: store.ingredients });
    }

    if (path === '/api/inventory/alerts') {
      const alerts = store.ingredients.filter((i: any) => i.current_stock <= i.min_threshold);
      return makeRes({ success: true, data: alerts });
    }

    if (path === '/api/inventory/recipes') {
      return makeRes({ success: true, data: [] });
    }

    if (path.startsWith('/api/inventory/ledger')) {
      return makeRes({ success: true, data: [] });
    }

    // 8. EXPENSES & VENDORS
    if (path === '/api/expenses' && method === 'GET') {
      return makeRes({ success: true, data: store.expenses || [] });
    }

    if (path === '/api/expenses/vendors') {
      return makeRes({ success: true, data: store.vendors || [] });
    }

    // 9. SHIFTS
    if (path === '/api/shifts' && method === 'GET') {
      return makeRes({ success: true, data: store.shifts || [] });
    }

    if (path === '/api/shifts/payroll-summary') {
      return makeRes({ success: true, data: [] });
    }

    // 10. ANALYTICS
    if (path === '/api/analytics/pnl') {
      const paidBills = (store.bills || []).filter((b: any) => b.payment_status === 'PAID');
      const grossRevenue = paidBills.reduce((acc: number, b: any) => acc + Number(b.gross_amount || 0), 0);
      const discounts = paidBills.reduce((acc: number, b: any) => acc + Number(b.discount_amount || 0), 0);
      const taxableSales = paidBills.reduce((acc: number, b: any) => acc + Number(b.taxable_amount || 0), 0);
      const gstCollected = paidBills.reduce((acc: number, b: any) => acc + Number(b.tax_amount || 0), 0);
      const totalCollected = paidBills.reduce((acc: number, b: any) => acc + Number(b.paid_amount || b.net_amount || 0), 0);
      const invoiceCount = paidBills.length;

      return makeRes({
        success: true,
        data: {
          revenue: {
            grossRevenue,
            discounts,
            taxableSales,
            gstCollected,
            totalCollected,
            invoiceCount,
          },
          costOfSales: {
            cogs: Math.round(grossRevenue * 0.32 * 100) / 100,
            wastageCost: 0,
            totalProductionCost: Math.round(grossRevenue * 0.32 * 100) / 100,
          },
          grossProfit: {
            amount: Math.round(grossRevenue * 0.68 * 100) / 100,
            marginPercent: grossRevenue > 0 ? 68.0 : 0.0,
          },
          operatingExpenses: {
            breakdown: {},
            totalOperatingExpenses: 0,
          },
          netProfit: {
            amount: Math.round(grossRevenue * 0.68 * 100) / 100,
            marginPercent: grossRevenue > 0 ? 68.0 : 0.0,
            isProfitable: grossRevenue > 0,
          },
        },
      });
    }

    if (path === '/api/analytics/sales-breakdown') {
      const paidBills = (store.bills || []).filter((b: any) => b.payment_status === 'PAID');
      if (paidBills.length === 0) {
        return makeRes({
          success: true,
          data: {
            byOrderType: [],
            byCategory: [],
            topSellingDishes: [],
            byPaymentMethod: [],
          },
        });
      }

      const byOrderTypeMap: Record<string, { count: number; total: number }> = {};
      const byPaymentMap: Record<string, { count: number; total: number }> = {};
      const itemMap: Record<string, { name: string; qty: number; total: number; is_veg: boolean; category: string }> = {};

      paidBills.forEach((b: any) => {
        const type = b.order_type || 'DINE_IN';
        if (!byOrderTypeMap[type]) byOrderTypeMap[type] = { count: 0, total: 0 };
        byOrderTypeMap[type].count += 1;
        byOrderTypeMap[type].total += Number(b.net_amount || 0);

        const method = b.payment_method || 'CASH';
        if (!byPaymentMap[method]) byPaymentMap[method] = { count: 0, total: 0 };
        byPaymentMap[method].count += 1;
        byPaymentMap[method].total += Number(b.net_amount || 0);

        (b.items || []).forEach((it: any) => {
          if (!itemMap[it.item_name]) {
            itemMap[it.item_name] = { name: it.item_name, qty: 0, total: 0, is_veg: true, category: 'Cafe Dishes' };
          }
          itemMap[it.item_name].qty += it.quantity || 1;
          itemMap[it.item_name].total += Number(it.subtotal || 0);
        });
      });

      return makeRes({
        success: true,
        data: {
          byOrderType: Object.entries(byOrderTypeMap).map(([order_type, val]) => ({
            order_type,
            order_count: val.count,
            total_sales: val.total,
          })),
          byCategory: [],
          topSellingDishes: Object.values(itemMap).map((it) => ({
            item_id: it.name,
            item_name: it.name,
            category_name: it.category,
            is_veg: it.is_veg,
            total_quantity_sold: it.qty,
            total_sales_volume: it.total,
          })),
          byPaymentMethod: Object.entries(byPaymentMap).map(([payment_method, val]) => ({
            payment_method,
            transaction_count: val.count,
            total_amount: val.total,
          })),
        },
      });
    }

    // ==========================================
    // 12. TABLE QR ORDERING & CUSTOMER LOYALTY
    // ==========================================
    if ((path.startsWith('/api/public/table/') || path.startsWith('/api/customer-qr/table/')) && method === 'GET') {
      const qrToken = decodeURIComponent(path.split('/').pop() || '');
      const table = store.tables.find((t: any) => 
        t.qr_token === qrToken || 
        t.id === qrToken || 
        t.table_number.toLowerCase() === qrToken.toLowerCase() ||
        t.table_number.toLowerCase() === `t-${qrToken.toLowerCase()}` ||
        `tbl-${qrToken.padStart(2, '0')}` === t.id
      ) || store.tables[0];

      const cats = store.categories && store.categories.length > 0 ? store.categories : DEMO_CATEGORIES;
      const items = store.items && store.items.length > 0 ? store.items : DEMO_MENU_ITEMS;

      return makeRes({
        success: true,
        data: {
          table,
          categories: cats,
          menuItems: items,
        },
      });
    }

    if ((path === '/api/public/customer/send-otp' || path === '/api/customer-qr/customer/send-otp') && method === 'POST') {
      const phone = (body.phone || '').replace(/[^0-9]/g, '').slice(-10);
      return makeRes({
        success: true,
        message: `OTP sent successfully to +91 ${phone}`,
        data: {
          phone,
          demoOtp: '1234',
        },
      });
    }

    if ((path === '/api/public/customer/verify-otp' || path === '/api/customer-qr/customer/verify-otp') && method === 'POST') {
      const phone = (body.phone || '').replace(/[^0-9]/g, '').slice(-10);
      const name = body.name?.trim() || `Diner ${phone.slice(-4)}`;
      const dob = body.dob || '';
      let birthMonth: number | null = null;
      if (dob) {
        const parts = dob.split('-');
        if (parts.length >= 2) birthMonth = parseInt(parts[1], 10);
      }

      if (!store.customers) {
        store.customers = [];
      }

      let customer = store.customers.find((c: any) => c.phone === phone);
      const currentMonth = new Date().getMonth() + 1;

      if (!customer) {
        const firstName = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'ROLL';
        const referralCode = `ROLL-${firstName}-${phone.slice(-3)}`;
        let initialPoints = 50;
        if (body.referralCode && body.referralCode.trim()) {
          initialPoints += 50;
        }

        customer = {
          id: `cust-${Date.now()}`,
          phone,
          name,
          dob,
          birth_month: birthMonth,
          referral_code: referralCode,
          referred_by: body.referralCode || null,
          craving_points: initialPoints,
          total_orders: 0,
          current_streak: 0,
          streak_unlocked_at: null,
          created_at: new Date().toISOString(),
        };
        store.customers.push(customer);
        saveStore(store);
      } else {
        if (name && !customer.name.startsWith('Diner')) customer.name = name;
        if (dob) {
          customer.dob = dob;
          customer.birth_month = birthMonth;
        }
        saveStore(store);
      }

      const isBirthdayMonth = customer.birth_month === currentMonth;
      const isStreakActive = customer.streak_unlocked_at 
        ? new Date(customer.streak_unlocked_at).getTime() > Date.now() 
        : false;

      return makeRes({
        success: true,
        data: {
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            dob: customer.dob,
            birthMonth: customer.birth_month,
            referralCode: customer.referral_code,
            cravingPoints: customer.craving_points,
            totalOrders: customer.total_orders,
            currentStreak: customer.current_streak,
          },
          perks: {
            isBirthdayMonth,
            birthdayTreatAvailable: isBirthdayMonth,
            isStreakDiscountActive: isStreakActive,
            streakDiscountPercent: 10,
            nextFreeDishIn: Math.max(0, 5 - (customer.current_streak % 5)),
            freeDishUnlocked: customer.total_orders > 0 && customer.current_streak % 5 === 0,
          },
        },
      });
    }

    if ((path.startsWith('/api/public/customer/loyalty/') || path.startsWith('/api/customer-qr/customer/loyalty/')) && method === 'GET') {
      const phone = decodeURIComponent(path.split('/').pop() || '').replace(/[^0-9]/g, '').slice(-10);
      if (!store.customers) store.customers = [];
      const customer = store.customers.find((c: any) => c.phone === phone);
      if (!customer) {
        return makeRes({ success: false, error: 'Customer loyalty account not found' }, 404);
      }
      const currentMonth = new Date().getMonth() + 1;
      const isBirthdayMonth = customer.birth_month === currentMonth;
      const isStreakActive = customer.streak_unlocked_at 
        ? new Date(customer.streak_unlocked_at).getTime() > Date.now() 
        : false;

      return makeRes({
        success: true,
        data: {
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            dob: customer.dob,
            birthMonth: customer.birth_month,
            referralCode: customer.referral_code,
            cravingPoints: customer.craving_points,
            totalOrders: customer.total_orders,
            currentStreak: customer.current_streak,
          },
          perks: {
            isBirthdayMonth,
            birthdayTreatAvailable: isBirthdayMonth,
            isStreakDiscountActive: isStreakActive,
            streakDiscountPercent: 10,
            nextFreeDishIn: Math.max(0, 5 - (customer.current_streak % 5)),
            freeDishUnlocked: customer.total_orders > 0 && customer.current_streak % 5 === 0,
          },
        },
      });
    }

    if ((path === '/api/public/table-order' || path === '/api/customer-qr/table-order') && method === 'POST') {
      const table = store.tables.find((t: any) => t.id === body.tableId) || store.tables[0];
      if (table) {
        table.status = 'OCCUPIED';
      }

      const orderCount = store.orders.length + 1;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `ORD-${dateStr}-${orderCount.toString().padStart(3, '0')}`;
      const orderId = `ord-qr-${Date.now()}`;

      let subtotal = 0;
      const orderItems = (body.items || []).map((it: any, idx: number) => {
        const itemObj = store.items.find((m: any) => m.id === it.menuItemId);
        const itemSubtotal = it.quantity * it.unitPrice;
        subtotal += itemSubtotal;
        return {
          id: `oit-${orderId}-${idx + 1}`,
          order_id: orderId,
          menu_item_id: it.menuItemId,
          item_name: itemObj?.name || 'Cafe Item',
          variant_name: it.variantName || 'Single',
          quantity: it.quantity,
          unit_price: it.unitPrice.toFixed(2),
          subtotal: itemSubtotal.toFixed(2),
          notes: it.notes || '',
          item_status: 'COOKING',
          is_veg: itemObj?.is_veg ?? true,
          prep_time_minutes: itemObj?.prep_time_minutes ?? 6,
        };
      });

      const discountAmount = body.appliedDiscountPercent ? (subtotal * (body.appliedDiscountPercent / 100)) : 0;
      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const taxAmount = taxableAmount * 0.05;
      const totalAmount = (taxableAmount + taxAmount).toFixed(2);

      const newOrder = {
        id: orderId,
        order_number: orderNumber,
        order_type: 'QR_CUSTOMER',
        table_id: table.id,
        table_number: table.table_number,
        table_section: table.section,
        customer_name: body.customerName,
        customer_phone: body.customerPhone,
        status: 'SENT_TO_KITCHEN',
        order_notes: body.notes || `Table QR Self-Order from ${table.table_number}${body.appliedVoucher ? ` (${body.appliedVoucher})` : ''}`,
        created_at: new Date().toISOString(),
        elapsed_minutes: 0,
        subtotal: subtotal.toFixed(2),
        discount_amount: discountAmount.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        total_amount: totalAmount,
        items: orderItems,
      };

      store.orders.unshift(newOrder);

      // Update customer loyalty
      if (!store.customers) store.customers = [];
      const cleanPhone = (body.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);
      let customer = store.customers.find((c: any) => c.phone === cleanPhone);
      const earnedPoints = Math.max(10, Math.floor(Number(totalAmount) / 10));

      if (customer) {
        customer.total_orders += 1;
        customer.current_streak += 1;
        customer.craving_points += earnedPoints;
        if (Number(totalAmount) >= 300) {
          customer.streak_unlocked_at = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      saveStore(store);

      return makeRes({
        success: true,
        message: `Table order received for ${table.table_number}`,
        data: {
          orderId,
          orderNumber,
          tableNumber: table.table_number,
          section: table.section,
          totalAmount,
          earnedPoints,
          status: 'SENT_TO_KITCHEN',
        },
      }, 201);
    }

    // Default fallback
    return makeRes({ success: true, data: [] });
  };
}

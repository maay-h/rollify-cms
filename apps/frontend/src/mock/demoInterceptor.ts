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

const STORAGE_KEY = 'rollify_pos_demo_db_v1';

function getStore() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
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
    vendors: DEMO_VENDORS,
    expenses: DEMO_EXPENSES,
    orders: DEMO_INITIAL_ORDERS,
    bills: [
      {
        id: 'bill-01',
        bill_number: 'INV-20261122-001',
        order_id: 'ord-01',
        order_number: 'ROL-20261122-001',
        order_type: 'DINE_IN',
        table_number: 'T-01',
        customer_name: 'Priya Sharma',
        gross_amount: '398.00',
        discount_amount: '0.00',
        taxable_amount: '398.00',
        tax_amount: '19.90',
        net_amount: '417.90',
        paid_amount: '0.00',
        balance_due: 417.90,
        payment_status: 'UNPAID',
        cashier_name: 'Head Cashier',
        created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        items: [
          { id: 'bi-01', item_name: 'Rollify Signature Chicken Roll', variant_name: 'LRG', quantity: 2, unit_price: 169, subtotal: 338 },
          { id: 'bi-02', item_name: 'Peri Peri Fries', variant_name: 'REG', quantity: 1, unit_price: 99, subtotal: 99 },
        ],
        payments: [],
      },
    ],
    shifts: [
      {
        id: 'shf-01',
        user_id: 'usr-admin-01',
        full_name: 'System Admin',
        username: 'admin',
        role: 'ADMIN',
        shift_date: new Date().toISOString().slice(0, 10),
        clock_in: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        total_hours: 3.0,
        hourly_rate: 180,
        shift_wage: 540,
        status: 'ACTIVE',
      },
    ],
    dayClosings: [],
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStore));
  return initialStore;
}

function saveStore(store: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function initDemoInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept /api calls
    if (!urlStr.includes('/api/')) {
      return originalFetch(input, init);
    }

    // Attempt real backend if on localhost or if VITE_BACKEND_URL is set
    try {
      const realRes = await originalFetch(input, init);
      // If real backend responds with valid JSON (not 404/html)
      const ct = realRes.headers.get('content-type') || '';
      if (realRes.ok || (ct.includes('application/json') && realRes.status !== 404)) {
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
      const user = store.users.find((u: any) => u.pin_code === body.pinCode) || store.users[0];
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
          },
          token: `demo-token-${user.role.toLowerCase()}-${Date.now()}`,
        },
      });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const user = store.users.find((u: any) => u.username === body.identifier || u.email === body.identifier) || store.users[0];
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
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            pinCode: user.pin_code,
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
      return makeRes({ success: true, data: store.categories });
    }

    if (path === '/api/menu/items') {
      return makeRes({ success: true, data: store.items });
    }

    if (path.startsWith('/api/menu/items/')) {
      const itemId = path.split('/')[4];
      const item = store.items.find((i: any) => i.id === itemId);
      return makeRes({ success: true, data: item });
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

      const newBill = {
        id: `bill-${Date.now()}`,
        bill_number: `INV-20261122-${(store.bills.length + 1).toString().padStart(3, '0')}`,
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
        const paymentsList = body.payments || [];
        bill.payments = [...bill.payments, ...paymentsList.map((p: any) => ({ ...p, id: `pay-${Date.now()}` }))];
        const totalPaid = bill.payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
        bill.paid_amount = totalPaid.toFixed(2);
        bill.balance_due = Math.max(0, Number(bill.net_amount) - totalPaid);
        bill.payment_status = bill.balance_due <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        // complete the corresponding order
        const order = store.orders.find((o: any) => o.id === bill.order_id);
        if (order && bill.payment_status === 'PAID') {
          order.status = 'COMPLETED';
          const table = store.tables.find((t: any) => t.id === order.table_id);
          if (table) table.status = 'AVAILABLE';
        }

        saveStore(store);
      }
      return makeRes({ success: true, data: bill });
    }

    if (path.startsWith('/api/billing/') && method === 'GET' && !path.includes('day-close')) {
      const billId = path.split('/')[3];
      const bill = store.bills.find((b: any) => b.id === billId);
      return makeRes({ success: true, data: bill });
    }

    if (path === '/api/billing/day-close/preview') {
      const totalSettled = store.bills
        .filter((b: any) => b.payment_status === 'PAID')
        .reduce((acc: number, b: any) => acc + Number(b.net_amount), 0);

      return makeRes({
        success: true,
        data: {
          businessDate: new Date().toISOString().slice(0, 10),
          totalBills: store.bills.length,
          totalGross: totalSettled,
          totalDiscounts: 0,
          totalGST: totalSettled * 0.05,
          totalNet: totalSettled,
          cashSales: totalSettled * 0.45,
          upiSales: totalSettled * 0.40,
          cardSales: totalSettled * 0.15,
          refunds: 0,
          totalSettledSales: totalSettled || 2840.0,
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
      return makeRes({ success: true, data: store.expenses });
    }

    if (path === '/api/expenses/vendors') {
      return makeRes({ success: true, data: store.vendors });
    }

    // 9. SHIFTS
    if (path === '/api/shifts' && method === 'GET') {
      return makeRes({ success: true, data: store.shifts });
    }

    if (path === '/api/shifts/payroll-summary') {
      return makeRes({ success: true, data: [] });
    }

    // 10. ANALYTICS
    if (path === '/api/analytics/pnl') {
      return makeRes({
        success: true,
        data: {
          revenue: {
            grossRevenue: 48500,
            discounts: 1200,
            taxableSales: 47300,
            gstCollected: 2365,
            totalCollected: 49665,
            invoiceCount: 42,
          },
          costOfSales: {
            cogs: 14200,
            wastageCost: 450,
            totalProductionCost: 14650,
          },
          grossProfit: {
            amount: 32650,
            marginPercent: 69.0,
          },
          operatingExpenses: {
            breakdown: { RENT: 45000, UTILITIES: 8500, PACKAGING: 6200 },
            totalOperatingExpenses: 18500,
          },
          netProfit: {
            amount: 14150,
            marginPercent: 29.9,
            isProfitable: true,
          },
        },
      });
    }

    if (path === '/api/analytics/sales-breakdown') {
      return makeRes({
        success: true,
        data: {
          byOrderType: [
            { order_type: 'DINE_IN', order_count: 28, total_sales: 32400 },
            { order_type: 'TAKEAWAY', order_count: 14, total_sales: 16100 },
          ],
          byCategory: [
            { category_id: 'cat-rolls-nv', category_name: 'Rolls – Non-Veg', units_sold: 45, total_revenue: 7600 },
            { category_id: 'cat-starters-nv', category_name: 'Starters – Non-Veg', units_sold: 38, total_revenue: 5200 },
          ],
          topSellingDishes: [
            { item_id: 'rnv-05', item_name: 'Rollify Signature Chicken Roll', category_name: 'Rolls – Non-Veg', is_veg: false, total_quantity_sold: 32, total_sales_volume: 5408 },
            { item_id: 'bgr-01', item_name: 'Chicken Zinger Burger + Fries', category_name: 'Burgers', is_veg: false, total_quantity_sold: 21, total_sales_volume: 3969 },
          ],
          byPaymentMethod: [
            { payment_method: 'UPI', transaction_count: 24, total_amount: 27500 },
            { payment_method: 'CASH', transaction_count: 12, total_amount: 14200 },
            { payment_method: 'CARD', transaction_count: 6, total_amount: 6800 },
          ],
        },
      });
    }

    // Default fallback
    return makeRes({ success: true, data: [] });
  };
}

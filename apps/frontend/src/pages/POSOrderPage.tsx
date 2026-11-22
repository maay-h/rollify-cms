import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Send, 
  UtensilsCrossed, 
  Package, 
  Clock, 
  Flame, 
  ChefHat, 
  Check, 
  Receipt 
} from 'lucide-react';
import { clsx } from 'clsx';

interface MenuItemVariant {
  id: string;
  variant_name: string;
  price: string | number;
  is_available: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: string;
  is_veg: boolean;
  is_chef_special?: boolean;
  is_spicy?: boolean;
  prep_time_minutes: number;
  variants?: MenuItemVariant[];
}

interface CartItem {
  cartId: string;
  menuItemId: string;
  name: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  isVeg: boolean;
}

interface DiningTable {
  id: string;
  table_number: string;
  section: string;
  status: string;
}

export const POSOrderPage: React.FC = () => {
  const { token, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Active Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Variant Selection Modal
  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsRes, itemsRes, tablesRes] = await Promise.all([
          fetch('/api/menu/categories', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/menu/items', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/tables', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const catsJson = await catsRes.json();
        const itemsJson = await itemsRes.json();
        const tablesJson = await tablesRes.json();

        if (catsJson.data) setCategories(catsJson.data);
        if (itemsJson.data) setMenuItems(itemsJson.data);
        if (tablesJson.data) {
          setTables(tablesJson.data);
          // Auto select first available table if dine-in
          const firstAvail = tablesJson.data.find((t: DiningTable) => t.status === 'AVAILABLE');
          if (firstAvail) setSelectedTableId(firstAvail.id);
        }
      } catch (err) {
        toast.error('Failed to load POS catalog data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Add Item to Cart
  const handleItemClick = (item: MenuItem) => {
    // If item has multiple size variants, prompt size selection modal
    if (item.variants && item.variants.length > 1) {
      setVariantModalItem(item);
    } else {
      // Single price item
      const price = Number(item.price);
      addToCart(item, undefined, undefined, price);
    }
  };

  const addToCart = (
    item: MenuItem,
    variantId?: string,
    variantName?: string,
    unitPrice: number = Number(item.price)
  ) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.menuItemId === item.id && c.variantName === (variantName || 'Single')
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }

      return [
        ...prev,
        {
          cartId: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          menuItemId: item.id,
          name: item.name,
          variantId,
          variantName: variantName || 'Single',
          unitPrice,
          quantity: 1,
          isVeg: item.is_veg,
        },
      ];
    });

    toast.info(`Added to Order`, `${item.name} ${variantName ? `(${variantName})` : ''}`);
    setVariantModalItem(null);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId === cartId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateItemNotes = (cartId: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) => (item.cartId === cartId ? { ...item, notes } : item))
    );
  };

  // Calculations
  const subtotal = cart.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const taxRate = 5.0; // 5% GST
  const taxAmount = Math.round((subtotal * (taxRate / 100)) * 100) / 100;
  const parcelCharge = (orderType === 'TAKEAWAY' || orderType === 'DELIVERY') ? 10.0 : 0.0;
  const grandTotal = Math.round((subtotal + taxAmount + parcelCharge) * 100) / 100;

  // Submit Order
  const submitOrder = async (sendDirectlyToKitchen: boolean) => {
    if (cart.length === 0) {
      toast.warning('Empty Cart', 'Please add at least one item before placing order');
      return;
    }

    if (orderType === 'DINE_IN' && !selectedTableId) {
      toast.error('Select Dining Table', 'Please assign a table for dine-in orders');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        orderType,
        tableId: orderType === 'DINE_IN' ? selectedTableId : null,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        notes: orderNotes || undefined,
        autoSendToKitchen: sendDirectlyToKitchen,
        items: cart.map((it) => ({
          menuItemId: it.menuItemId,
          variantId: it.variantId,
          variantName: it.variantName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          notes: it.notes,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(
          sendDirectlyToKitchen ? 'Dispatched to Kitchen!' : 'Order Saved (Draft)',
          `Order ${json.data.orderNumber} successfully logged`
        );
        // Clear cart
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setOrderNotes('');
        navigate('/orders');
      } else {
        toast.error('Order Creation Failed', json.error);
      }
    } catch (err: any) {
      toast.error('Network Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    if (selectedCat !== 'ALL' && item.category_id !== selectedCat) return false;
    if (vegOnly && !item.is_veg) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <LoadingSpinner text="Starting Rollify Fast Order POS Terminal..." />;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 max-w-[1700px] mx-auto h-[calc(100vh-100px)]">
      {/* LEFT: Menu Browsing & Item Selection (70% width) */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-stone-200/80 p-5 overflow-hidden shadow-xs">
        {/* Top Controls: Search + Veg Toggle */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search dishes or type item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rollify-red"
            />
          </div>

          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={clsx(
              'px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 shrink-0',
              vegOnly
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            Veg Only
          </button>
        </div>

        {/* Category Horizontal Scroll Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-2 border-b border-stone-100 shrink-0">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0',
              selectedCat === 'ALL'
                ? 'bg-rollify-red text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            All Items
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0',
                selectedCat === c.id
                  ? 'bg-rollify-red text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Items Grid (Touch-optimized large cards) */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="p-3.5 rounded-2xl border border-stone-200 hover:border-rollify-gold hover:shadow-md transition cursor-pointer bg-white flex flex-col justify-between active:scale-[0.98] select-none group"
            >
              <div>
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span
                    className={clsx(
                      'w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 mt-0.5',
                      item.is_veg ? 'border-emerald-600' : 'border-red-600'
                    )}
                  >
                    <span
                      className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                      )}
                    />
                  </span>

                  <span className="text-xs font-mono font-bold text-rollify-charcoal group-hover:text-rollify-red">
                    {item.variants && item.variants.length > 1 ? (
                      `₹${item.variants[0].price}+`
                    ) : (
                      `₹${Number(item.price)}`
                    )}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-stone-900 leading-snug line-clamp-2">
                  {item.name}
                </h4>

                <div className="flex items-center gap-1 mt-1.5">
                  {item.is_chef_special && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                      ★ Special
                    </span>
                  )}
                  {item.is_spicy && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-900">
                      🌶 Spicy
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400 font-medium">
                <span>{item.prep_time_minutes}m prep</span>
                <span className="text-rollify-red font-bold flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Add
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Active Order Cart & Fast Checkout (30% width) */}
      <div className="w-full xl:w-96 flex flex-col bg-white rounded-3xl border border-stone-200/80 p-5 shadow-sm">
        {/* Order Mode Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-2xl mb-4">
          <button
            onClick={() => setOrderType('DINE_IN')}
            className={clsx(
              'py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1',
              orderType === 'DINE_IN' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
            )}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Dine-In
          </button>
          <button
            onClick={() => setOrderType('TAKEAWAY')}
            className={clsx(
              'py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1',
              orderType === 'TAKEAWAY' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
            )}
          >
            <Package className="w-3.5 h-3.5" />
            Parcel (+₹10)
          </button>
          <button
            onClick={() => setOrderType('DELIVERY')}
            className={clsx(
              'py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1',
              orderType === 'DELIVERY' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
            )}
          >
            Delivery
          </button>
        </div>

        {/* Table Selector (if Dine-in) */}
        {orderType === 'DINE_IN' && (
          <div className="mb-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Select Table
            </label>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rollify-red"
            >
              <option value="">-- Choose Dining Table --</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.table_number} ({t.section}) - {t.status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Customer Details Accordion (Optional) */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="text"
            placeholder="Guest Name (Optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl py-1.5 px-3 text-xs focus:outline-none"
          />
          <input
            type="text"
            placeholder="Phone (Optional)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl py-1.5 px-3 text-xs focus:outline-none"
          />
        </div>

        {/* Cart Itemized List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 my-2 pr-1 border-y border-stone-100 py-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
              <UtensilsCrossed className="w-10 h-10 stroke-[1.5] mb-2 text-stone-300" />
              <p className="text-xs font-semibold text-stone-600">Cart is Empty</p>
              <p className="text-[11px] text-stone-400">Tap items on the left to add them to this order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartId} className="p-2.5 bg-stone-50 rounded-2xl border border-stone-200/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          'w-2.5 h-2.5 rounded-full shrink-0',
                          item.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                        )}
                      />
                      <h5 className="text-xs font-bold text-stone-900 leading-tight">
                        {item.name}
                      </h5>
                    </div>
                    {item.variantName && item.variantName !== 'Single' && (
                      <span className="text-[10px] font-mono bg-stone-200 px-1.5 py-0.2 rounded text-stone-700 ml-4 font-bold">
                        {item.variantName}
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono font-bold text-stone-900">
                    ₹{item.unitPrice * item.quantity}
                  </span>
                </div>

                {/* Notes Input per item */}
                <input
                  type="text"
                  placeholder="Notes: e.g. Extra spicy, no onion..."
                  value={item.notes || ''}
                  onChange={(e) => updateItemNotes(item.cartId, e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-lg py-1 px-2 text-[11px] mt-1.5 text-stone-700 focus:outline-none"
                />

                {/* Quantity Controls */}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-200/40">
                  <span className="text-[10px] text-stone-400 font-mono">
                    ₹{item.unitPrice} each
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.cartId, -1)}
                      className="w-6 h-6 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono font-bold w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.cartId, 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bill Summary Calculations */}
        <div className="pt-2 space-y-1.5 text-xs text-stone-600">
          <div className="flex justify-between">
            <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} items)</span>
            <span className="font-mono">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>GST (5%)</span>
            <span className="font-mono">₹{taxAmount.toFixed(2)}</span>
          </div>
          {parcelCharge > 0 && (
            <div className="flex justify-between text-stone-500">
              <span>Parcel Charge</span>
              <span className="font-mono">₹{parcelCharge.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-black text-stone-900 pt-2 border-t border-stone-100">
            <span>Grand Total</span>
            <span className="font-mono text-rollify-red">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cart.length === 0 || isSubmitting}
            onClick={() => submitOrder(false)}
          >
            Save Draft
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={cart.length === 0}
            onClick={() => submitOrder(true)}
            rightIcon={<Send className="w-3.5 h-3.5" />}
          >
            Send KOT
          </Button>
        </div>
      </div>

      {/* Size Variant Selector Modal */}
      <Modal
        isOpen={Boolean(variantModalItem)}
        onClose={() => setVariantModalItem(null)}
        title={
          <div className="flex items-center gap-2">
            <span>Select Size: {variantModalItem?.name}</span>
          </div>
        }
        maxWidth="sm"
      >
        <div className="space-y-3 py-2">
          <p className="text-xs text-stone-500">
            Choose portion size for this dish:
          </p>

          <div className="grid grid-cols-2 gap-3">
            {variantModalItem?.variants?.map((v) => (
              <button
                key={v.id}
                onClick={() =>
                  variantModalItem &&
                  addToCart(variantModalItem, v.id, v.variant_name, Number(v.price))
                }
                className="p-4 rounded-2xl border-2 border-stone-200 hover:border-rollify-red hover:bg-rollify-red-50 text-center transition group active:scale-95"
              >
                <span className="block text-sm font-extrabold text-stone-900 group-hover:text-rollify-red">
                  {v.variant_name === 'REG' ? 'Regular' : v.variant_name === 'LRG' ? 'Large' : v.variant_name}
                </span>
                <span className="block text-base font-black font-mono text-rollify-charcoal mt-1">
                  ₹{Number(v.price)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

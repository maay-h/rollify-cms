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
  Receipt,
  MessageSquare,
  Sparkles,
  Coffee,
  CupSoda,
  Tag
} from 'lucide-react';
import { clsx } from 'clsx';
import { DEMO_CATEGORIES, DEMO_MENU_ITEMS, DEMO_TABLES } from '../mock/demoStore.js';

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
  image_url?: string;
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
  imageUrl?: string;
}

interface DiningTable {
  id: string;
  table_number: string;
  section: string;
  status: string;
  active_order_id?: string;
  active_order_number?: string;
}

const SPECIAL_INSTRUCTION_PRESETS = [
  'Extra Sugar',
  'Less Sugar',
  'No Sugar',
  'Extra Shot',
  'Less Spicy',
  'Extra Spicy',
  'No Onion',
  'Extra Cheese',
  'Less Ice',
  'Oat Milk',
  'Serve Hot',
];

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

  // Variant & Customization Modal State
  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [itemNoteInput, setItemNoteInput] = useState<string>('');

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

        if (catsJson && Array.isArray(catsJson.data) && catsJson.data.length > 0) {
          setCategories(catsJson.data);
        } else {
          setCategories(DEMO_CATEGORIES);
        }

        if (itemsJson && Array.isArray(itemsJson.data) && itemsJson.data.length > 0) {
          setMenuItems(itemsJson.data);
        } else {
          setMenuItems(DEMO_MENU_ITEMS);
        }

        const validTables = (tablesJson && Array.isArray(tablesJson.data) && tablesJson.data.length > 0)
          ? tablesJson.data
          : (DEMO_TABLES as any);

        setTables(validTables);
        const firstAvail = validTables.find((t: DiningTable) => t.status === 'AVAILABLE');
        if (firstAvail) setSelectedTableId(firstAvail.id);
      } catch (err) {
        // Fallback to local official catalog
        setCategories(DEMO_CATEGORIES);
        setMenuItems(DEMO_MENU_ITEMS);
        setTables(DEMO_TABLES as any);
        const firstAvail = (DEMO_TABLES as any).find((t: DiningTable) => t.status === 'AVAILABLE');
        if (firstAvail) setSelectedTableId(firstAvail.id);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Selected table info
  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const isSelectedTableOccupied = selectedTable?.status === 'OCCUPIED';

  // Add Item to Cart
  const handleItemClick = (item: MenuItem) => {
    if (item.variants && item.variants.length > 1) {
      setVariantModalItem(item);
    } else {
      const price = Number(item.price);
      addToCart(item, undefined, undefined, price);
    }
  };

  const addToCart = (
    item: MenuItem,
    variantId?: string,
    variantName?: string,
    unitPrice: number = Number(item.price),
    notes?: string
  ) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.menuItemId === item.id && c.variantName === (variantName || 'Single') && c.notes === notes
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
          notes: notes || '',
          isVeg: item.is_veg,
          imageUrl: item.image_url,
        },
      ];
    });

    toast.info(`Added to Cart`, `${item.name} ${variantName ? `(${variantName})` : ''}`);
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

  const openItemInstructions = (item: CartItem) => {
    setEditingCartItem(item);
    setItemNoteInput(item.notes || '');
  };

  const saveItemInstructions = () => {
    if (!editingCartItem) return;
    setCart((prev) =>
      prev.map((c) => (c.cartId === editingCartItem.cartId ? { ...c, notes: itemNoteInput.trim() } : c))
    );
    setEditingCartItem(null);
    setItemNoteInput('');
    toast.success('Customization Updated', 'Special instructions saved to item');
  };

  const togglePresetInstruction = (preset: string) => {
    const existing = itemNoteInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (existing.includes(preset)) {
      setItemNoteInput(existing.filter((s) => s !== preset).join(', '));
    } else {
      setItemNoteInput([...existing, preset].join(', '));
    }
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
      toast.warning('Empty Cart', 'Please add at least one item before submitting');
      return;
    }

    if (orderType === 'DINE_IN' && !selectedTableId) {
      toast.error('Select Dining Table', 'Please assign a table for dine-in orders');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if appending to existing active table order
      if (orderType === 'DINE_IN' && selectedTable?.status === 'OCCUPIED' && selectedTable.active_order_id) {
        const payload = {
          items: cart.map((it) => ({
            menuItemId: it.menuItemId,
            variantId: it.variantId,
            variantName: it.variantName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            notes: it.notes,
          })),
        };

        const res = await fetch(`/api/orders/${selectedTable.active_order_id}/items`, {
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
            'Added to Table Order!',
            `Items added to ${selectedTable.table_number}. Kitchen notified.`
          );
          setCart([]);
          navigate('/orders');
          return;
        }
      }

      // Standard New Order Placement
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
          sendDirectlyToKitchen ? 'Dispatched to Kitchen!' : 'Order Logged (Draft)',
          `Order ${json.data.orderNumber} successfully created`
        );
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
    return <LoadingSpinner text="Loading Cafe POS Order Terminal..." />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 max-w-[1750px] mx-auto min-h-[calc(100vh-100px)] lg:h-[calc(100vh-100px)]">
      {/* LEFT: Menu Browsing & Item Selection (70% width) */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-stone-200/80 p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden min-h-[550px] lg:min-h-0">
        {/* Top Controls: Search + Veg Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search coffee, tea, burgers, rolls, desserts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1810]"
            />
          </div>

          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={clsx(
              'px-4 py-2.5 rounded-2xl text-xs font-bold border transition flex items-center gap-2 shrink-0 cursor-pointer',
              vegOnly
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-xs'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            Pure Veg
          </button>
        </div>

        {/* Category Horizontal Scroll Pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3 border-b border-stone-100 shrink-0 select-none">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5',
              selectedCat === 'ALL'
                ? 'bg-[#2D1810] text-white shadow-xs'
                : 'bg-[#FAF7F2] text-stone-600 hover:bg-stone-200/70 border border-stone-200/50'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
            All Items ({menuItems.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5',
                selectedCat === c.id
                  ? 'bg-[#2D1810] text-white shadow-xs'
                  : 'bg-[#FAF7F2] text-stone-700 hover:bg-stone-200/70 border border-stone-200/50'
              )}
            >
              {c.name.includes('Coffee') && <Coffee className="w-3.5 h-3.5 text-[#EA580C]" />}
              {c.name.includes('Tea') && <CupSoda className="w-3.5 h-3.5 text-[#EA580C]" />}
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid with Food Images */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 min-h-0">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900">No menu items match your filter</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm">
                Try resetting your search query or selecting a different category tab.
              </p>
              <button
                type="button"
                onClick={() => { setSelectedCat('ALL'); setSearch(''); setVegOnly(false); }}
                className="mt-4 px-4 py-2 bg-[#2D1810] text-white text-xs font-bold rounded-xl hover:bg-stone-800 transition cursor-pointer"
              >
                Show All Menu Items ({menuItems.length})
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="rounded-2xl border border-stone-200/90 hover:border-[#EA580C] hover:shadow-md transition cursor-pointer bg-white flex flex-col justify-between active:scale-[0.98] select-none group overflow-hidden min-h-[220px]"
            >
              {/* Product Photo Canvas */}
              <div className="relative w-full h-32 min-h-[128px] bg-stone-100 overflow-hidden shrink-0">
                <img
                  src={item.image_url || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80'}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80';
                  }}
                />
                {/* Veg/Non-Veg Tag */}
                <div className="absolute top-2 left-2 z-10">
                  <span
                    className={clsx(
                      'w-4 h-4 rounded-xs border-2 bg-white/95 backdrop-blur-xs flex items-center justify-center shadow-xs',
                      item.is_veg ? 'border-emerald-600' : 'border-red-600'
                    )}
                  >
                    <span
                      className={clsx('w-2 h-2 rounded-full', item.is_veg ? 'bg-emerald-600' : 'bg-red-600')}
                    />
                  </span>
                </div>

                {/* Chef Special / Spicy Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                  {item.is_chef_special && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#EA580C] text-white shadow-xs">
                      ★ Special
                    </span>
                  )}
                  {item.is_spicy && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-red-600 text-white shadow-xs">
                      🌶 Spicy
                    </span>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3 flex-1 flex flex-col justify-between min-h-[85px]">
                <div>
                  <h4 className="text-xs font-bold text-[#2D1810] leading-snug line-clamp-1 group-hover:text-[#EA580C] transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                    {item.description || 'Artisanal cafe special'}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between shrink-0">
                  <span className="text-xs font-mono font-black text-[#2D1810]">
                    {item.variants && item.variants.length > 1 ? (
                      `₹${item.variants[0].price}+`
                    ) : (
                      `₹${Number(item.price)}`
                    )}
                  </span>

                  <span className="text-[11px] font-bold text-[#EA580C] bg-[#FFF7ED] px-2 py-0.5 rounded-lg flex items-center gap-1 group-hover:bg-[#EA580C] group-hover:text-white transition-all">
                    <Plus className="w-3 h-3" /> Add
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      </div>

      {/* RIGHT: Active Order Cart & Fast Checkout (30% width) */}
      <div id="pos-cart-panel" className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col bg-white rounded-3xl border border-stone-200/80 p-4 sm:p-5 shadow-xs overflow-hidden">
        {/* Order Mode Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FAF7F2] border border-stone-200/60 rounded-2xl mb-3">
          <button
            onClick={() => setOrderType('DINE_IN')}
            className={clsx(
              'py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer',
              orderType === 'DINE_IN' ? 'bg-[#2D1810] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            )}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Dine-In
          </button>
          <button
            onClick={() => setOrderType('TAKEAWAY')}
            className={clsx(
              'py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer',
              orderType === 'TAKEAWAY' ? 'bg-[#2D1810] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            )}
          >
            <Package className="w-3.5 h-3.5" />
            Takeaway
          </button>
          <button
            onClick={() => setOrderType('DELIVERY')}
            className={clsx(
              'py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer',
              orderType === 'DELIVERY' ? 'bg-[#2D1810] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            )}
          >
            Delivery
          </button>
        </div>

        {/* Table Selector (if Dine-in) */}
        {orderType === 'DINE_IN' && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Assigned Table
              </label>
              {isSelectedTableOccupied && (
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900">
                  Occupied (Active Order)
                </span>
              )}
            </div>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-stone-200 rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2D1810]"
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
            placeholder="Customer name (opt)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#2D1810]"
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#2D1810]"
          />
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto pr-1 divide-y divide-stone-100 mb-3 min-h-[160px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] flex items-center justify-center text-[#2D1810] mb-2">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-stone-700">Order Cart is Empty</p>
              <p className="text-[10px] text-stone-400 mt-1 max-w-[180px]">
                Select dishes or drinks from the menu to build the customer's order.
              </p>
            </div>
          ) : (
            cart.map((it) => (
              <div key={it.cartId} className="py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          'w-2 h-2 rounded-full shrink-0',
                          it.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                        )}
                      />
                      <span className="text-xs font-bold text-stone-900 truncate">
                        {it.name}
                      </span>
                    </div>
                    {it.variantName && it.variantName !== 'Single' && (
                      <span className="text-[10px] text-[#EA580C] font-semibold pl-3.5">
                        Size: {it.variantName}
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono font-bold text-stone-900">
                    ₹{it.unitPrice * it.quantity}
                  </span>
                </div>

                {/* Special Instructions Chip & Notes */}
                <div className="flex items-center justify-between pl-3.5 gap-2">
                  <button
                    onClick={() => openItemInstructions(it)}
                    className="text-[10px] text-[#EA580C] hover:underline flex items-center gap-1 font-medium bg-[#FFF7ED] px-2 py-0.5 rounded-md"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {it.notes ? `Note: ${it.notes}` : '+ Add Instructions'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(it.cartId, -1)}
                      className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold font-mono w-4 text-center">
                      {it.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(it.cartId, 1)}
                      className="w-6 h-6 rounded-lg bg-[#2D1810] text-white flex items-center justify-center font-bold transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => updateQuantity(it.cartId, -it.quantity)}
                      className="text-stone-300 hover:text-red-500 p-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global Order Note */}
        <input
          type="text"
          placeholder="General kitchen instructions (e.g. Serve hot)..."
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-stone-200 rounded-xl text-xs mb-3 focus:outline-none focus:ring-1 focus:ring-[#2D1810]"
        />

        {/* Price Breakdown */}
        <div className="p-3 bg-[#FAF7F2] border border-stone-200/80 rounded-2xl space-y-1.5 mb-3 text-xs">
          <div className="flex justify-between text-stone-600">
            <span>Item Subtotal</span>
            <span className="font-mono">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>GST (5.0%)</span>
            <span className="font-mono">₹{taxAmount.toFixed(2)}</span>
          </div>
          {parcelCharge > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>Parcel Packaging</span>
              <span className="font-mono">₹{parcelCharge.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[#2D1810] font-black text-sm pt-1.5 border-t border-stone-200">
            <span>Total Payable</span>
            <span className="font-mono text-[#EA580C]">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full bg-[#2D1810] hover:bg-[#1A0E09] text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-bold"
            disabled={cart.length === 0 || isSubmitting}
            onClick={() => submitOrder(true)}
          >
            <Send className="w-4 h-4 text-[#EA580C]" />
            {isSubmitting
              ? 'Sending...'
              : isSelectedTableOccupied
              ? `Add Items to ${selectedTable?.table_number}`
              : 'Send to Kitchen (KOT)'}
          </Button>

          <Button
            variant="outline"
            className="w-full text-stone-600 border-stone-200 hover:bg-stone-50 py-2 rounded-2xl text-xs font-semibold"
            disabled={cart.length === 0 || isSubmitting}
            onClick={() => submitOrder(false)}
          >
            Save Draft Order
          </Button>
        </div>
      </div>

      {/* Mobile / Tablet Floating Cart Bar (lg:hidden) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-[#2D1810] text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-amber-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#EA580C] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {cart.reduce((a, c) => a + c.quantity, 0)}
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">Order Cart Active</p>
              <p className="text-[10px] text-stone-300 font-mono">Total: ₹{grandTotal.toFixed(2)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('pos-cart-panel');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 bg-white text-[#2D1810] text-xs font-bold rounded-xl hover:bg-stone-100 transition shadow-xs"
          >
            Review & Send ↓
          </button>
        </div>
      )}

      {/* Size Variant Modal */}
      {variantModalItem && (
        <Modal
          isOpen={true}
          onClose={() => setVariantModalItem(null)}
          title={`Select Size - ${variantModalItem.name}`}
          maxWidth="sm"
        >
          <div className="space-y-3">
            <p className="text-xs text-stone-600">
              Choose your portion size for this cafe special:
            </p>
            <div className="space-y-2">
              {variantModalItem.variants?.map((v) => (
                <button
                  key={v.id}
                  onClick={() =>
                    addToCart(variantModalItem, v.id, v.variant_name, Number(v.price))
                  }
                  className="w-full p-3 rounded-xl border border-stone-200 hover:border-[#2D1810] hover:bg-[#FAF7F2] flex items-center justify-between text-xs font-bold transition group"
                >
                  <span className="text-[#2D1810] group-hover:text-[#EA580C]">
                    {v.variant_name} Portion
                  </span>
                  <span className="font-mono text-stone-900">₹{v.price}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Special Instructions & Customization Modal */}
      {editingCartItem && (
        <Modal
          isOpen={true}
          onClose={() => setEditingCartItem(null)}
          title={`Customization - ${editingCartItem.name}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              Select standard preparation presets or enter custom instructions:
            </p>

            {/* Preset instruction chips */}
            <div className="flex flex-wrap gap-1.5">
              {SPECIAL_INSTRUCTION_PRESETS.map((preset) => {
                const isSelected = itemNoteInput.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => togglePresetInstruction(preset)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border',
                      isSelected
                        ? 'bg-[#2D1810] text-white border-[#2D1810]'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            {/* Freeform text input */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                Custom Kitchen Note
              </label>
              <textarea
                rows={2}
                value={itemNoteInput}
                onChange={(e) => setItemNoteInput(e.target.value)}
                placeholder="e.g. Extra hot, no whipped cream, serve on the side..."
                className="w-full p-2.5 bg-[#FAF7F2] border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2D1810]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingCartItem(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#2D1810] text-white"
                onClick={saveItemInstructions}
              >
                Save Instructions
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

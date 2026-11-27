import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  UtensilsCrossed, 
  Search, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Gift, 
  Cake, 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  Coffee, 
  CupSoda, 
  Clock, 
  ChefHat, 
  ChevronRight, 
  X, 
  Flame, 
  Phone, 
  User, 
  Calendar, 
  ArrowLeft,
  CheckCircle2,
  Tag,
  Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { DEMO_CATEGORIES, DEMO_MENU_ITEMS, DEMO_TABLES, getProductImage } from '../mock/demoStore.js';

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
  capacity?: number;
  status: string;
  qr_token: string;
}

interface CustomerLoyalty {
  id: string;
  name: string;
  phone: string;
  dob?: string;
  birthMonth?: number;
  referralCode: string;
  cravingPoints: number;
  totalOrders: number;
  currentStreak: number;
}

interface LoyaltyPerks {
  isBirthdayMonth: boolean;
  birthdayTreatAvailable: boolean;
  isStreakDiscountActive: boolean;
  streakDiscountPercent: number;
  nextFreeDishIn: number;
  freeDishUnlocked: boolean;
}

const SPECIAL_INSTRUCTION_PRESETS = [
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

export const TableQROrderPage: React.FC = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();

  // Core Data
  const [table, setTable] = useState<DiningTable | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customization Modal
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');

  // Customer Loyalty State
  const [customer, setCustomer] = useState<CustomerLoyalty | null>(null);
  const [perks, setPerks] = useState<LoyaltyPerks | null>(null);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [isLoyaltyExpanded, setIsLoyaltyExpanded] = useState(false);

  // OTP Login Flow State
  const [otpStep, setOtpStep] = useState<'PHONE' | 'OTP' | 'PROFILE'>('PHONE');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [dobInput, setDobInput] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Active Placed Order Screen
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  // Discounts
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [appliedVoucher, setAppliedVoucher] = useState<string>('');

  // Call Waiter / Service Assistance State
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [waiterReason, setWaiterReason] = useState('General Assistance');
  const [waiterNotes, setWaiterNotes] = useState('');
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [waiterCallCooldown, setWaiterCallCooldown] = useState(0);
  const [waiterCallSuccessMessage, setWaiterCallSuccessMessage] = useState('');

  // Waiter Call Cooldown Timer
  useEffect(() => {
    if (waiterCallCooldown <= 0) return;
    const timer = setInterval(() => {
      setWaiterCallCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [waiterCallCooldown]);

  // Handle Call Waiter Submission
  const handleCallWaiter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (waiterCallCooldown > 0) return;

    setIsCallingWaiter(true);
    try {
      const payload = {
        tableId: table?.id || 'tbl-01',
        tableNumber: table?.table_number || 'T-01',
        reason: waiterReason,
        notes: waiterNotes.trim(),
      };

      const res = await fetch('/api/public/table/call-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setWaiterCallSuccessMessage(data.message || `Staff alerted for ${table?.table_number || 'Table'}! Assistance is on the way.`);
      setWaiterCallCooldown(60);
      setIsCallWaiterOpen(false);
      setWaiterNotes('');
    } catch (err) {
      setWaiterCallSuccessMessage(`Staff alerted for ${table?.table_number || 'Table'}! Assistance is on the way.`);
      setWaiterCallCooldown(60);
      setIsCallWaiterOpen(false);
    } finally {
      setIsCallingWaiter(false);
    }
  };

  // 1. Load Stored Customer Profile on Init
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rollify_customer_loyalty');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.customer) {
          setCustomer(parsed.customer);
          setPerks(parsed.perks || null);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Fetch Table Data and Menu
  useEffect(() => {
    const fetchTableMenu = async () => {
      try {
        const tokenToFetch = qrToken || 'QR_TBL_01_ROL';
        const res = await fetch(`/api/public/table/${encodeURIComponent(tokenToFetch)}`);
        const json = await res.json();

        if (json.success && json.data) {
          setTable(json.data.table);
          setCategories(json.data.categories || DEMO_CATEGORIES);
          setMenuItems(json.data.menuItems || DEMO_MENU_ITEMS);
        } else {
          // Fallback table matching
          const found = (DEMO_TABLES as any).find(
            (t: any) => t.qr_token === tokenToFetch || t.id === tokenToFetch || t.table_number.toLowerCase() === tokenToFetch.toLowerCase()
          ) || DEMO_TABLES[0];
          setTable(found as any);
          setCategories(DEMO_CATEGORIES);
          setMenuItems(DEMO_MENU_ITEMS);
        }
      } catch (err) {
        setTable(DEMO_TABLES[0] as any);
        setCategories(DEMO_CATEGORIES);
        setMenuItems(DEMO_MENU_ITEMS);
      } finally {
        setLoading(false);
      }
    };

    fetchTableMenu();
  }, [qrToken]);

  // Handle Item Click for Customization or Direct Add
  const handleItemClick = (item: MenuItem) => {
    if ((item.variants && item.variants.length > 1) || item.prep_time_minutes > 5) {
      setCustomizingItem(item);
      setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
      setCustomInstructions('');
    } else {
      addToCart(item, undefined, undefined, Number(item.price), '');
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
          imageUrl: item.image_url || getProductImage(item.category_id, item.name),
        },
      ];
    });

    setCustomizingItem(null);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.cartId === cartId) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Calculations
  const subtotal = cart.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const discountAmount = Math.round((subtotal * (appliedDiscount / 100)) * 100) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRate = 5.0; // 5% GST
  const taxAmount = Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // OTP Login Handlers
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneInput.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setOtpError('Please enter a valid 10-digit mobile number');
      return;
    }

    setOtpSending(true);
    setOtpError('');
    try {
      const res = await fetch('/api/public/customer/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean }),
      });
      const json = await res.json();
      if (json.success) {
        setOtpStep('OTP');
        setOtpInput(json.data?.demoOtp || '1234'); // Pre-fill 1234 for seamless demo
      } else {
        setOtpError(json.error || 'Failed to send OTP');
      }
    } catch {
      setOtpStep('OTP');
      setOtpInput('1234');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.length < 4) {
      setOtpError('Please enter the 4-digit OTP code');
      return;
    }

    setOtpSending(true);
    setOtpError('');
    try {
      const clean = phoneInput.replace(/[^0-9]/g, '').slice(-10);
      const res = await fetch('/api/public/customer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean,
          otp: otpInput,
          name: nameInput,
          dob: dobInput,
          referralCode: referralInput,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCustomer(json.data.customer);
        setPerks(json.data.perks);
        localStorage.setItem(
          'rollify_customer_loyalty',
          JSON.stringify({ customer: json.data.customer, perks: json.data.perks })
        );
        setIsLoyaltyModalOpen(false);
        setIsLoyaltyExpanded(true);
      } else {
        setOtpError(json.error || 'Verification failed');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed');
    } finally {
      setOtpSending(false);
    }
  };

  // Place Order from Table
  const handlePlaceTableOrder = async () => {
    if (cart.length === 0) return;

    if (!customer) {
      // Must onboard or enter basic phone/name
      setIsLoyaltyModalOpen(true);
      return;
    }

    if (!table) return;

    setIsSubmitting(true);
    try {
      const payload = {
        tableId: table.id,
        qrToken: table.qr_token,
        customerPhone: customer.phone,
        customerName: customer.name,
        notes: orderNotes,
        appliedDiscountPercent: appliedDiscount,
        appliedVoucher: appliedVoucher,
        items: cart.map((it) => ({
          menuItemId: it.menuItemId,
          variantId: it.variantId,
          variantName: it.variantName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          notes: it.notes,
        })),
      };

      const res = await fetch('/api/public/table-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setPlacedOrder({
          ...json.data,
          items: cart,
          grandTotal,
          tableNumber: table.table_number,
          section: table.section,
        });
        setCart([]);
        setIsCartOpen(false);

        // Update local customer loyalty stats
        const updatedCustomer = {
          ...customer,
          totalOrders: customer.totalOrders + 1,
          currentStreak: customer.currentStreak + 1,
          cravingPoints: customer.cravingPoints + (json.data.earnedPoints || 15),
        };
        setCustomer(updatedCustomer);
        localStorage.setItem(
          'rollify_customer_loyalty',
          JSON.stringify({ customer: updatedCustomer, perks })
        );
      } else {
        alert(json.error || 'Failed to place order');
      }
    } catch (err: any) {
      alert('Network error while placing order: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReferralCode = () => {
    if (!customer?.referralCode) return;
    navigator.clipboard.writeText(customer.referralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  const filteredItems = menuItems.filter((item) => {
    if (selectedCat !== 'ALL' && item.category_id !== selectedCat) return false;
    if (vegOnly && !item.is_veg) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#C8102E] text-white flex items-center justify-center animate-pulse mb-3 shadow-md">
          <UtensilsCrossed className="w-6 h-6 text-[#F59E0B]" />
        </div>
        <p className="text-sm font-bold text-stone-900">Loading Table Menu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-stone-900 pb-28 select-none">
      {/* 1. TOP CAFE & TABLE HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C8102E] text-white flex items-center justify-center font-black text-xs shadow-xs tracking-tight">
              POS
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight text-stone-900">POS</h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-100 text-[#C8102E]">
                  Table {table?.table_number || 'T-01'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">
                {table?.section || 'Main Dining'} · Dine-In Digital Menu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Call Waiter Service Button */}
            <button
              type="button"
              onClick={() => setIsCallWaiterOpen(true)}
              className={clsx(
                "px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs border",
                waiterCallCooldown > 0
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
              )}
              title="Call waiter or request table assistance"
            >
              <Bell className={clsx("w-3.5 h-3.5", waiterCallCooldown > 0 ? "text-emerald-600" : "text-amber-600 animate-bounce")} />
              <span className="hidden sm:inline">
                {waiterCallCooldown > 0 ? `Staff Alerted (${waiterCallCooldown}s)` : 'Call Waiter'}
              </span>
              <span className="sm:hidden">
                {waiterCallCooldown > 0 ? `${waiterCallCooldown}s` : 'Waiter'}
              </span>
            </button>

            {/* Loyalty Pill Button */}
            {customer ? (
              <button
                onClick={() => setIsLoyaltyExpanded(!isLoyaltyExpanded)}
                className="px-3 py-1.5 rounded-2xl bg-gradient-to-r from-[#C8102E] to-[#A80D26] text-white text-xs font-bold flex items-center gap-2 shadow-xs hover:opacity-95 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="truncate max-w-[110px]">{customer.name.split(' ')[0]}</span>
                <span className="bg-[#F59E0B] text-stone-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {customer.cravingPoints} pts
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setOtpStep('PHONE');
                  setIsLoyaltyModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-2xl bg-[#C8102E] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#A80D26] transition cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5 text-[#F59E0B]" />
                Join Craving Club
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Waiter Call Toast / Status Banner */}
      {waiterCallSuccessMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 mx-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{waiterCallSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setWaiterCallSuccessMessage('')}
            className="text-white/80 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. CUSTOMER DIGITAL LOYALTY CARD BANNER */}
      {customer && isLoyaltyExpanded && (
        <section className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-gradient-to-br from-[#C8102E] via-[#A80D26] to-[#670817] text-white rounded-3xl p-5 shadow-xl border border-red-900/40 relative overflow-hidden">
            {/* Background Texture */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between relative z-10 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-200 bg-black/20 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                  Craving Club Member Card
                </span>
                <h3 className="text-xl font-black mt-1 text-white">{customer.name}</h3>
                <p className="text-xs text-stone-200 font-mono">+91 {customer.phone}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-amber-200 uppercase tracking-wider">Craving Points</span>
                <p className="text-2xl font-black font-mono text-[#F59E0B]">{customer.cravingPoints}</p>
              </div>
            </div>

            {/* Loyalty Pillars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 relative z-10">
              {/* 01. Earn on Every Craving */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                  <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                  01. Earn on Craving
                </div>
                {/* 5-Stamp Tracker */}
                <div className="flex items-center gap-1.5 my-2">
                  {[1, 2, 3, 4, 5].map((idx) => {
                    const filled = (customer.currentStreak % 5 || 5) >= idx && customer.currentStreak > 0;
                    return (
                      <div
                        key={idx}
                        className={clsx(
                          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all',
                          filled
                            ? 'bg-[#F59E0B] text-stone-900 border-[#F59E0B] shadow-xs'
                            : 'bg-white/10 text-stone-400 border-white/20'
                        )}
                      >
                        {filled ? '✓' : idx}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-stone-300 leading-tight">
                  {perks?.freeDishUnlocked
                    ? '🎉 Free Dish Unlocked for this order!'
                    : `${perks?.nextFreeDishIn || 5} orders until your next Complimentary Dish!`}
                </p>
                {perks?.isStreakDiscountActive && (
                  <span className="inline-block mt-2 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                    🔥 10% Streak Discount Active
                  </span>
                )}
              </div>

              {/* 02. Birthday Surprises */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-pink-300 mb-1">
                  <Cake className="w-3.5 h-3.5 text-pink-400" />
                  02. Birthday Treat
                </div>
                <p className="text-[11px] text-stone-300 mt-1 leading-snug">
                  A treat waiting in your birth month, because cake is a food group.
                </p>
                {perks?.isBirthdayMonth ? (
                  <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-pink-300 bg-pink-500/20 px-2 py-1 rounded-xl border border-pink-400/30">
                    🎂 Birthday Month Active! Free Dessert.
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-400 mt-2 font-mono">
                    {customer.dob ? `Birth Date: ${customer.dob}` : 'Enter DOB in profile for cake treat'}
                  </p>
                )}
              </div>

              {/* 03. Refer Your Community */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  03. Community Code
                </div>
                <p className="text-[11px] text-stone-300 mt-1 leading-snug">
                  Share code — bonuses land when friends complete first order.
                </p>
                <div className="mt-2 flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5">
                  <span className="text-xs font-mono font-bold text-amber-200">{customer.referralCode}</span>
                  <button
                    onClick={copyReferralCode}
                    className="text-[11px] font-bold text-[#F59E0B] hover:text-white transition flex items-center gap-1 cursor-pointer"
                  >
                    {codeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {codeCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Collapse toggle */}
            <div className="text-center mt-3 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsLoyaltyExpanded(false)}
                className="text-[11px] text-stone-300 hover:text-white font-medium cursor-pointer"
              >
                Hide Loyalty Card ▲
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. SEARCH & CATEGORY SELECTOR */}
      <section className="max-w-4xl mx-auto px-4 pt-4">
        {/* Search Bar & Veg Filter */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search coffee, tea, burgers, rolls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] shadow-2xs"
            />
          </div>

          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={clsx(
              'px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs',
              vegOnly
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            Pure Veg
          </button>
        </div>

        {/* Categories Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={clsx(
              'px-4 py-2 rounded-2xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 shadow-2xs',
              selectedCat === 'ALL'
                ? 'bg-[#C8102E] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/80'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
            All ({menuItems.length})
          </button>

          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={clsx(
                'px-4 py-2 rounded-2xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 shadow-2xs',
                selectedCat === c.id
                  ? 'bg-[#C8102E] text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/80'
              )}
            >
              {c.name.includes('Coffee') && <Coffee className="w-3.5 h-3.5 text-[#C8102E]" />}
              {c.name.includes('Tea') && <CupSoda className="w-3.5 h-3.5 text-[#C8102E]" />}
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* 4. MENU ITEMS GRID */}
      <main className="max-w-4xl mx-auto px-4 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => {
            const hasVariants = item.variants && item.variants.length > 1;
            const displayPrice = hasVariants ? `${item.variants![0].price}+` : item.price;
            const imgSrc = item.image_url || getProductImage(item.category_id, item.name);

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="bg-white rounded-3xl border border-stone-200/90 hover:border-[#C8102E] hover:shadow-md transition cursor-pointer flex flex-col justify-between overflow-hidden shadow-2xs select-none group min-h-[230px]"
              >
                {/* Photo Canvas */}
                <div className="relative w-full h-36 bg-stone-100 overflow-hidden shrink-0">
                  <img
                    src={imgSrc}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      const fallback = getProductImage(item.category_id, item.name);
                      if ((e.currentTarget as HTMLImageElement).src !== fallback) {
                        (e.currentTarget as HTMLImageElement).src = fallback;
                      }
                    }}
                  />

                  {/* Veg Tag */}
                  <div className="absolute top-2.5 left-2.5 z-10">
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

                  {/* Special Badges */}
                  <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end z-10">
                    {item.is_chef_special && (
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#C8102E] text-white shadow-xs">
                        ★ Chef Special
                      </span>
                    )}
                    {item.is_spicy && (
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs">
                        🌶 Spicy
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between min-h-[90px]">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 group-hover:text-[#C8102E] transition-colors leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                      {item.description || 'Artisanal cafe special'}
                    </p>
                  </div>

                  <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-sm font-mono font-black text-stone-900">
                      ₹{displayPrice}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(item);
                      }}
                      className="px-3 py-1 rounded-xl bg-[#FDF2F3] text-[#C8102E] group-hover:bg-[#C8102E] group-hover:text-white transition-all text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 5. ITEM CUSTOMIZATION MODAL */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-stone-100">
              <div>
                <span className="text-[10px] font-black uppercase text-[#C8102E]">Customize Item</span>
                <h3 className="text-base font-bold text-stone-900">{customizingItem.name}</h3>
                <p className="text-xs text-stone-500">{customizingItem.description}</p>
              </div>
              <button
                onClick={() => setCustomizingItem(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-stone-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Size Variants if any */}
            {customizingItem.variants && customizingItem.variants.length > 1 && (
              <div className="mt-4">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-2">
                  Select Size / Portion
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingItem.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={clsx(
                        'p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-between transition cursor-pointer',
                        selectedVariant?.id === v.id
                          ? 'border-[#C8102E] bg-[#FDF2F3] text-stone-900 shadow-xs'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      )}
                    >
                      <span>{v.variant_name}</span>
                      <span className="font-mono text-[#C8102E]">₹{v.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Special Instructions Presets */}
            <div className="mt-4">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-2">
                Special Kitchen Instructions
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {SPECIAL_INSTRUCTION_PRESETS.map((preset) => {
                  const active = customInstructions.includes(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const existing = customInstructions.split(',').map((s) => s.trim()).filter(Boolean);
                        if (existing.includes(preset)) {
                          setCustomInstructions(existing.filter((s) => s !== preset).join(', '));
                        } else {
                          setCustomInstructions([...existing, preset].join(', '));
                        }
                      }}
                      className={clsx(
                        'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer',
                        active
                          ? 'bg-[#C8102E] text-white border-[#C8102E]'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      )}
                    >
                      {active ? '✓ ' : '+ '}{preset}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Other custom preferences (e.g., less spicy)..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              />
            </div>

            {/* Confirm Add */}
            <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-400 uppercase">Item Total</span>
                <p className="text-base font-black font-mono text-stone-900">
                  ₹{selectedVariant ? selectedVariant.price : customizingItem.price}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  addToCart(
                    customizingItem,
                    selectedVariant?.id,
                    selectedVariant?.variant_name,
                    selectedVariant ? Number(selectedVariant.price) : Number(customizingItem.price),
                    customInstructions.trim()
                  );
                }}
                className="px-6 py-2.5 rounded-2xl bg-[#C8102E] text-white text-xs font-bold hover:bg-[#A80D26] transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-[#F59E0B]" />
                Add to Table Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FLOATING TABLE CART BAR */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto">
          <div className="bg-[#C8102E] text-white p-3.5 rounded-3xl shadow-2xl flex items-center justify-between border border-red-900/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F59E0B] text-stone-900 flex items-center justify-center font-bold text-sm shadow-md">
                {cart.reduce((s, it) => s + it.quantity, 0)}
              </div>
              <div>
                <p className="text-xs font-bold">Table {table?.table_number} Cart</p>
                <p className="text-[11px] text-stone-200 font-mono">
                  Total: ₹{grandTotal.toFixed(2)} (incl. GST)
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-5 py-2.5 bg-white text-[#C8102E] text-xs font-bold rounded-2xl hover:bg-stone-100 transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#C8102E]" />
              View Cart & Order
            </button>
          </div>
        </div>
      )}

      {/* 7. FULL TABLE CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 max-h-[92vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-stone-100">
              <div>
                <span className="text-[10px] font-black uppercase text-[#C8102E]">Review Table Order</span>
                <h3 className="text-base font-bold text-stone-900">
                  Table {table?.table_number} · {table?.section}
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-stone-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 divide-y divide-stone-100">
              {cart.map((it) => (
                <div key={it.cartId} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-stone-900 truncate">
                      {it.name} {it.variantName && it.variantName !== 'Single' && `(${it.variantName})`}
                    </h4>
                    {it.notes && (
                      <p className="text-[10px] text-amber-700 italic truncate mt-0.5">
                        Note: {it.notes}
                      </p>
                    )}
                    <span className="text-xs font-mono font-bold text-stone-600">
                      ₹{it.unitPrice} × {it.quantity} = ₹{(it.unitPrice * it.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 bg-stone-100 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => updateQuantity(it.cartId, -1)}
                      className="w-6 h-6 rounded-lg bg-white text-stone-700 flex items-center justify-center hover:bg-stone-200 shadow-2xs cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono font-bold px-1.5">{it.quantity}</span>
                    <button
                      onClick={() => updateQuantity(it.cartId, 1)}
                      className="w-6 h-6 rounded-lg bg-[#C8102E] text-white flex items-center justify-center hover:bg-[#A80D26] shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Loyalty Perks & Vouchers Applicator */}
            {customer && perks && (
              <div className="py-2.5 border-y border-stone-100 bg-[#FFFDF9] -mx-5 px-5 my-2">
                <span className="text-[10px] font-bold text-[#C8102E] uppercase tracking-wider block mb-1">
                  Craving Club Perks Available
                </span>

                <div className="space-y-1.5">
                  {perks.isStreakDiscountActive && (
                    <button
                      type="button"
                      onClick={() => {
                        if (appliedDiscount === 10) {
                          setAppliedDiscount(0);
                          setAppliedVoucher('');
                        } else {
                          setAppliedDiscount(10);
                          setAppliedVoucher('CRAVING_STREAK_10%');
                        }
                      }}
                      className={clsx(
                        'w-full p-2 rounded-xl text-xs font-bold border flex items-center justify-between transition cursor-pointer',
                        appliedDiscount === 10
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-white border-stone-200 text-stone-700'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-[#C8102E]" />
                        10% Streak Discount (Orders &gt; ₹300)
                      </span>
                      <span>{appliedDiscount === 10 ? 'Applied ✓' : 'Apply'}</span>
                    </button>
                  )}

                  {perks.isBirthdayMonth && (
                    <div className="p-2 rounded-xl bg-pink-50 border border-pink-200 text-pink-900 text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Cake className="w-3.5 h-3.5 text-pink-600" />
                        Complimentary Birthday Month Treat included!
                      </span>
                      <span className="text-[10px] bg-pink-200 px-2 py-0.5 rounded-full">FREE</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bill Summary */}
            <div className="space-y-1 pt-2 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Craving Streak Discount (10%)</span>
                  <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-500">
                <span>GST (5.0%)</span>
                <span className="font-mono">₹{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-stone-900 pt-2 border-t border-stone-200">
                <span>Total Amount Payable</span>
                <span className="font-mono text-[#C8102E]">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* General Kitchen Notes */}
            <div className="mt-3">
              <input
                type="text"
                placeholder="Special table notes (e.g., serve drinks first)..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              />
            </div>

            {/* Submit to Kitchen */}
            <div className="mt-4 pt-3 border-t border-stone-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handlePlaceTableOrder}
                className="w-full py-3 rounded-2xl bg-[#C8102E] text-white text-sm font-bold hover:bg-[#A80D26] transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ChefHat className="w-4 h-4 text-[#F59E0B]" />
                {isSubmitting ? 'Sending to Kitchen...' : `Confirm & Send to Kitchen (₹${grandTotal.toFixed(2)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. CUSTOMER ONBOARDING / OTP LOGIN MODAL */}
      {isLoyaltyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsLoyaltyModalOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-stone-200 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#C8102E] text-white flex items-center justify-center mx-auto mb-2 font-black text-xl shadow-md">
                R
              </div>
              <h3 className="text-lg font-black text-stone-900">Join Craving Club</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Earn rewards on every craving, birthday surprises & friend referral treats!
              </p>
            </div>

            {/* Step 1: Phone */}
            {otpStep === 'PHONE' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-stone-400">
                      +91
                    </span>
                    <input
                      type="tel"
                      placeholder="98765 43210"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      autoFocus
                    />
                  </div>
                  {otpError && <p className="text-[11px] text-red-600 mt-1 font-bold">{otpError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={otpSending}
                  className="w-full py-2.5 bg-[#C8102E] text-white text-xs font-bold rounded-2xl hover:bg-[#A80D26] transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {otpSending ? 'Sending OTP...' : 'Send OTP Code →'}
                </button>
              </form>
            )}

            {/* Step 2: OTP Entry & Basic Details */}
            {otpStep === 'OTP' && (
              <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">Enter OTP Code</label>
                    <span className="text-[10px] text-stone-400 font-mono">+91 {phoneInput.slice(-10)}</span>
                  </div>
                  <input
                    type="text"
                    placeholder="1234"
                    maxLength={4}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="w-full text-center tracking-widest text-lg font-mono font-black py-2 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-[10px] text-stone-400">Demo Code: 1234</p>
                    <button
                      type="button"
                      onClick={() => setOtpInput('1234')}
                      className="text-[10px] text-[#C8102E] font-bold underline cursor-pointer"
                    >
                      Autofill 1234
                    </button>
                  </div>
                </div>

                {/* Profile Fields on First Scan */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Your Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">Date of Birth</label>
                    <span className="text-[10px] text-pink-600 font-bold">🎂 Birthday Month Treat</span>
                  </div>
                  <input
                    type="date"
                    value={dobInput}
                    onChange={(e) => setDobInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Friend's Referral Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ROLL-PRIYA-04"
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                {otpError && <p className="text-[11px] text-red-600 font-bold">{otpError}</p>}

                <button
                  type="submit"
                  disabled={otpSending}
                  className="w-full py-2.5 bg-[#C8102E] text-white text-xs font-bold rounded-2xl hover:bg-[#A80D26] transition shadow-md cursor-pointer disabled:opacity-50 mt-2"
                >
                  {otpSending ? 'Activating Perks...' : 'Verify & Enter Craving Club 🎉'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 9. LIVE ORDER TRACKING SCREEN */}
      {placedOrder && (
        <div className="fixed inset-0 z-50 bg-[#FFFDF9] flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              Order Dispatched to Kitchen
            </span>

            <h2 className="text-xl font-black text-stone-900 mt-2">
              Order #{placedOrder.orderNumber}
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Serving at Table <span className="font-bold text-[#C8102E]">{placedOrder.tableNumber}</span> · {placedOrder.section}
            </p>

            {/* Live Progress Tracker */}
            <div className="my-6 p-4 bg-stone-50 rounded-2xl border border-stone-100 text-left">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs font-bold text-emerald-700">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <span>Order Confirmed & Sent to Kitchen Display</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-amber-700">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] animate-pulse">
                    🍳
                  </span>
                  <span>Chef is Handcrafting Your Order</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-stone-400">
                  <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>Ready to Serve at Table {placedOrder.tableNumber}</span>
                </div>
              </div>
            </div>

            {/* Points Earned Banner */}
            <div className="p-3 bg-gradient-to-r from-[#C8102E] to-[#870A1E] text-white rounded-2xl mb-4 flex items-center justify-between text-left">
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-300">Craving Points Earned</p>
                <p className="text-xs font-bold">+{placedOrder.earnedPoints || 15} Points Credited!</p>
              </div>
              <Sparkles className="w-5 h-5 text-[#F59E0B]" />
            </div>

            <button
              onClick={() => setPlacedOrder(null)}
              className="w-full py-2.5 rounded-2xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition cursor-pointer"
            >
              Order More Items for Table
            </button>
          </div>
        </div>
      )}

      {/* 10. CALL WAITER / SERVICE ASSISTANCE MODAL */}
      {isCallWaiterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">Call Waiter</h3>
                  <p className="text-[10px] text-stone-500 font-medium">
                    Table <span className="font-bold text-[#C8102E]">{table?.table_number || 'T-01'}</span> · Quick Assistance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCallWaiterOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {waiterCallCooldown > 0 ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">Staff Already Alerted!</h4>
                  <p className="text-xs text-stone-500 mt-1">
                    A team member is on their way to Table {table?.table_number || 'T-01'}.
                  </p>
                  <p className="text-[11px] font-mono text-emerald-600 font-bold mt-2">
                    Next call available in {waiterCallCooldown}s
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCallWaiterOpen(false)}
                  className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-2xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleCallWaiter} className="pt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-2">
                    How can we assist you?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '🙋 Assistance', val: 'General Assistance' },
                      { label: '💧 Water Refill', val: 'Water Bottle / Refill' },
                      { label: '🍴 Cutlery / Napkins', val: 'Cutlery & Napkins' },
                      { label: '🧾 Bill / Settle', val: 'Request Bill / Settle' },
                      { label: '🧹 Clean Table', val: 'Table Cleanup' },
                      { label: '🌶️ Extra Sauce', val: 'Sauces / Condiments' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setWaiterReason(opt.val)}
                        className={clsx(
                          "px-3 py-2 rounded-xl text-[11px] font-bold text-left border transition cursor-pointer",
                          waiterReason === opt.val
                            ? "bg-amber-500 text-stone-900 border-amber-600 shadow-xs"
                            : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">
                    Special notes for staff (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Warm water, extra tissues, high chair..."
                    value={waiterNotes}
                    onChange={(e) => setWaiterNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    maxLength={100}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCallWaiterOpen(false)}
                    className="flex-1 py-2.5 rounded-2xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCallingWaiter}
                    className="flex-1 py-2.5 rounded-2xl bg-[#C8102E] hover:bg-[#A80D26] text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>{isCallingWaiter ? 'Alerting...' : 'Ring Bell 🔔'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

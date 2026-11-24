import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { 
  Wifi, 
  WifiOff, 
  LogOut, 
  KeyRound, 
  Shield, 
  Clock, 
  Menu, 
  X,
  LayoutDashboard, 
  ShoppingCart, 
  ChefHat, 
  Receipt, 
  ListOrdered, 
  UtensilsCrossed, 
  BookOpen, 
  Users, 
  BarChart3 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useSocket } from '../../context/SocketContext.js';
import { RollifyLogo } from '../common/RollifyLogo.js';
import { Button } from '../ui/Button.js';
import { Modal } from '../ui/Modal.js';
import { Badge } from '../ui/Badge.js';
import { clsx } from 'clsx';

export const Navbar: React.FC = () => {
  const { user, logout, pinLogin } = useAuth();
  const { status, latency, reconnect } = useSocket();
  const navigate = useNavigate();
  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navItems = [
    { to: '/dashboard', label: 'Operations Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'] },
    { to: '/pos', label: 'Order Entry (POS)', icon: <ShoppingCart className="w-4 h-4" />, roles: ['ADMIN', 'CASHIER', 'WAITER'] },
    { to: '/kitchen', label: 'Kitchen Display (KDS)', icon: <ChefHat className="w-4 h-4" />, roles: ['ADMIN', 'KITCHEN'] },
    { to: '/billing', label: 'Cashier Dashboard', icon: <Receipt className="w-4 h-4" />, roles: ['ADMIN', 'CASHIER'] },
    { to: '/orders', label: 'Order Management', icon: <ListOrdered className="w-4 h-4" />, roles: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'] },
    { to: '/tables', label: 'Table Management', icon: <UtensilsCrossed className="w-4 h-4" />, roles: ['ADMIN', 'CASHIER', 'WAITER'] },
    { to: '/menu', label: 'Menu Management', icon: <BookOpen className="w-4 h-4" />, roles: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'] },
    { to: '/users', label: 'Staff Management', icon: <Users className="w-4 h-4" />, roles: ['ADMIN'] },
    { to: '/analytics', label: 'Revenue & Reports', icon: <BarChart3 className="w-4 h-4" />, roles: ['ADMIN'] },
  ];

  const userRole = (user?.role as any) || 'ADMIN';
  const visibleNavItems = navItems.filter((i) => i.roles.includes(userRole));
  const mobileNavToRender = visibleNavItems.length > 0 ? visibleNavItems : navItems;

  const handleQuickSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    setIsSubmitting(true);
    setSwitchError('');
    const res = await pinLogin(pin);
    setIsSubmitting(false);
    if (res.success) {
      setIsSwitchOpen(false);
      setPin('');
      switch (res.role) {
        case 'KITCHEN':
          navigate('/kitchen');
          break;
        case 'WAITER':
          navigate('/pos');
          break;
        case 'CASHIER':
          navigate('/billing');
          break;
        case 'MANAGER':
        case 'ADMIN':
        default:
          navigate('/dashboard');
          break;
      }
    } else {
      setSwitchError(res.error || 'Invalid PIN');
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
    CASHIER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    WAITER: 'bg-amber-100 text-amber-800 border-amber-200',
    KITCHEN: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 py-2.5">
      <div className="flex items-center justify-between">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition border border-stone-200"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-stone-800" /> : <Menu className="w-5 h-5 text-stone-800" />}
          </button>
          
          <RollifyLogo size="sm" showTagline={false} />
          
          <div className="hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Cloud POS Terminal
            </span>
          </div>
        </div>

        {/* Status Indicators & User Badge */}
        <div className="flex items-center gap-3">
          {/* Real-time Connection Status */}
          <button
            type="button"
            onClick={() => reconnect()}
            title={status === 'connected' ? `Live real-time stream active (${latency || 0}ms)` : 'Click to reconnect live real-time sync'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-[11px] font-medium text-stone-600 border border-stone-200/60 hover:bg-stone-200/70 transition-all cursor-pointer"
          >
            {status === 'connected' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-emerald-700">Live Synced</span>
              </>
            ) : status === 'connecting' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-amber-700 font-semibold">Connecting...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-stone-700 font-semibold">Connecting to Cloud</span>
              </>
            )}
          </button>

          {/* User profile & quick switch */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-stone-900 leading-tight">
                  {user.fullName}
                </span>
                <span className="text-[10px] font-semibold text-stone-500">
                  @{user.username}
                </span>
              </div>

              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border tracking-wider ${
                  roleColors[user.role] || 'bg-stone-100 text-stone-700'
                }`}
              >
                {user.role}
              </span>

              {/* Fast PIN Switcher Button for busy terminals */}
              <button
                onClick={() => setIsSwitchOpen(true)}
                title="Quick Switch User via PIN"
                className="p-2 text-stone-600 hover:text-rollify-charcoal hover:bg-stone-100 rounded-xl transition border border-stone-200"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              <button
                onClick={logout}
                title="Logout"
                className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 pt-2 border-t border-stone-200 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-3 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Switch Panel / Navigation
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {mobileNavToRender.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition',
                    isActive
                      ? 'bg-[#C8102E] text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-100'
                  )
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Quick Switch PIN Modal */}
      <Modal isOpen={isSwitchOpen} onClose={() => setIsSwitchOpen(false)} maxWidth="sm" title="Quick Switch Terminal User">
        <form onSubmit={handleQuickSwitch} className="space-y-4">
          <p className="text-xs text-stone-600">
            Enter your 4-digit staff PIN to instantly switch terminal session without logging out.
          </p>

          <div className="space-y-1">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 border-2 border-stone-300 rounded-2xl focus:border-rollify-red focus:outline-none"
            />
            {switchError && <p className="text-xs text-red-600 font-semibold text-center">{switchError}</p>}
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2 text-center text-[10px] text-stone-500 font-mono">
            <span className="p-1 bg-stone-100 rounded">Admin: 1111</span>
            <span className="p-1 bg-stone-100 rounded">Cashier: 3333</span>
            <span className="p-1 bg-stone-100 rounded">Waiter: 4444</span>
            <span className="p-1 bg-stone-100 rounded">Kitchen: 5555</span>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSwitchOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} disabled={pin.length !== 4}>
              Switch User
            </Button>
          </div>
        </form>
      </Modal>
    </header>
  );
};

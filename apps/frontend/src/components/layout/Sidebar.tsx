import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  BookOpen, 
  Palette, 
  Users, 
  ChefHat, 
  Receipt, 
  PackageSearch,
  ShoppingCart,
  ListOrdered,
  Clock,
  BarChart3,
  CreditCard,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const { user, hasRole } = useAuth();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Operations Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'],
    },
    {
      to: '/pos',
      label: 'Fast POS Terminal',
      icon: <ShoppingCart className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'],
    },
    {
      to: '/orders',
      label: 'Live Orders Stream',
      icon: <ListOrdered className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'],
    },
    {
      to: '/kitchen',
      label: 'Kitchen Display (KDS)',
      icon: <ChefHat className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'KITCHEN'],
    },
    {
      to: '/billing',
      label: 'Billing & Cashier',
      icon: <Receipt className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER'],
    },
    {
      to: '/day-closing',
      label: 'Shift Day Closing',
      icon: <Lock className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER'],
    },
    {
      to: '/inventory',
      label: 'Inventory & Stock',
      icon: <PackageSearch className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'KITCHEN'],
    },
    {
      to: '/expenses',
      label: 'Expenses & Payables',
      icon: <CreditCard className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER'],
    },
    {
      to: '/shifts',
      label: 'Staff Shifts & Hours',
      icon: <Clock className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'],
    },
    {
      to: '/analytics',
      label: 'P&L & Analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER'],
    },
    {
      to: '/tables',
      label: 'Table Floor Plan',
      icon: <UtensilsCrossed className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'],
    },
    {
      to: '/menu',
      label: 'Menu & Recipes',
      icon: <BookOpen className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'],
    },
    {
      to: '/users',
      label: 'Staff Management',
      icon: <Users className="w-5 h-5" />,
      roles: ['ADMIN', 'MANAGER'],
    },
  ];

  const userRole = (user?.role as any) || 'ADMIN';
  const visibleItems = navItems.filter((item) => {
    return item.roles.includes(userRole);
  });

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-stone-200/80 flex flex-col justify-between hidden md:flex h-[calc(100vh-57px)]">
      <div className="p-4 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Core Operations
        </p>

        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all',
                isActive
                  ? 'bg-rollify-red-50 text-rollify-red font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Footer Branding Info */}
      <div className="p-4 border-t border-stone-100 bg-stone-50/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rollify-gold" />
          <span className="text-xs font-semibold text-stone-700">Rollify POS</span>
        </div>
        <p className="text-[10px] text-stone-400 mt-0.5">A community of flavours</p>
      </div>
    </aside>
  );
};

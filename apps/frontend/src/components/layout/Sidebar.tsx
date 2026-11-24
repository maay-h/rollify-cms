import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  BookOpen, 
  Users, 
  ChefHat, 
  Receipt, 
  ShoppingCart,
  ListOrdered,
  BarChart3
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
      roles: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'],
    },
    {
      to: '/pos',
      label: 'Order Entry (POS)',
      icon: <ShoppingCart className="w-5 h-5" />,
      roles: ['ADMIN', 'CASHIER', 'WAITER'],
    },
    {
      to: '/kitchen',
      label: 'Kitchen Display (KDS)',
      icon: <ChefHat className="w-5 h-5" />,
      roles: ['ADMIN', 'KITCHEN'],
    },
    {
      to: '/billing',
      label: 'Cashier Dashboard',
      icon: <Receipt className="w-5 h-5" />,
      roles: ['ADMIN', 'CASHIER'],
    },
    {
      to: '/orders',
      label: 'Order Management',
      icon: <ListOrdered className="w-5 h-5" />,
      roles: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'],
    },
    {
      to: '/tables',
      label: 'Table Management',
      icon: <UtensilsCrossed className="w-5 h-5" />,
      roles: ['ADMIN', 'CASHIER', 'WAITER'],
    },
    {
      to: '/menu',
      label: 'Menu Management',
      icon: <BookOpen className="w-5 h-5" />,
      roles: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'],
    },
    {
      to: '/users',
      label: 'Staff Management',
      icon: <Users className="w-5 h-5" />,
      roles: ['ADMIN'],
    },
    {
      to: '/analytics',
      label: 'Revenue & Reports',
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ['ADMIN'],
    },
  ];

  const userRole = (user?.role as any) || 'ADMIN';
  const visibleItems = navItems.filter((item) => {
    return item.roles.includes(userRole);
  });
  const itemsToRender = visibleItems.length > 0 ? visibleItems : navItems;

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-stone-200/80 flex flex-col justify-between hidden md:flex h-[calc(100vh-57px)]">
      <div className="p-4 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Core Operations
        </p>

        {itemsToRender.map((item) => (
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

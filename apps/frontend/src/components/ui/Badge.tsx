import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'default'
  | 'created'
  | 'kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'paid'
  | 'cancelled'
  | 'success'
  | 'warning'
  | 'danger';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full tracking-wide select-none';

  const variants: Record<BadgeVariant, { bg: string; text: string; dotColor: string }> = {
    default: { bg: 'bg-stone-100', text: 'text-stone-700', dotColor: 'bg-stone-500' },
    created: { bg: 'bg-blue-50', text: 'text-blue-700 border border-blue-200', dotColor: 'bg-blue-500' },
    kitchen: { bg: 'bg-amber-50', text: 'text-amber-700 border border-amber-200', dotColor: 'bg-amber-500' },
    preparing: { bg: 'bg-orange-50', text: 'text-orange-700 border border-orange-200', dotColor: 'bg-orange-500' },
    ready: { bg: 'bg-emerald-50', text: 'text-emerald-700 border border-emerald-300 font-bold', dotColor: 'bg-emerald-500 animate-ping' },
    served: { bg: 'bg-teal-50', text: 'text-teal-700 border border-teal-200', dotColor: 'bg-teal-500' },
    completed: { bg: 'bg-green-50', text: 'text-green-800 border border-green-200', dotColor: 'bg-green-600' },
    paid: { bg: 'bg-emerald-100', text: 'text-emerald-900 border border-emerald-300', dotColor: 'bg-emerald-700' },
    cancelled: { bg: 'bg-rose-50', text: 'text-rose-700 border border-rose-200', dotColor: 'bg-rose-500' },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-700 border border-emerald-200', dotColor: 'bg-emerald-500' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-800 border border-amber-200', dotColor: 'bg-amber-500' },
    danger: { bg: 'bg-red-50', text: 'text-red-700 border border-red-200', dotColor: 'bg-red-500' },
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const v = variants[variant] || variants.default;

  return (
    <span className={twMerge(clsx(baseStyles, v.bg, v.text, sizes[size], className))}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full inline-block shrink-0', v.dotColor)} />}
      {children}
    </span>
  );
};

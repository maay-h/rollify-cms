import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'interactive' | 'accent';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  hoverEffect = false,
  ...props
}) => {
  const baseStyles = 'bg-white rounded-2xl border transition-all duration-200 overflow-hidden';

  const variants = {
    default: 'border-stone-200/80 shadow-sm shadow-stone-200/40',
    flat: 'border-stone-200/60 shadow-none',
    interactive: 'border-stone-200/80 hover:border-rollify-gold hover:shadow-md cursor-pointer active:scale-[0.99]',
    accent: 'border-rollify-red/20 bg-rollify-red-50/20 shadow-sm',
  };

  return (
    <div
      className={twMerge(
        clsx(baseStyles, variants[variant], hoverEffect && 'hover:shadow-md hover:border-stone-300', className)
      )}
      {...props}
    >
      {children}
    </div>
  );
};

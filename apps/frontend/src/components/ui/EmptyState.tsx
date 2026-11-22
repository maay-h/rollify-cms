import React from 'react';
import { PackageOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './Button.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'flex flex-col items-center justify-center text-center p-8 sm:p-12 border-2 border-dashed border-stone-200 rounded-3xl bg-white/50',
          className
        )
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-rollify-gold-600 mb-4 shadow-sm">
        {icon || <PackageOpen className="w-8 h-8 text-rollify-gold" />}
      </div>
      <h3 className="text-base font-bold text-stone-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-stone-500 max-w-sm mb-6">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="gold" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

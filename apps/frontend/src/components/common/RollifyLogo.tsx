import React from 'react';
import { clsx } from 'clsx';

export interface RollifyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const RollifyLogo: React.FC<RollifyLogoProps> = ({
  size = 'md',
  showTagline = true,
  className,
}) => {
  const sizes = {
    sm: { container: 'h-8', text: 'text-xl', badge: 'w-7 h-7 text-xs rounded-lg' },
    md: { container: 'h-10', text: 'text-2xl', badge: 'w-9 h-9 text-sm rounded-xl' },
    lg: { container: 'h-14', text: 'text-4xl', badge: 'w-12 h-12 text-lg rounded-2xl' },
  };

  const s = sizes[size];

  return (
    <div className={clsx('flex items-center gap-2 select-none inline-flex', className)}>
      {/* Sleek POS brand mark */}
      <div className={clsx('bg-[#C8102E] text-white flex items-center justify-center font-black shadow-xs shrink-0 tracking-tight', s.badge)}>
        POS
      </div>
      <div className="flex flex-col">
        <span className={clsx('font-black tracking-tight text-stone-900 leading-none', s.text)}>
          POS
        </span>
        {showTagline && (
          <span className="text-[9px] font-bold tracking-widest text-stone-400 uppercase leading-none mt-1">
            Cloud Terminal
          </span>
        )}
      </div>
    </div>
  );
};

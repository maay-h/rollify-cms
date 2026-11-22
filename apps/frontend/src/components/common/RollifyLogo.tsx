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
    sm: { container: 'h-8', text: 'text-xl', hat: 'w-4 h-4 -top-2 left-0.5' },
    md: { container: 'h-10', text: 'text-2xl', hat: 'w-5 h-5 -top-2.5 left-1' },
    lg: { container: 'h-16', text: 'text-4xl', hat: 'w-8 h-8 -top-4 left-1.5' },
  };

  const s = sizes[size];

  return (
    <div className={clsx('flex flex-col select-none inline-flex items-start', className)}>
      <div className={clsx('relative flex items-center font-black tracking-tight leading-none', s.container)}>
        {/* Chef Hat atop the R */}
        <div className={clsx('absolute pointer-events-none text-rollify-charcoal', s.hat)}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-sm">
            <path d="M18.06 13c-.04-.33-.06-.66-.06-1 0-2.6-1.9-4.73-4.38-4.98C13.2 4.7 11.27 3 9 3 6.24 3 4 5.24 4 8c0 .35.04.69.11 1.02C2.86 9.87 2 11.33 2 13c0 2.21 1.79 4 4 4h12c2.21 0 4-1.79 4-4 0-1.87-1.28-3.44-3.02-3.88l-.92-.12z" />
            <rect x="4" y="18" width="16" height="2" rx="1" fill="#C8102E" />
          </svg>
        </div>

        {/* Wordmark */}
        <span className={clsx('font-black text-rollify-gold drop-shadow-sm flex items-center', s.text)}>
          <span className="text-rollify-gold pr-0.5">R</span>
          {/* Swirl 'o' */}
          <span className="inline-flex items-center justify-center relative mx-0.5">
            <span className="w-[0.85em] h-[0.85em] rounded-full bg-rollify-gold flex items-center justify-center">
              <span className="w-[0.45em] h-[0.45em] rounded-full bg-rollify-red flex items-center justify-center">
                <span className="w-[0.18em] h-[0.18em] rounded-full bg-rollify-gold" />
              </span>
            </span>
          </span>
          <span className="text-rollify-gold">llify</span>
        </span>
      </div>

      {showTagline && (
        <div className="mt-0.5 px-2 py-0.5 border border-stone-800/40 rounded-full bg-white/70 backdrop-blur-xs">
          <p className="text-[9px] font-bold tracking-widest text-rollify-charcoal uppercase leading-none">
            A community of flavours
          </p>
        </div>
      )}
    </div>
  );
};

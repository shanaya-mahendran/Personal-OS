'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-xl border border-line bg-surface px-4 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted',
          'focus-visible:ring-2 focus-visible:ring-living-glow focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0d14]',
          error ? 'border-danger' : '',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };

'use client';

import { cn } from '@/lib/utils/cn';

type LivingSectionProps = React.HTMLAttributes<HTMLDivElement>;

export function LivingSection({
  className,
  children,
  ...props
}: LivingSectionProps) {
  return (
    <section
      className={cn(
        'living-glass p-4 sm:p-5',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-living-glow focus-visible:ring-inset',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

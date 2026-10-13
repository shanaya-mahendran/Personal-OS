'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-[#9678ff]/20 text-[#9678ff]',
        secondary: 'bg-white/10 text-white/70',
        warning: 'bg-[#ffb74d]/20 text-[#ffb74d]',
        danger: 'bg-[#ff7c92]/20 text-[#ff7c92]',
        info: 'bg-[#5fe6d6]/20 text-[#5fe6d6]',
        gold: 'bg-[#ffd36e]/20 text-[#ffd36e]',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

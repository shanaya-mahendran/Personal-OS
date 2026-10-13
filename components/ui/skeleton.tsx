import { cn } from '@/lib/utils/cn';

/** Skeleton block matching final layout shape (no spinners). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]', className)}
      {...props}
    />
  );
}

export { Skeleton };

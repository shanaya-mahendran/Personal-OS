'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

/**
 * Form field wrapper: label above, helper below, error in danger below.
 * No placeholder-as-label, no floating labels (design §4).
 */
export function Field({
  label,
  htmlFor,
  helper,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : helper ? `${htmlFor}-helper` : undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          })
        : children}
      {helper && !error ? (
        <p id={`${htmlFor}-helper`} className="text-xs text-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One composed sentence + one action (design §4 empty states). */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="max-w-[46ch] text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

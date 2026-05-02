'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2',
        {
          'border-transparent bg-zinc-900 text-zinc-50 shadow hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200':
            variant === 'default',
          'border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700':
            variant === 'secondary',
          'border-transparent bg-red-500 text-zinc-50 shadow hover:bg-red-600 dark:bg-red-900 dark:text-zinc-50 dark:hover:bg-red-800':
            variant === 'destructive',
          'text-zinc-950 dark:text-zinc-50': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };

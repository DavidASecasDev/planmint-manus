/*
 * Azul Cars Brand — Page Header
 * Title: Montserrat 700, #0F1216
 * Description: Barlow 400, #52555B
 * Icon badge: gold oklch(0.72 0.10 80) bg with navy icon
 */
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div
            className="hidden sm:flex h-12 w-12 items-center justify-center rounded-lg shrink-0"
            style={{
              backgroundColor: 'rgba(201,169,110,0.12)',
              color: 'oklch(0.72 0.10 80)',
            }}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1
            className="text-2xl tracking-tight"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              color: '#0F1216',
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="mt-1 max-w-2xl text-sm"
              style={{
                fontFamily: 'Barlow, sans-serif',
                color: '#52555B',
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

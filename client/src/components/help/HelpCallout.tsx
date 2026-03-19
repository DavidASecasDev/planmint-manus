import { Lightbulb, AlertTriangle, Info, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalloutType = 'tip' | 'warning' | 'info' | 'admin';

interface HelpCalloutProps {
  type: CalloutType;
  children: React.ReactNode;
  className?: string;
}

const calloutConfig: Record<CalloutType, {
  icon: typeof Lightbulb;
  title: string;
  bgClass: string;
  borderClass: string;
  iconClass: string;
  titleClass: string;
}> = {
  tip: {
    icon: Lightbulb,
    title: 'Consejo',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-l-blue-500',
    iconClass: 'text-blue-500',
    titleClass: 'text-blue-700 dark:text-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    title: 'Importante',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-l-amber-500',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    icon: Info,
    title: 'Nota',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-l-emerald-500',
    iconClass: 'text-emerald-500',
    titleClass: 'text-emerald-700 dark:text-emerald-400',
  },
  admin: {
    icon: Shield,
    title: 'Solo Administradores',
    bgClass: 'bg-purple-50 dark:bg-purple-950/30',
    borderClass: 'border-l-purple-500',
    iconClass: 'text-purple-500',
    titleClass: 'text-purple-700 dark:text-purple-400',
  },
};

export function HelpCallout({ type, children, className }: HelpCalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'my-4 rounded-r-lg border-l-4 p-4',
        config.bgClass,
        config.borderClass,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.iconClass)} />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm mb-1', config.titleClass)}>
            {config.title}
          </p>
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

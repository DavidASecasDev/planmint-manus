import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  const hasAction = action || (actionLabel && onAction);
  
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl scale-150" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-muted/80">
          <Icon className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">{description}</p>
      
      {(hasAction || secondaryAction || children) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <Button onClick={action.onClick} size="lg" className="gap-2 shadow-sm">
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {!action && actionLabel && onAction && (
            <Button onClick={onAction} size="lg" className="shadow-sm">
              {actionLabel}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" onClick={secondaryAction.onClick} size="lg">
              {secondaryAction.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

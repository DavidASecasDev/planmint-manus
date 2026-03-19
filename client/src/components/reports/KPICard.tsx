import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Target, 
  TrendingUp, 
  Timer,
  ListTodo,
  Loader2,
  Ban
} from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: 'tasks' | 'completed' | 'overdue' | 'blocked' | 'goal' | 'trend' | 'timer' | 'progress';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  isLoading?: boolean;
}

const iconMap = {
  tasks: ListTodo,
  completed: CheckCircle2,
  overdue: Clock,
  blocked: Ban,
  goal: Target,
  trend: TrendingUp,
  timer: Timer,
  progress: Loader2,
};

export function KPICard({
  title,
  value,
  subtitle,
  icon = 'tasks',
  trend,
  trendValue,
  variant = 'default',
  isLoading = false,
}: KPICardProps) {
  const Icon = iconMap[icon];

  const cardStyles = {
    default: 'border-border bg-card',
    success: 'border-green-200 dark:border-green-800/50 bg-gradient-to-br from-green-50/80 to-card dark:from-green-950/30 dark:to-card',
    warning: 'border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/80 to-card dark:from-amber-950/30 dark:to-card',
    danger: 'border-red-200 dark:border-red-800/50 bg-gradient-to-br from-red-50/80 to-card dark:from-red-950/30 dark:to-card',
  };

  const valueStyles = {
    default: 'text-foreground',
    success: 'text-green-700 dark:text-green-300',
    warning: 'text-amber-700 dark:text-amber-300',
    danger: 'text-red-700 dark:text-red-300',
  };

  const iconBgStyles = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    danger: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  };

  if (isLoading) {
    return (
      <Card className="border">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'border transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
      cardStyles[variant]
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{title}</p>
            <p className={cn("text-2xl lg:text-3xl font-bold tracking-tight", valueStyles[variant])}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-semibold",
                trend === 'up' ? 'text-green-600 dark:text-green-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              )}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                {trendValue}
              </div>
            )}
          </div>
          <div className={cn("p-2.5 rounded-full shrink-0", iconBgStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface CardSkeletonProps {
  className?: string;
  lines?: number;
}

export function CardSkeleton({ className, lines = 3 }: CardSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

interface ListSkeletonProps {
  count?: number;
  className?: string;
}

export function ListSkeleton({ count = 3, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  );
}

interface GridSkeletonProps {
  count?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function GridSkeleton({ count = 6, columns = 3, className }: GridSkeletonProps) {
  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  );
}

interface KanbanSkeletonProps {
  columns?: number;
}

export function KanbanSkeleton({ columns = 4 }: KanbanSkeletonProps) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <Skeleton key={j} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 border-b pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

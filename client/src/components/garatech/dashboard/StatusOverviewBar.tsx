import { REPAIR_STATUS_COLUMNS, type RepairStatus } from '@/types/garatech';
import { cn } from '@/lib/utils';

interface StatusOverviewBarProps {
  repairsByStatus: Record<RepairStatus, number>;
}

export function StatusOverviewBar({ repairsByStatus }: StatusOverviewBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {REPAIR_STATUS_COLUMNS.map((col) => (
        <div
          key={col.status}
          className={cn(
            'flex flex-col items-center justify-center p-3 rounded-lg border border-border/50 bg-card',
            'hover:border-border transition-colors'
          )}
        >
          <div
            className="w-3 h-3 rounded-full mb-2"
            style={{ backgroundColor: col.color }}
          />
          <span className="text-2xl font-bold">{repairsByStatus[col.status]}</span>
          <span className="text-xs text-muted-foreground text-center leading-tight mt-1">
            {col.label}
          </span>
        </div>
      ))}
    </div>
  );
}

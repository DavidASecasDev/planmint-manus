import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, subDays, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CLEANING_TASKS } from '@/types/vehicles';

interface VehicleCleaningHistoryProps {
  vehicleId: string;
}

export function VehicleCleaningHistory({ vehicleId }: VehicleCleaningHistoryProps) {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const endDate = format(currentDate, 'yyyy-MM-dd');
  const startDate = format(subDays(currentDate, 6), 'yyyy-MM-dd');

  const { data: history, isLoading } = useQuery({
    queryKey: ['vehicle-cleaning-history', vehicleId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_cleaning_history')
        .select('*, completed_by_profile:profiles!vehicle_cleaning_history_completed_by_fkey(name)')
        .eq('vehicle_id', vehicleId)
        .gte('completed_at', `${startDate}T00:00:00`)
        .lte('completed_at', `${endDate}T23:59:59`)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id && !!vehicleId,
  });

  const goBack = () => setCurrentDate((d) => subDays(d, 7));
  const goForward = () => {
    const next = addDays(currentDate, 7);
    if (startOfDay(next) <= startOfDay(new Date())) {
      setCurrentDate(next);
    }
  };
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  const getTaskLabel = (key: string) => {
    return CLEANING_TASKS.find((t) => t.key === key)?.label || key;
  };

  // Group by date
  const grouped = (history || []).reduce((acc, item) => {
    const date = format(new Date(item.completed_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, typeof history>);

  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(format(subDays(currentDate, i), 'yyyy-MM-dd'));
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {format(subDays(currentDate, 6), 'd MMM', { locale: es })} — {format(currentDate, 'd MMM yyyy', { locale: es })}
        </span>
        <Button variant="outline" size="icon" onClick={goForward} disabled={isToday}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {dates.map((date) => {
        const items = grouped[date] || [];
        const dateObj = new Date(date + 'T12:00:00');

        return (
          <div key={date} className="border rounded-lg p-2.5">
            <p className="text-xs font-medium mb-1.5 capitalize">
              {format(dateObj, 'EEEE d MMM', { locale: es })}
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin actividad</p>
            ) : (
              <div className="space-y-1">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span>{getTaskLabel(item.task_key)}</span>
                    <span className="text-muted-foreground">
                      {item.completed_by_profile?.name || '?'} · {format(new Date(item.completed_at), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { useDailyTasks } from '@/hooks/useDailyTasks';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export function DailyTaskHistory() {
  const { useHistory } = useDailyTasks();
  const { members } = useOrganizationMembers();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterUserId, setFilterUserId] = useState<string>('__all__');

  const activeMembers = members.filter(m => m.status === 'active');

  // Show 7 days back from current date
  const endDate = format(currentDate, 'yyyy-MM-dd');
  const startDate = format(subDays(currentDate, 6), 'yyyy-MM-dd');

  const { data: history, isLoading } = useHistory(
    startDate,
    endDate,
    filterUserId === '__all__' ? null : filterUserId
  );

  const goBack = () => setCurrentDate((d) => subDays(d, 7));
  const goForward = () => {
    const next = addDays(currentDate, 7);
    if (startOfDay(next) <= startOfDay(new Date())) {
      setCurrentDate(next);
    }
  };
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  // Group by date
  const grouped = (history || []).reduce((acc: any, item: any) => {
    const date = item.completion_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, typeof history>);

  // Generate all dates in range
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(format(subDays(currentDate, i), 'yyyy-MM-dd'));
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(subDays(currentDate, 6), 'd MMM', { locale: es })} — {format(currentDate, 'd MMM yyyy', { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={goForward} disabled={isToday}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={filterUserId} onValueChange={setFilterUserId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por persona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {activeMembers.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.profile?.name || 'Sin nombre'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dates.map((date) => {
        const items = grouped[date] || [];
        const dateObj = new Date(date + 'T12:00:00');

        return (
          <div key={date} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium capitalize">
                {format(dateObj, 'EEEE d MMMM', { locale: es })}
              </p>
              {items.length > 0 && (
                <span className="text-xs text-muted-foreground">{items.length} completada{items.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin completados</p>
            ) : (
              <div className="space-y-1">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span>{item.template?.title || 'Tarea eliminada'}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.completed_by_profile?.name || 'Desconocido'} · {format(new Date(item.completed_at), 'HH:mm')}
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

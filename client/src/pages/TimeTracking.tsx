import { useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { usePermissions, useOrganizationMembers } from '@/hooks/usePermissions';
import { TimerWidget, TimeEntryList, TimeEntryForm, TimeSummaryCards } from '@/components/time-tracking';
import { TimeTrackingFilters } from '@/types/timeTracking';

export default function TimeTracking() {
  const { hasPermission, isAdmin, isLoading: permissionsLoading } = usePermissions();
  const { members } = useOrganizationMembers();
  
  // Use permission to determine if user can view all users' time entries
  // Wait for permissions to load to avoid race conditions
  const canViewAllUsers = !permissionsLoading && (isAdmin || hasPermission('reports.view'));
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { locale: es }),
    to: endOfWeek(new Date(), { locale: es }),
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);

  const filters: TimeTrackingFilters = {
    start_date: dateRange?.from?.toISOString(),
    end_date: dateRange?.to?.toISOString(),
    user_id: selectedUserId || undefined,
  };

  const { entries, isLoading, summary, createEntry, deleteEntry } = useTimeTracking(filters);

  const quickFilters = [
    { label: 'Esta semana', getValue: () => ({ from: startOfWeek(new Date(), { locale: es }), to: endOfWeek(new Date(), { locale: es }) }) },
    { label: 'Últimos 7 días', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: 'Últimos 30 días', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  ];

  return (
    <AppLayout title="Control de Tiempo">
      <div className="space-y-6">
        {/* Timer Widget */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <TimerWidget />
          </div>
          <div className="lg:col-span-2">
            <TimeSummaryCards 
              totalMinutes={summary.total_minutes}
              billableMinutes={summary.billable_minutes}
              totalEntries={summary.total_entries}
            />
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </span>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir tiempo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {/* Quick Filters */}
              <div className="flex gap-2">
                {quickFilters.map((filter) => (
                  <Button
                    key={filter.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setDateRange(filter.getValue())}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              {/* Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'd MMM', { locale: es })} - {format(dateRange.to, 'd MMM yyyy', { locale: es })}
                        </>
                      ) : (
                        format(dateRange.from, 'd MMM yyyy', { locale: es })
                      )
                    ) : (
                      'Seleccionar fechas'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>

              {/* User Filter (only for users with reports.view or admin role) */}
              {canViewAllUsers && (
                <Select 
                  value={selectedUserId || 'all'} 
                  onValueChange={(val) => setSelectedUserId(val === 'all' ? '' : val)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todos los usuarios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios</SelectItem>
                    {members.map(member => (
                      <SelectItem key={member.id} value={member.user_id}>
                        {member.name || 'Usuario'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time Entries List */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de tiempo</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeEntryList
              entries={entries}
              isLoading={isLoading}
              onDelete={deleteEntry}
            />
          </CardContent>
        </Card>

        {/* Manual Entry Form */}
        <TimeEntryForm
          open={showForm}
          onOpenChange={setShowForm}
          onSubmit={createEntry}
        />
      </div>
    </AppLayout>
  );
}

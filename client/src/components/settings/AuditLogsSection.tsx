import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  FileText, 
  Download, 
  Search, 
  User, 
  Calendar as CalendarIcon,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useSubscription } from '@/hooks/useSubscription';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { 
  AuditLog, 
  AUDIT_ACTION_LABELS, 
  ENTITY_TYPE_LABELS 
} from '@/types/enterprise';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { EmptyState } from '@/components/ui/empty-state';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

export function AuditLogsSection() {
  const { isTeamPlan } = useSubscription();
  const { members } = useOrganizationMembers();

  // Settings.tsx ya garantiza que solo llega aquí si isProPlan || isTeamPlan
  const canViewLogs = true;
  const canExportLogs = isTeamPlan;
  const logLimit = isTeamPlan ? 500 : 100;

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), isTeamPlan ? 90 : 7),
    to: new Date(),
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { logs, isLoading, exportToCSV } = useAuditLogs({
    action: actionFilter !== 'all' ? actionFilter : undefined,
    entity_type: entityFilter !== 'all' ? entityFilter : undefined,
    actor_user_id: userFilter !== 'all' ? userFilter : undefined,
    start_date: dateRange?.from?.toISOString(),
    end_date: dateRange?.to?.toISOString(),
    limit: logLimit,
  });

  const handleExport = () => {
    if (!canExportLogs) {
      setShowUpgradeModal(true);
      return;
    }
    exportToCSV();
  };

  const clearDateRange = () => {
    setDateRange(undefined);
  };

  if (!canViewLogs) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={FileText}
            title="Registros de auditoría"
            description="Actualiza a Pro para ver los registros de auditoría de tu organización"
            action={{
              label: 'Actualizar a Pro',
              onClick: () => setShowUpgradeModal(true),
            }}
          />
          <UpgradeModal
            open={showUpgradeModal}
            onOpenChange={setShowUpgradeModal}
            limitMessage="Actualiza a Pro para acceder a los registros de auditoría"
            suggestedPlan="pro"
          />
        </CardContent>
      </Card>
    );
  }

  const actionTypes = Array.from(new Set(logs.map((l) => l.action)));
  const entityTypes = Array.from(new Set(logs.map((l) => l.entity_type)));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Registros de auditoría</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isLoading || logs.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
              {!canExportLogs && <Badge variant="secondary" className="ml-2">Pro</Badge>}
            </Button>
          </div>
          <CardDescription>
            Historial de acciones realizadas en tu organización
            {!canExportLogs && ' (últimos 7 días)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {actionTypes.map((action) => (
                  <SelectItem key={action} value={action}>
                    {AUDIT_ACTION_LABELS[action] || action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas las entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                {entityTypes.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {ENTITY_TYPE_LABELS[entity] || entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los usuarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.name || member.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "d MMM", { locale: es })} -{" "}
                        {format(dateRange.to, "d MMM yyyy", { locale: es })}
                      </>
                    ) : (
                      format(dateRange.from, "d MMM yyyy", { locale: es })
                    )
                  ) : (
                    <span>Seleccionar fechas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>

            {dateRange && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearDateRange}
                className="h-10 w-10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={Search}
                title="Sin registros"
                description="No hay registros de auditoría que coincidan con los filtros"
              />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {logs.map((log) => (
                  <button
                    key={log.id}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 text-left transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {log.actor?.name || 'Sistema'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {AUDIT_ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalle del registro</SheetTitle>
            <SheetDescription>
              Información completa de la acción registrada
            </SheetDescription>
          </SheetHeader>
          
          {selectedLog && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Usuario</label>
                <p className="mt-1">{selectedLog.actor?.name || 'Sistema'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Rol</label>
                <p className="mt-1">{selectedLog.actor_role || '-'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Acción</label>
                <p className="mt-1">
                  <Badge>{AUDIT_ACTION_LABELS[selectedLog.action] || selectedLog.action}</Badge>
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Entidad</label>
                <p className="mt-1">{ENTITY_TYPE_LABELS[selectedLog.entity_type] || selectedLog.entity_type}</p>
              </div>
              
              {selectedLog.entity_id && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID de entidad</label>
                  <p className="mt-1 font-mono text-sm">{selectedLog.entity_id}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Fecha y hora</label>
                <p className="mt-1">
                  {format(new Date(selectedLog.created_at), "d 'de' MMMM yyyy, HH:mm:ss", { locale: es })}
                </p>
              </div>
              
              {selectedLog.ip_address && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Dirección IP</label>
                  <p className="mt-1 font-mono text-sm">{selectedLog.ip_address}</p>
                </div>
              )}
              
              {Object.keys(selectedLog.metadata_json || {}).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Detalles</label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-auto">
                    {JSON.stringify(selectedLog.metadata_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza a Team para exportar registros de auditoría"
        suggestedPlan="team"
      />
    </div>
  );
}

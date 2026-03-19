import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Trash2, Edit2, DollarSign, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { TimeEntryWithRelations } from '@/types/timeTracking';

interface TimeEntryListProps {
  entries: TimeEntryWithRelations[];
  isLoading: boolean;
  onEdit?: (entry: TimeEntryWithRelations) => void;
  onDelete?: (id: string) => void;
}

export function TimeEntryList({ entries, isLoading, onEdit, onDelete }: TimeEntryListProps) {
  const formatDuration = (minutes: number | null): string => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Sin entradas de tiempo</h3>
        <p className="text-muted-foreground">
          Inicia el temporizador o añade tiempo manualmente
        </p>
      </div>
    );
  }

  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    const date = format(new Date(entry.start_time), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, TimeEntryWithRelations[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedEntries).map(([date, dayEntries]) => {
        const totalMinutes = dayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
        
        return (
          <div key={date}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">
                {format(new Date(date), "EEEE, d 'de' MMMM", { locale: es })}
              </h3>
              <Badge variant="secondary">
                {formatDuration(totalMinutes)}
              </Badge>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.description || <span className="text-muted-foreground">Sin descripción</span>}
                        {entry.is_billable && (
                          <DollarSign className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.task ? (
                        <Badge variant="outline">{entry.task.title}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(entry.start_time), 'HH:mm')}
                      {entry.end_time && ` - ${format(new Date(entry.end_time), 'HH:mm')}`}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.is_running ? (
                        <Badge className="animate-pulse">En curso</Badge>
                      ) : (
                        formatDuration(entry.duration_minutes)
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(entry)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {onDelete && (
                            <DropdownMenuItem 
                              onClick={() => onDelete(entry.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}

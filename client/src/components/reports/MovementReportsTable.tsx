import { ArrowUpDown, Trophy, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MovementUserStats } from '@/hooks/useMovementReports';

interface MovementReportsTableProps {
  users: MovementUserStats[];
  isLoading: boolean;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'N/D';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function MovementReportsTable({ users, isLoading }: MovementReportsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Rendimiento por usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Rendimiento por usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay datos de movimientos para el período seleccionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ArrowUpDown className="h-5 w-5" />
          Rendimiento por usuario
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Entregas</TableHead>
              <TableHead className="text-right">Recogidas</TableHead>
              <TableHead className="text-right">Escobas</TableHead>
              <TableHead className="text-right">Limpiezas</TableHead>
              <TableHead className="text-right">Completados</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  Tiempo Prom.
                </div>
              </TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user, index) => (
              <TableRow key={user.userId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.userName?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.userName || 'Sin nombre'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{user.entregas}</TableCell>
                <TableCell className="text-right">{user.recogidas}</TableCell>
                <TableCell className="text-right">{user.escobas}</TableCell>
                <TableCell className="text-right">{user.limpiezas}</TableCell>
                <TableCell className="text-right">{user.completed}</TableCell>
                <TableCell className="text-right">
                  <span className={user.avgDurationMinutes !== null ? 'font-medium' : 'text-muted-foreground'}>
                    {formatDuration(user.avgDurationMinutes)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold text-primary">
                  {user.total}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

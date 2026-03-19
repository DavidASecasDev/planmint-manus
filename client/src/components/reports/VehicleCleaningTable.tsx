import { Car, Trophy, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleCleaningUserStats } from '@/types/reports';

interface VehicleCleaningTableProps {
  users: VehicleCleaningUserStats[];
  isLoading: boolean;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return 'N/D';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function VehicleCleaningTable({ users, isLoading }: VehicleCleaningTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Car className="h-5 w-5" />
            Rendimiento por miembro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
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
            <Car className="h-5 w-5" />
            Rendimiento por miembro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay datos de limpieza para el período seleccionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort users by average cleaning time for ranking (fastest first)
  const usersWithTimeRanking = [...users].sort((a, b) => {
    if (a.avgCleaningTimeMinutes === null) return 1;
    if (b.avgCleaningTimeMinutes === null) return -1;
    return a.avgCleaningTimeMinutes - b.avgCleaningTimeMinutes;
  });
  
  const fastestUserId = usersWithTimeRanking.find(u => u.avgCleaningTimeMinutes !== null)?.userId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Car className="h-5 w-5" />
          Rendimiento por miembro
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Vehículos</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  Tiempo Prom.
                </div>
              </TableHead>
              <TableHead className="text-right">Inicio</TableHead>
              <TableHead className="text-right">Repost.</TableHead>
              <TableHead className="text-right">Presión</TableHead>
              <TableHead className="text-right">Avisos</TableHead>
              <TableHead className="text-right">Borrado</TableHead>
              <TableHead className="text-right">Int.</TableHead>
              <TableHead className="text-right">Ext.</TableHead>
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
                <TableCell className="text-right">{user.vehiclesCleaned}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {user.userId === fastestUserId && user.avgCleaningTimeMinutes !== null && (
                      <span className="text-green-600 text-xs">🏃</span>
                    )}
                    <span className={user.avgCleaningTimeMinutes !== null ? 'font-medium' : 'text-muted-foreground'}>
                      {formatDuration(user.avgCleaningTimeMinutes)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{user.tasksByType['inicio_prep'] || 0}</TableCell>
                <TableCell className="text-right">{user.tasksByType['repostaje'] || 0}</TableCell>
                <TableCell className="text-right">{user.tasksByType['presion'] || 0}</TableCell>
                <TableCell className="text-right">{user.tasksByType['avisos'] || 0}</TableCell>
                <TableCell className="text-right">{user.tasksByType['borrado'] || 0}</TableCell>
                <TableCell className="text-right">{user.tasksByType['limpieza_int'] || 0}</TableCell>
                <TableCell className="text-right">{user.tasksByType['limpieza_ext'] || 0}</TableCell>
                <TableCell className="text-right font-semibold text-primary">
                  {user.totalTasks}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
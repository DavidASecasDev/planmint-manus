import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { UserReport } from '@/types/reports';

interface TeamTableProps {
  users: UserReport[];
  isLoading?: boolean;
}

export function TeamTable({ users, isLoading = false }: TeamTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Rendimiento por usuario</CardTitle>
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
          <CardTitle className="text-base font-semibold">Rendimiento por usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay datos de usuarios
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort by completed tasks descending
  const sortedUsers = [...users].sort((a, b) => b.tasksCompleted - a.tasksCompleted);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Rendimiento por usuario</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Abiertas</TableHead>
              <TableHead className="text-right">Completadas</TableHead>
              <TableHead className="text-right">Vencidas</TableHead>
              <TableHead className="text-right">Tiempo ciclo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow key={user.userId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.userName?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.userName || 'Usuario'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{user.tasksOpen}</TableCell>
                <TableCell className="text-right text-green-600 dark:text-green-400">
                  {user.tasksCompleted}
                </TableCell>
                <TableCell className="text-right">
                  {user.tasksOverdue > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">{user.tasksOverdue}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {user.avgCycleTime !== null
                    ? `${user.avgCycleTime.toFixed(1)}d`
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

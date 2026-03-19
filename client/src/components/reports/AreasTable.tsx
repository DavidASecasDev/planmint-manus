import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaReport } from '@/types/reports';
import { AreaIcon } from '@/components/areas/AreaIcon';

interface AreasTableProps {
  areas: AreaReport[];
  isLoading?: boolean;
}

export function AreasTable({ areas, isLoading = false }: AreasTableProps) {

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Rendimiento por área</CardTitle>
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

  if (areas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Rendimiento por área</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay áreas con tareas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Rendimiento por área</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Área</TableHead>
              <TableHead className="text-right">Abiertas</TableHead>
              <TableHead className="text-right">Completadas</TableHead>
              <TableHead className="text-right">Vencidas</TableHead>
              <TableHead className="text-right">Bloqueadas</TableHead>
              <TableHead className="text-right">Tiempo ciclo</TableHead>
              <TableHead>Top tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas.map((area) => (
              <TableRow
                key={area.areaId}
                className="hover:bg-muted/50"
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: area.areaColor || '#6366f1' }}
                    >
                      <AreaIcon icon={area.areaIcon || 'folder'} className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium">{area.areaName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{area.tasksOpen}</TableCell>
                <TableCell className="text-right text-green-600 dark:text-green-400">
                  {area.tasksCompleted}
                </TableCell>
                <TableCell className="text-right">
                  {area.tasksOverdue > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">{area.tasksOverdue}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {area.tasksBlocked > 0 ? (
                    <span className="text-red-600 dark:text-red-400">{area.tasksBlocked}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {area.avgCycleTime !== null
                    ? `${area.avgCycleTime.toFixed(1)}d`
                    : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {area.topTags.slice(0, 2).map((tag) => (
                      <Badge key={tag.tagId} variant="secondary" className="text-xs">
                        {tag.tagName}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

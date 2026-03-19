import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkshopStats } from '@/hooks/useGaratechReports';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

interface GaratechReportsTableProps {
  workshops: WorkshopStats[];
  isLoading?: boolean;
}

export function GaratechReportsTable({ workshops, isLoading }: GaratechReportsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Rendimiento por taller</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Rendimiento por taller</CardTitle></CardHeader>
      <CardContent>
        {workshops.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos de talleres</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Taller</TableHead>
                  <TableHead className="text-right">Reparaciones</TableHead>
                  <TableHead className="text-right">Coste total</TableHead>
                  <TableHead className="text-right">Días promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workshops.map((w) => (
                  <TableRow key={w.workshopName}>
                    <TableCell className="font-medium">{w.workshopName}</TableCell>
                    <TableCell className="text-right">{w.totalRepairs}</TableCell>
                    <TableCell className="text-right">{formatCurrency(w.totalCost)}</TableCell>
                    <TableCell className="text-right">
                      {w.avgDays !== null ? `${Math.round(w.avgDays)}d` : 'N/D'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

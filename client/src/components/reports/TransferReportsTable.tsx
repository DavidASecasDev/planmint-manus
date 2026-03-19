import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TransferBrokerStats } from '@/hooks/useTransferReports';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

interface TransferReportsTableProps {
  brokers: TransferBrokerStats[];
  isLoading?: boolean;
}

export function TransferReportsTable({ brokers, isLoading }: TransferReportsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Rendimiento por broker</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Rendimiento por broker</CardTitle></CardHeader>
      <CardContent>
        {brokers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos de brokers</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Broker</TableHead>
                  <TableHead className="text-right">Solicitudes</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Costes</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brokers.map((b) => (
                  <TableRow key={b.brokerName}>
                    <TableCell className="font-medium">{b.brokerName}</TableCell>
                    <TableCell className="text-right">{b.totalRequests}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.cost)}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={b.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(b.margin)}
                      </span>
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

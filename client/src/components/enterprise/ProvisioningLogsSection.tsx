import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Search, Filter, RefreshCw } from 'lucide-react';
import { useProvisioningLogs } from '@/hooks/useProvisioningLogs';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function ProvisioningLogsSection() {
  const [filters, setFilters] = useState({
    source: undefined as 'saml' | 'scim' | undefined,
    status: undefined as 'success' | 'failed' | undefined,
    search: '',
  });

  const { logs, stats, isLoading } = useProvisioningLogs(filters);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Logs de Provisioning
            </CardTitle>
            <CardDescription>
              Historial de eventos SAML y SCIM
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">Total: {stats.total}</Badge>
            <Badge variant="default" className="bg-green-500">{stats.success} éxitos</Badge>
            <Badge variant="destructive">{stats.failed} fallos</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por external ID o mensaje..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.source || 'all'}
            onValueChange={(value) => 
              setFilters({ ...filters, source: value === 'all' ? undefined : value as 'saml' | 'scim' })
            }
          >
            <SelectTrigger className="w-[130px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="saml">SAML</SelectItem>
              <SelectItem value="scim">SCIM</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => 
              setFilters({ ...filters, status: value === 'all' ? undefined : value as 'success' | 'failed' })
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Éxito</SelectItem>
              <SelectItem value="failed">Fallo</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFilters({ source: undefined, status: undefined, search: '' })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Logs Table */}
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No hay logs de provisioning</p>
            <p className="text-sm">Los eventos SAML y SCIM aparecerán aquí</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Fecha</TableHead>
                  <TableHead className="w-[80px]">Fuente</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead>Mensaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.source.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {log.action}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {log.external_id || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={log.status === 'success' ? 'default' : 'destructive'}
                        className={log.status === 'success' ? 'bg-green-500' : ''}
                      >
                        {log.status === 'success' ? 'Éxito' : 'Fallo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {log.message}
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

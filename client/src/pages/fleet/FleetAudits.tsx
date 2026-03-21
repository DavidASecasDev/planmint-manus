import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VehicleAuditDialog } from '@/components/vehicles/VehicleAuditDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  ClipboardCheck,
  Search,
  ShieldCheck,
  ShieldX,
  Clock,
  Camera,
  Eye,
  Car,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { VehicleWithTasks } from '@/types/vehicles';

interface AuditRow {
  id: string;
  vehicle_id: string;
  organization_id: string;
  auditor_id: string;
  status: 'in_progress' | 'approved' | 'rejected';
  overall_score: number;
  checklist_results: any;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  auditor_profile: { name: string } | null;
  vehicle: {
    id: string;
    matricula: string;
    modelo: string | null;
    marca: string | null;
    categoria: string | null;
    status: string;
  } | null;
  photo_count: number;
}

export default function FleetAudits() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithTasks | null>(null);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);

  // Fetch all audits for the organization
  const auditsQuery = useQuery({
    queryKey: ['fleet-audits-list', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data: audits, error } = await (supabase as any)
        .from('vehicle_quality_audits')
        .select(`
          *,
          auditor_profile:profiles!vehicle_quality_audits_auditor_id_fkey(name),
          vehicle:vehicles!vehicle_quality_audits_vehicle_id_fkey(id, matricula, modelo, marca, categoria, status)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch photo counts for all audits
      const auditIds = (audits || []).map((a: any) => a.id);
      let photoCounts: Record<string, number> = {};

      if (auditIds.length > 0) {
        const { data: photos, error: pError } = await (supabase as any)
          .from('vehicle_audit_photos')
          .select('audit_id')
          .in('audit_id', auditIds);

        if (!pError && photos) {
          for (const p of photos) {
            photoCounts[p.audit_id] = (photoCounts[p.audit_id] || 0) + 1;
          }
        }
      }

      return (audits || []).map((a: any) => ({
        ...a,
        photo_count: photoCounts[a.id] || 0,
      })) as AuditRow[];
    },
    enabled: !!orgId,
  });

  const filteredAudits = useMemo(() => {
    let result = auditsQuery.data || [];

    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.vehicle?.matricula?.toLowerCase().includes(term) ||
          a.vehicle?.modelo?.toLowerCase().includes(term) ||
          a.vehicle?.marca?.toLowerCase().includes(term) ||
          a.auditor_profile?.name?.toLowerCase().includes(term),
      );
    }

    return result;
  }, [auditsQuery.data, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    const all = auditsQuery.data || [];
    return {
      total: all.length,
      inProgress: all.filter((a) => a.status === 'in_progress').length,
      approved: all.filter((a) => a.status === 'approved').length,
      rejected: all.filter((a) => a.status === 'rejected').length,
    };
  }, [auditsQuery.data]);

  const handleOpenAudit = (audit: AuditRow) => {
    if (!audit.vehicle) return;
    // Build a minimal VehicleWithTasks object for the dialog
    setSelectedVehicle({
      id: audit.vehicle.id,
      matricula: audit.vehicle.matricula,
      modelo: audit.vehicle.modelo,
      marca: audit.vehicle.marca,
      categoria: audit.vehicle.categoria,
      status: audit.vehicle.status,
    } as unknown as VehicleWithTasks);
    setAuditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
            <ShieldCheck className="h-3 w-3" />
            Aprobada
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
            <ShieldX className="h-3 w-3" />
            Rechazada
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1">
            <Clock className="h-3 w-3" />
            En progreso
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 font-bold';
    if (score >= 70) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  return (
    <AppLayout title="Auditorías de Calidad">
      <div className="container py-6 space-y-6">
        <PageHeader
          title="Auditorías de Calidad"
          description="Historial y seguimiento de auditorías de calidad de vehículos"
          icon={ClipboardCheck}
        />

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">En progreso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Aprobadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Rechazadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por matrícula, modelo o auditor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="approved">Aprobadas</SelectItem>
              <SelectItem value="rejected">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {auditsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredAudits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No hay auditorías</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== 'all'
                  ? 'No se encontraron auditorías con los filtros seleccionados.'
                  : 'Las auditorías aparecerán aquí cuando se inicien desde el Kanban de vehículos.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Puntuación</TableHead>
                    <TableHead>Auditor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Fotos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAudits.map((audit) => (
                    <TableRow key={audit.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">
                              {audit.vehicle?.matricula || 'Sin matrícula'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[audit.vehicle?.marca, audit.vehicle?.modelo]
                                .filter(Boolean)
                                .join(' ') || 'Sin modelo'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(audit.status)}</TableCell>
                      <TableCell className="text-center">
                        <span className={getScoreColor(audit.overall_score)}>
                          {audit.overall_score}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {audit.auditor_profile?.name || 'Desconocido'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(audit.created_at), 'd MMM yyyy', { locale: es })}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(audit.created_at), 'HH:mm', { locale: es })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {audit.photo_count > 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Camera className="h-3 w-3" />
                            {audit.photo_count}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAudit(audit)}
                          className="gap-1.5"
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Audit dialog */}
      <VehicleAuditDialog
        open={auditDialogOpen}
        onOpenChange={(open) => {
          setAuditDialogOpen(open);
          if (!open) {
            // Refresh the list when dialog closes
            auditsQuery.refetch();
          }
        }}
        vehicle={selectedVehicle}
      />
    </AppLayout>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useFleetVehicle } from '@/hooks/useFleetVehicles';
import { useFleetInspections } from '@/hooks/useFleetInspections';
import { VehicleDamageHistory } from '@/components/fleet/VehicleDamageHistory';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Camera, Calendar, ChevronRight, Car, FileText, Gauge, Fuel, StickyNote, Building2, Pencil, Palette, Zap, Settings, Hash } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FLEET_STATUS_OPTIONS } from '@/types/fleet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}

function SettingsRow({ icon, label, value, last }: SettingsRowProps) {
  return (
    <div className={`flex items-center gap-3 py-3 px-1 ${!last ? 'border-b border-border/50' : ''}`}>
      <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

export default function FleetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vehicle, isLoading } = useFleetVehicle(id);
  const { data: inspections = [], isLoading: inspsLoading } = useFleetInspections(id);

  if (isLoading) {
    return (
      <AppLayout title="Detalle Vehículo">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!vehicle) {
    return (
      <AppLayout title="Vehículo no encontrado">
        <div className="text-center py-16">
          <p className="text-muted-foreground">El vehículo no existe.</p>
          <Button variant="outline" onClick={() => navigate('/fleet')} className="mt-4 rounded-xl">Volver</Button>
        </div>
      </AppLayout>
    );
  }

  const statusOpt = FLEET_STATUS_OPTIONS.find(o => o.value === vehicle.status);
  const statusStyle = {
    backgroundColor: `${statusOpt?.color}15`,
    color: statusOpt?.color,
  };

  return (
    <AppLayout title={vehicle.matricula}>
      <div className="max-w-2xl mx-auto space-y-5 pb-8">
        <Button variant="ghost" onClick={() => navigate('/fleet')} className="rounded-xl -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Flota
        </Button>

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4 relative"
        >
          {/* Edit button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/fleet/${id}/edit`)}
            className="absolute top-4 right-0 rounded-xl"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-border">
            {(vehicle as any).photo_url ? (
              <AvatarImage src={(vehicle as any).photo_url} alt={vehicle.matricula} />
            ) : null}
            <AvatarFallback className="bg-muted/60">
              <Car className="h-9 w-9 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-mono font-bold tracking-wider text-foreground">
            {vehicle.matricula}
          </h2>
          <p className="text-muted-foreground mt-1">{vehicle.modelo || 'Sin modelo'}</p>
          <Badge
            variant="outline"
            className="mt-3 rounded-full px-4 py-1 text-xs font-medium border-0"
            style={statusStyle}
          >
            {statusOpt?.label || vehicle.status}
          </Badge>
        </motion.div>

        {/* Contract Section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card border border-border/50 shadow-sm p-4"
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Contrato
          </h3>
          <SettingsRow
            icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
            label="Proveedor"
            value={vehicle.proveedor || '—'}
          />
          <SettingsRow
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            label="Nº Contrato"
            value={vehicle.numero_contrato || '—'}
          />
          <SettingsRow
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            label="Inicio"
            value={vehicle.fecha_inicio_contrato ? format(new Date(vehicle.fecha_inicio_contrato), 'dd MMM yyyy', { locale: es }) : '—'}
          />
          <SettingsRow
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            label="Fin"
            value={vehicle.fecha_fin_contrato ? format(new Date(vehicle.fecha_fin_contrato), 'dd MMM yyyy', { locale: es }) : '—'}
            last
          />
        </motion.div>

        {/* Vehicle Details Section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card border border-border/50 shadow-sm p-4"
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Vehículo
          </h3>
          <SettingsRow
            icon={<Hash className="h-4 w-4 text-muted-foreground" />}
            label="Nº Bastidor"
            value={vehicle.numero_bastidor || '—'}
          />
          <SettingsRow
            icon={<Car className="h-4 w-4 text-muted-foreground" />}
            label="Grupo"
            value={vehicle.categoria || '—'}
          />
          <SettingsRow
            icon={<Car className="h-4 w-4 text-muted-foreground" />}
            label="Marca"
            value={vehicle.marca || '—'}
          />
          <SettingsRow
            icon={<Palette className="h-4 w-4 text-muted-foreground" />}
            label="Color"
            value={vehicle.color || '—'}
          />
          <SettingsRow
            icon={<Fuel className="h-4 w-4 text-muted-foreground" />}
            label="Combustible"
            value={vehicle.combustible || '—'}
          />
          <SettingsRow
            icon={<Zap className="h-4 w-4 text-muted-foreground" />}
            label="Híbrido"
            value={vehicle.hibrido ? 'Sí' : 'No'}
          />
          <SettingsRow
            icon={<Settings className="h-4 w-4 text-muted-foreground" />}
            label="Motor"
            value={vehicle.motor || '—'}
          />
          <SettingsRow
            icon={<Gauge className="h-4 w-4 text-muted-foreground" />}
            label="CV"
            value={vehicle.cv != null ? `${vehicle.cv} CV` : '—'}
          />
          <SettingsRow
            icon={<Gauge className="h-4 w-4 text-muted-foreground" />}
            label="Km Recogida"
            value={vehicle.km_recogida != null ? `${vehicle.km_recogida.toLocaleString()} km` : '—'}
          />
          <SettingsRow
            icon={<Gauge className="h-4 w-4 text-muted-foreground" />}
            label="Km Devolución"
            value={vehicle.km_devolucion != null ? `${vehicle.km_devolucion.toLocaleString()} km` : '—'}
          />
          <SettingsRow
            icon={<Fuel className="h-4 w-4 text-muted-foreground" />}
            label="Último Combustible"
            value={inspections[0]?.nivel_combustible ? `⛽ ${inspections[0].nivel_combustible}` : '—'}
            last={!vehicle.notas}
          />
          {vehicle.notas && (
            <SettingsRow
              icon={<StickyNote className="h-4 w-4 text-muted-foreground" />}
              label="Notas"
              value={vehicle.notas}
              last
            />
          )}
        </motion.div>


        {/* Damage History Section */}
        <VehicleDamageHistory
          fleetVehicleId={vehicle.id}
          organizationId={vehicle.organization_id}
          vehiclePlate={vehicle.matricula}
        />

        {/* Inspections Section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Inspecciones
            </h3>
            <span className="text-xs text-muted-foreground">{inspections.length}</span>
          </div>

          {/* New Inspection Button */}
          <Button
            onClick={() => navigate(`/fleet/${id}/inspection/new`)}
            className="w-full rounded-2xl h-12 text-base"
          >
            <Camera className="h-5 w-5 mr-2" />
            Nueva Inspección
          </Button>

          {inspsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : inspections.length === 0 ? (
            <div className="text-center py-10 rounded-2xl bg-card border border-border/50">
              <Camera className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hay inspecciones aún</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Registra la primera inspección de recogida</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
              {inspections.map((insp, idx) => (
                <div
                  key={insp.id}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors ${
                    idx < inspections.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                  onClick={() => navigate(`/fleet/${id}/inspection/${insp.id}`)}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    insp.inspection_type === 'recogida'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-secondary-foreground'
                  }`}>
                    <Camera className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {insp.inspection_type === 'recogida' ? 'Recogida' : 'Devolución'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(insp.inspection_date), 'dd MMM yyyy · HH:mm', { locale: es })}
                      {insp.km ? ` · ${insp.km.toLocaleString()} km` : ''}
                      {insp.nivel_combustible ? ` · ⛽ ${insp.nivel_combustible}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(insp.photos?.length || 0) > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                        {insp.photos?.length} 📷
                      </span>
                    )}
                    {(insp.damages?.length || 0) > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                        {insp.damages?.length} ⚠️
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FAULT_ASSESSMENT_LABELS, REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, type Accident, type FaultAssessment } from '@/types/garatech';
import { CalendarDays, MapPin, Car, User, Shield, DollarSign, Wrench } from 'lucide-react';
import { AccidentEditForm } from './AccidentEditForm';

interface Props {
  accident: Accident;
  isEditing?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

export function AccidentGeneralTab({ accident, isEditing, onSave, onCancel }: Props) {
  if (isEditing && onSave && onCancel) {
    return <AccidentEditForm accident={accident} onSave={onSave} onCancel={onCancel} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {/* Datos del accidente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos del Accidente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={CalendarDays} label="Fecha y hora" value={format(new Date(accident.accident_date), "dd/MM/yyyy HH:mm", { locale: es })} />
          <InfoRow icon={MapPin} label="Ubicación" value={accident.location} />
          <div className="py-2">
            <p className="text-xs text-muted-foreground">Descripción</p>
            <p className="text-sm mt-1 whitespace-pre-wrap">{accident.description}</p>
          </div>
          <InfoRow label="Nº Atestado Policial" value={accident.police_report_number} />
          <InfoRow label="Nº Siniestro (Seguro)" value={accident.claim_number || accident.insurance_claim_number} />
          <InfoRow label="Valoración de Culpabilidad" value={FAULT_ASSESSMENT_LABELS[(accident.fault_assessment || 'pendiente') as FaultAssessment]} />
        </CardContent>
      </Card>

      {/* Vehículo propio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4" />
            Vehículo Propio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Matrícula" value={accident.vehicle?.matricula} />
          <InfoRow label="Modelo" value={accident.vehicle?.modelo} />
        </CardContent>
      </Card>

      {/* Vehículo contrario */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Vehículo Contrario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Nombre conductor" value={accident.third_party_name} />
          <InfoRow label="Matrícula" value={accident.third_party_plate} />
          <InfoRow label="Vehículo (marca/modelo)" value={accident.third_party_vehicle} />
          <InfoRow label="Aseguradora" value={accident.third_party_insurance} />
          <InfoRow label="Nº Póliza" value={accident.third_party_policy_number} />
          <InfoRow label="Teléfono" value={accident.third_party_phone} />
        </CardContent>
      </Card>

      {/* Datos económicos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Datos Económicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Coste estimado de reparación" value={accident.estimated_cost != null ? `${accident.estimated_cost.toFixed(2)} €` : undefined} />
          <InfoRow label="Cobertura del seguro" value={accident.insurance_coverage != null ? `${accident.insurance_coverage.toFixed(2)} €` : undefined} />
        </CardContent>
      </Card>

      {/* Reparación vinculada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Reparación Vinculada
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accident.linked_repair ? (
            <div className="flex items-center justify-between">
              <Link 
                to={`/garatech/repairs/${accident.linked_repair.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {accident.linked_repair.repair_number}
              </Link>
              <Badge className={REPAIR_STATUS_COLORS[accident.linked_repair.status]}>
                {REPAIR_STATUS_LABELS[accident.linked_repair.status]}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin reparación vinculada</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

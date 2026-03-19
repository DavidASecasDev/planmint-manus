import { useState } from 'react';
import { Calendar, Euro, Gauge, Clock, FileText, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { RepairDatesDialog } from './RepairDatesDialog';
import { RepairEditForm } from './RepairEditForm';
import type { Repair } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepairGeneralTabProps {
  repair: Repair;
  isEditing?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
}

export function RepairGeneralTab({ repair, isEditing, onSave, onCancel }: RepairGeneralTabProps) {
  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const { hasPermission, isOwner } = usePermissions();
  
  const canEditDates = isOwner || hasPermission('garatech.edit_dates');

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: es });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '—';
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  };

  const formatKm = (km: number | null | undefined) => {
    if (km == null) return '—';
    return new Intl.NumberFormat('es-ES').format(km) + ' km';
  };

  if (isEditing && onSave && onCancel) {
    return <RepairEditForm repair={repair} onSave={onSave} onCancel={onCancel} />;
  }

  return (
    <div className="space-y-4">
      {/* Description */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Descripción</h4>
              <p className="text-sm">{repair.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates & Costs Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Fecha Prog.</p>
            <p className="text-sm font-medium">{formatDate(repair.scheduled_date)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Euro className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Coste Est.</p>
            <p className="text-sm font-medium">{formatCurrency(repair.cost_estimate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Gauge className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Kilómetros</p>
            <p className="text-sm font-medium">{formatKm(repair.km_at_repair)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Dates with Edit Button */}
      <div className="space-y-2">
        {canEditDates && (
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDatesDialogOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Editar Fechas
            </Button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-xs text-muted-foreground">Inicio</p>
              <p className="text-sm font-medium">{formatDate(repair.started_at)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-xs text-muted-foreground">Fin</p>
              <p className="text-sm font-medium">{formatDate(repair.completed_at)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Euro className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-xs text-muted-foreground">Coste Final</p>
              <p className="text-sm font-medium">{formatCurrency(repair.cost_final)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notes */}
      {repair.notes && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Notas</h4>
            <p className="text-sm whitespace-pre-wrap">{repair.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Created Info */}
      <div className="text-xs text-muted-foreground text-center pt-2">
        Creada el {formatDate(repair.created_at)}
        {repair.created_by_profile?.name && ` por ${repair.created_by_profile.name}`}
      </div>

      {/* Dates Dialog */}
      <RepairDatesDialog
        repair={repair}
        open={datesDialogOpen}
        onOpenChange={setDatesDialogOpen}
      />
    </div>
  );
}

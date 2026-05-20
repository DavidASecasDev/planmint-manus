import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TransferStatusBadge } from './TransferStatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Users, Building2, User, Trash2, Euro, ShieldAlert, Clock, Briefcase, Archive, ArchiveRestore, Zap } from 'lucide-react';
import { CLIENT_TYPE_META, SERVICE_TYPE_META } from '@/types/transfers';
import { getMarginPercent, getMarginAlertLevel } from '@/utils/marginAlerts';
import { useMarginThresholds } from '@/hooks/useMarginThresholds';
import type { TransferRequest, TransferRequestStatus } from '@/types/transfers';

const INLINE_STATUS_OPTIONS: { value: TransferRequestStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_gestion', label: 'En gestión' },
  { value: 'presupuesto_enviado', label: 'Ppto. Enviado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

interface TransferRequestCardProps {
  request: TransferRequest;
  onClick: () => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onStatusChange?: (id: string, status: TransferRequestStatus) => void;
  canDelete?: boolean;
  canManage?: boolean;
}

export function TransferRequestCard({ request, onClick, onDelete, onArchive, onUnarchive, onStatusChange, canDelete, canManage }: TransferRequestCardProps) {
  const formattedDate = request.first_transfer_date
    ? format(new Date(request.first_transfer_date), "d MMM yyyy", { locale: es })
    : 'Sin fecha';
  const thresholds = useMarginThresholds();

  // Compute proximity badge for upcoming transfers
  const getProximityLabel = (): string | null => {
    if (!request.first_transfer_date) return null;
    if (request.status === 'completado' || request.status === 'cancelado') return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const transferDate = new Date(request.first_transfer_date);
    transferDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((transferDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays <= 3) return `En ${diffDays} días`;
    return null;
  };
  const proximityLabel = getProximityLabel();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
  };


  // Calculate margin alert from request-level totals with configurable thresholds
  const clientTotal = request.client_total || request.total_amount || 0;
  const providerCost = request.provider_cost || 0;
  const marginPercent = getMarginPercent(providerCost, clientTotal);
  const marginLevel = providerCost > 0 ? getMarginAlertLevel(marginPercent, { danger: thresholds.danger, warning: thresholds.warning }) : 'ok';

  const isArchived = !!request.archived_at;
  const isCancelled = request.status === 'cancelado';

  return (
    <Card 
      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors border ${
        marginLevel === 'danger' ? 'border-red-300/50' : ''
      } ${isArchived ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">
              {request.request_number}
            </span>
            {canManage && onStatusChange ? (
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  value={request.status}
                  onValueChange={(value) => onStatusChange(request.id, value as TransferRequestStatus)}
                >
                  <SelectTrigger className="h-6 w-auto gap-1 px-2 text-[11px] font-medium border-0 bg-transparent hover:bg-muted/80 focus:ring-0 focus:ring-offset-0">
                    <TransferStatusBadge status={request.status} />
                  </SelectTrigger>
                  <SelectContent>
                    {INLINE_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <TransferStatusBadge status={request.status} />
            )}

            {marginLevel === 'danger' && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                <ShieldAlert className="h-3 w-3" />
                {marginPercent}%
              </Badge>
            )}
            {request.client_type && request.client_type !== 'external_client' && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${CLIENT_TYPE_META[request.client_type]?.color || ''}`}>
                <Briefcase className="h-3 w-3 mr-0.5" />
                {CLIENT_TYPE_META[request.client_type]?.label || request.client_type}
              </Badge>
            )}
            {request.service_type && request.service_type === 'pack' && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${SERVICE_TYPE_META[request.service_type]?.color || ''}`}>
                <Clock className="h-3 w-3 mr-0.5" />
                {SERVICE_TYPE_META[request.service_type]?.label || request.service_type}
              </Badge>
            )}
            {isArchived && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-gray-300 text-gray-500 bg-gray-50">
                <Archive className="h-3 w-3 mr-0.5" />
                Archivado
              </Badge>
            )}
            {proximityLabel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-300 text-amber-700 bg-amber-50">
                <Zap className="h-3 w-3 mr-0.5" />
                {proximityLabel}
              </Badge>
            )}
          </div>
          
          <h3 className="font-semibold text-lg truncate">
            {request.client_name}
          </h3>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{request.broker_name}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{request.items_count || 0} transfer{(request.items_count || 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-start gap-2 shrink-0">
          {/* Archive/Unarchive button for cancelled requests */}
          {canManage && isCancelled && !isArchived && onArchive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-amber-600"
              title="Archivar"
              onClick={(e) => {
                e.stopPropagation();
                onArchive(request.id);
              }}
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
          {canManage && isArchived && onUnarchive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
              title="Desarchivar"
              onClick={(e) => {
                e.stopPropagation();
                onUnarchive(request.id);
              }}
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          )}
          {canDelete && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar solicitud de transfer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará la solicitud de transfer para <strong>{request.client_name}</strong> ({request.request_number}). Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(request.id);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <div className="text-right space-y-1">
            {request.is_external_provider ? (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="max-w-[150px] truncate">{request.external_provider_name || 'Externo'}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Interno</span>
            )}
            {clientTotal > 0 && (
              <div className={`flex items-center justify-end gap-1 text-sm font-medium ${
                marginLevel === 'danger' ? 'text-red-600' : 'text-foreground'
              }`}>
                <Euro className="h-3.5 w-3.5" />
                <span>{(clientTotal * 1.21).toFixed(2)} €</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

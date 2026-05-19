import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Users, Euro, Building2, User, GripVertical, Filter } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TransferRequest, TransferRequestStatus, ServiceType } from '@/types/transfers';

interface TransfersKanbanProps {
  requests: TransferRequest[];
  onStatusChange: (params: { id: string; status: TransferRequestStatus }) => void;
  brokers: string[];
}

const KANBAN_COLUMNS: { status: TransferRequestStatus; label: string; color: string; headerBg: string; textColor: string }[] = [
  { status: 'pendiente', label: 'Pendiente', color: 'border-t-yellow-500', headerBg: 'bg-yellow-500/10', textColor: 'text-yellow-600' },
  { status: 'en_gestion', label: 'En gestión', color: 'border-t-blue-500', headerBg: 'bg-blue-500/10', textColor: 'text-blue-600' },
  { status: 'presupuesto_enviado', label: 'Ppto. Enviado', color: 'border-t-orange-500', headerBg: 'bg-orange-500/10', textColor: 'text-orange-600' },
  { status: 'confirmado', label: 'Confirmado', color: 'border-t-green-500', headerBg: 'bg-green-500/10', textColor: 'text-green-600' },
  { status: 'completado', label: 'Completado', color: 'border-t-emerald-600', headerBg: 'bg-emerald-600/10', textColor: 'text-emerald-600' },
  { status: 'cancelado', label: 'Cancelado', color: 'border-t-red-500', headerBg: 'bg-red-500/10', textColor: 'text-red-600' },
];

export function TransfersKanban({ requests, onStatusChange, brokers }: TransfersKanbanProps) {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [brokerFilter, setBrokerFilter] = useState<string>('all');

  // Cancel confirmation dialog state
  const [cancelConfirm, setCancelConfirm] = useState<{ id: string; clientName: string; requestNumber: string } | null>(null);

  // Filter requests by broker
  const filteredRequests = useMemo(() => {
    if (brokerFilter === 'all') return requests;
    return requests.filter((r) => r.broker_name === brokerFilter);
  }, [requests, brokerFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const grouped = useMemo(() => {
    const map: Record<TransferRequestStatus, TransferRequest[]> = {
      pendiente: [],
      en_gestion: [],
      presupuesto_enviado: [],
      confirmado: [],
      completado: [],
      cancelado: [],
    };
    for (const req of filteredRequests) {
      if (map[req.status]) {
        map[req.status].push(req);
      }
    }
    // Sort each column by date (most recent first)
    for (const status of Object.keys(map) as TransferRequestStatus[]) {
      map[status].sort((a, b) => {
        // Primary sort: first_transfer_date (nearest date first)
        const dateA = a.first_transfer_date ? new Date(a.first_transfer_date).getTime() : Infinity;
        const dateB = b.first_transfer_date ? new Date(b.first_transfer_date).getTime() : Infinity;
        if (dateA !== dateB) return dateA - dateB;
        // Secondary sort: created_at (most recent first)
        const createdA = new Date(a.created_at).getTime();
        const createdB = new Date(b.created_at).getTime();
        return createdB - createdA;
      });
    }
    return map;
  }, [filteredRequests]);

  // Column totals
  const columnTotals = useMemo(() => {
    const totals: Record<TransferRequestStatus, { count: number; amount: number }> = {
      pendiente: { count: 0, amount: 0 },
      en_gestion: { count: 0, amount: 0 },
      presupuesto_enviado: { count: 0, amount: 0 },
      confirmado: { count: 0, amount: 0 },
      completado: { count: 0, amount: 0 },
      cancelado: { count: 0, amount: 0 },
    };
    for (const req of filteredRequests) {
      if (totals[req.status]) {
        totals[req.status].count += 1;
        totals[req.status].amount += (req.client_total || req.total_amount || 0);
      }
    }
    return totals;
  }, [filteredRequests]);

  const activeRequest = useMemo(() => {
    if (!activeId) return null;
    return requests.find((r) => r.id === activeId) || null;
  }, [activeId, requests]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const requestId = active.id as string;
    const targetStatus = over.id as TransferRequestStatus;

    // Find the request to check its current status
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    // Only update if dropped on a different column
    if (request.status !== targetStatus) {
      // Show confirmation dialog when moving to "cancelado"
      if (targetStatus === 'cancelado') {
        setCancelConfirm({
          id: requestId,
          clientName: request.client_name,
          requestNumber: request.request_number,
        });
      } else {
        onStatusChange({ id: requestId, status: targetStatus });
      }
    }
  }

  function handleConfirmCancel() {
    if (cancelConfirm) {
      onStatusChange({ id: cancelConfirm.id, status: 'cancelado' });
      setCancelConfirm(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Broker filter */}
      {brokers.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={brokerFilter} onValueChange={setBrokerFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Todos los brokers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los brokers</SelectItem>
              {brokers.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {brokerFilter !== 'all' && (
            <span className="text-xs text-muted-foreground">
              {filteredRequests.length} de {requests.length} solicitudes
            </span>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              col={col}
              items={grouped[col.status]}
              totals={columnTotals[col.status]}
              onCardClick={(id) => navigate(`/transfers/${id}`)}
              isDragging={!!activeId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeRequest ? (
            <div className="opacity-90 rotate-2 scale-105">
              <KanbanCardContent request={activeRequest} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelConfirm} onOpenChange={(open) => !open && setCancelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de mover la solicitud <strong>{cancelConfirm?.requestNumber}</strong> de{' '}
              <strong>{cancelConfirm?.clientName}</strong> al estado "Cancelado". Esta acción se puede revertir
              arrastrando la tarjeta a otra columna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sí, cancelar solicitud
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Droppable column
function KanbanColumn({
  col,
  items,
  totals,
  onCardClick,
  isDragging,
}: {
  col: (typeof KANBAN_COLUMNS)[number];
  items: TransferRequest[];
  totals: { count: number; amount: number };
  onCardClick: (id: string) => void;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: col.status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[280px] rounded-xl border border-border/50 border-t-4 ${col.color} bg-card/50 transition-all ${
        isOver && isDragging ? 'ring-2 ring-primary/50 bg-primary/5 scale-[1.01]' : ''
      }`}
    >
      {/* Column header */}
      <div className={`px-3 py-2.5 ${col.headerBg} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{col.label}</span>
          <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center">
            {totals.count}
          </Badge>
        </div>
        {/* Amount total */}
        {totals.amount > 0 && (
          <div className={`text-xs mt-1 font-medium ${col.textColor}`}>
            {totals.amount.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
          </div>
        )}
      </div>

      {/* Column body */}
      <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto min-h-[80px]">
        {items.length === 0 ? (
          <div className={`text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg ${
            isOver && isDragging ? 'border-primary bg-primary/5' : 'border-transparent'
          }`}>
            {isOver && isDragging ? 'Soltar aquí' : 'Sin solicitudes'}
          </div>
        ) : (
          items.map((request) => (
            <DraggableKanbanCard
              key={request.id}
              request={request}
              onClick={() => onCardClick(request.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Draggable card wrapper
function DraggableKanbanCard({ request, onClick }: { request: TransferRequest; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: request.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-30' : ''}`}
    >
      <KanbanCardContent
        request={request}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// Service type badge
function ServiceTypeBadge({ serviceType }: { serviceType: ServiceType }) {
  if (serviceType === 'pack') {
    return (
      <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">
        Pack
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-violet-500/10 text-violet-600 border-violet-500/20">
      P2P
    </Badge>
  );
}

// Card content (shared between real card and drag overlay)
function KanbanCardContent({
  request,
  onClick,
  isDragging,
  dragHandleProps,
}: {
  request: TransferRequest;
  onClick?: () => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const formattedDate = request.first_transfer_date
    ? format(new Date(request.first_transfer_date), "d MMM", { locale: es })
    : null;

  const clientTotal = request.client_total || request.total_amount || 0;
  const itemCount = request.items?.length || request.items_count || 0;

  return (
    <div
      className={`rounded-lg border border-border/40 bg-background p-3 cursor-pointer hover:border-border hover:shadow-sm transition-all space-y-2 ${
        isDragging ? 'shadow-lg border-primary/50' : ''
      }`}
      onClick={onClick}
    >
      {/* Header: drag handle + number + service type badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-mono text-muted-foreground">{request.request_number}</span>
        </div>
        <ServiceTypeBadge serviceType={request.service_type} />
      </div>

      {/* Client name */}
      <div className="font-medium text-sm leading-tight truncate">
        {request.client_name}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {request.broker_name && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {request.broker_name}
          </span>
        )}
        {!request.broker_name && request.created_by && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {request.created_by}
          </span>
        )}
        {formattedDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
        )}
        {itemCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {itemCount}
          </span>
        )}
      </div>

      {/* Price */}
      {clientTotal > 0 && (
        <div className="flex items-center justify-end">
          <span className="text-xs font-semibold text-foreground flex items-center gap-0.5">
            <Euro className="h-3 w-3" />
            {clientTotal.toFixed(2)} €
          </span>
        </div>
      )}
    </div>
  );
}

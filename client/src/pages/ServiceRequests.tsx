import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Car,
  MapPin,
  Calendar,
  User,
  Phone,
  Plane,
  Users,
  AlertCircle,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ServiceRequest {
  id: string;
  requesting_org_id: string;
  requested_by_user_id: string;
  fulfilling_org_id: string;
  request_type: "vehicle" | "transfer";
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  start_date: string;
  end_date: string | null;
  vehicle_category: string | null;
  vehicle_id: string | null;
  passengers: number;
  pickup_location: string | null;
  dropoff_location: string | null;
  flight_number: string | null;
  client_name: string | null;
  client_phone: string | null;
  notes: string | null;
  internal_notes: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  // Enriched fields
  requesting_org_name: string;
  fulfilling_org_name: string;
  requested_by_name: string;
  resolved_by_name: string | null;
  is_incoming: boolean;
}

interface AvailableOrg {
  id: string;
  name: string;
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "Aprobada", icon: CheckCircle2, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rechazada", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  completed: { label: "Completada", icon: CheckCircle2, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  cancelled: { label: "Cancelada", icon: Ban, color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
};

const priorityConfig = {
  low: { label: "Baja", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  urgent: { label: "Urgente", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export default function ServiceRequests() {
  const { session, organization } = useAuth();
  const { hasPermission } = usePermissions();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [availableOrgs, setAvailableOrgs] = useState<AvailableOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [resolveAction, setResolveAction] = useState<"approve" | "reject">("approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    fulfilling_org_id: "",
    request_type: "vehicle" as "vehicle" | "transfer",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    start_date: "",
    end_date: "",
    vehicle_category: "",
    passengers: 1,
    pickup_location: "",
    dropoff_location: "",
    flight_number: "",
    client_name: "",
    client_phone: "",
    notes: "",
  });

  const canCreate = hasPermission("transfers.create");
  const canManage = hasPermission("transfers.manage");

  const fetchRequests = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/list-service-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          direction: activeTab === "all" ? "all" : activeTab,
          status: statusFilter,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setRequests(json.data || []);
      }
    } catch (err) {
      toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, activeTab, statusFilter]);

  const fetchAvailableOrgs = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/get-available-orgs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!json.error) {
        setAvailableOrgs(json.data || []);
      }
    } catch {}
  }, [session?.access_token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchAvailableOrgs();
  }, [fetchAvailableOrgs]);

  const handleCreate = async () => {
    if (!createForm.fulfilling_org_id || !createForm.start_date) {
      toast.error("Organización destino y fecha de inicio son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/create-service-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success("Solicitud creada correctamente");
        setShowCreateDialog(false);
        resetCreateForm();
        fetchRequests();
      }
    } catch {
      toast.error("Error al crear la solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/resolve-service-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          action: resolveAction,
          internal_notes: internalNotes || undefined,
          rejection_reason: resolveAction === "reject" ? rejectionReason : undefined,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success(
          resolveAction === "approve"
            ? "Solicitud aprobada"
            : "Solicitud rechazada"
        );
        setShowResolveDialog(false);
        setSelectedRequest(null);
        setRejectionReason("");
        setInternalNotes("");
        fetchRequests();
      }
    } catch {
      toast.error("Error al resolver la solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      const res = await fetch("/api/cancel-service-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success("Solicitud cancelada");
        fetchRequests();
      }
    } catch {
      toast.error("Error al cancelar la solicitud");
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      fulfilling_org_id: "",
      request_type: "vehicle",
      priority: "normal",
      start_date: "",
      end_date: "",
      vehicle_category: "",
      passengers: 1,
      pickup_location: "",
      dropoff_location: "",
      flight_number: "",
      client_name: "",
      client_phone: "",
      notes: "",
    });
  };

  const openResolveDialog = (request: ServiceRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setResolveAction(action);
    setShowResolveDialog(true);
  };

  const pendingIncoming = requests.filter(
    (r) => r.is_incoming && r.status === "pending"
  ).length;

  return (
    <AppLayout title="Solicitudes de Servicio">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Gestiona solicitudes de vehículos y transfers entre organizaciones
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Button>
        )}
      </div>

      {/* Pending incoming badge */}
      {pendingIncoming > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Tienes {pendingIncoming} solicitud{pendingIncoming > 1 ? "es" : ""} pendiente{pendingIncoming > 1 ? "s" : ""} por resolver
            </span>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="incoming" className="gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Recibidas
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Enviadas
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobadas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
            <SelectItem value="completed">Completadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Request list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Car className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg">No hay solicitudes</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {canCreate
                ? "Crea una nueva solicitud para pedir un vehículo o transfer a otra organización"
                : "No tienes solicitudes de servicio en esta vista"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              canManage={canManage}
              onApprove={() => openResolveDialog(request, "approve")}
              onReject={() => openResolveDialog(request, "reject")}
              onCancel={() => handleCancel(request.id)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Servicio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organización destino *</Label>
                <Select
                  value={createForm.fulfilling_org_id}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, fulfilling_org_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de solicitud *</Label>
                <Select
                  value={createForm.request_type}
                  onValueChange={(v: "vehicle" | "transfer") =>
                    setCreateForm({ ...createForm, request_type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vehicle">Vehículo</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha inicio *</Label>
                <Input
                  type="datetime-local"
                  value={createForm.start_date}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, start_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha fin</Label>
                <Input
                  type="datetime-local"
                  value={createForm.end_date}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, end_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={createForm.priority}
                  onValueChange={(v: "low" | "normal" | "high" | "urgent") =>
                    setCreateForm({ ...createForm, priority: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pasajeros</Label>
                <Input
                  type="number"
                  min={1}
                  value={createForm.passengers}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      passengers: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>

            {createForm.request_type === "vehicle" && (
              <div className="space-y-2">
                <Label>Categoría de vehículo</Label>
                <Input
                  placeholder="Ej: SUV, Sedan, Van..."
                  value={createForm.vehicle_category}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, vehicle_category: e.target.value })
                  }
                />
              </div>
            )}

            {createForm.request_type === "transfer" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Punto de recogida</Label>
                    <Input
                      placeholder="Dirección o lugar"
                      value={createForm.pickup_location}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          pickup_location: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Punto de destino</Label>
                    <Input
                      placeholder="Dirección o lugar"
                      value={createForm.dropoff_location}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          dropoff_location: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Número de vuelo</Label>
                  <Input
                    placeholder="Ej: IB3456"
                    value={createForm.flight_number}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, flight_number: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del cliente</Label>
                <Input
                  placeholder="Nombre completo"
                  value={createForm.client_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, client_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono del cliente</Label>
                <Input
                  placeholder="+34 600 000 000"
                  value={createForm.client_phone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, client_phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Información adicional..."
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm({ ...createForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creando..." : "Crear Solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === "approve"
                ? "Aprobar Solicitud"
                : "Rechazar Solicitud"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedRequest && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p>
                  <strong>Tipo:</strong>{" "}
                  {selectedRequest.request_type === "vehicle"
                    ? "Vehículo"
                    : "Transfer"}
                </p>
                <p>
                  <strong>De:</strong> {selectedRequest.requesting_org_name}
                </p>
                <p>
                  <strong>Fecha:</strong>{" "}
                  {format(new Date(selectedRequest.start_date), "dd MMM yyyy HH:mm", {
                    locale: es,
                  })}
                </p>
                {selectedRequest.client_name && (
                  <p>
                    <strong>Cliente:</strong> {selectedRequest.client_name}
                  </p>
                )}
              </div>
            )}

            {resolveAction === "reject" && (
              <div className="space-y-2">
                <Label>Motivo del rechazo</Label>
                <Textarea
                  placeholder="Explica por qué se rechaza..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas internas (opcional)</Label>
              <Textarea
                placeholder="Notas visibles solo para tu organización..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResolveDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResolve}
              disabled={submitting}
              variant={resolveAction === "reject" ? "destructive" : "default"}
            >
              {submitting
                ? "Procesando..."
                : resolveAction === "approve"
                ? "Aprobar"
                : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}

// ─── Request Card Component ─────────────────────────────────────────────────

function RequestCard({
  request,
  canManage,
  onApprove,
  onReject,
  onCancel,
}: {
  request: ServiceRequest;
  canManage: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const status = statusConfig[request.status];
  const priority = priorityConfig[request.priority];
  const StatusIcon = status.icon;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Direction indicator */}
              {request.is_incoming ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <ArrowDownLeft className="h-3 w-3" />
                  De {request.requesting_org_name}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs">
                  <ArrowUpRight className="h-3 w-3" />
                  A {request.fulfilling_org_name}
                </Badge>
              )}

              {/* Type */}
              <Badge variant="secondary" className="gap-1 text-xs">
                {request.request_type === "vehicle" ? (
                  <Car className="h-3 w-3" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                {request.request_type === "vehicle" ? "Vehículo" : "Transfer"}
              </Badge>

              {/* Priority */}
              {request.priority !== "normal" && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}
                >
                  {priority.label}
                </span>
              )}

              {/* Status */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.color}`}
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
            </div>

            {/* Details row */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(request.start_date), "dd MMM yyyy HH:mm", {
                  locale: es,
                })}
              </span>
              {request.client_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {request.client_name}
                </span>
              )}
              {request.client_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {request.client_phone}
                </span>
              )}
              {request.passengers > 1 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {request.passengers} pax
                </span>
              )}
              {request.flight_number && (
                <span className="flex items-center gap-1">
                  <Plane className="h-3.5 w-3.5" />
                  {request.flight_number}
                </span>
              )}
            </div>

            {/* Locations for transfers */}
            {request.request_type === "transfer" &&
              (request.pickup_location || request.dropoff_location) && (
                <p className="text-sm text-muted-foreground">
                  {request.pickup_location} → {request.dropoff_location}
                </p>
              )}

            {/* Notes */}
            {request.notes && (
              <p className="text-sm text-muted-foreground italic truncate">
                {request.notes}
              </p>
            )}

            {/* Rejection reason */}
            {request.status === "rejected" && request.rejection_reason && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Motivo: {request.rejection_reason}
              </p>
            )}

            {/* Meta */}
            <p className="text-xs text-muted-foreground">
              Solicitado por {request.requested_by_name} ·{" "}
              {format(new Date(request.created_at), "dd/MM/yyyy HH:mm")}
              {request.resolved_by_name && (
                <> · Resuelto por {request.resolved_by_name}</>
              )}
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Incoming + pending = can approve/reject */}
            {request.is_incoming &&
              request.status === "pending" &&
              canManage && (
                <>
                  <Button size="sm" onClick={onApprove}>
                    Aprobar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={onReject}>
                    Rechazar
                  </Button>
                </>
              )}

            {/* Outgoing + pending = can cancel */}
            {!request.is_incoming && request.status === "pending" && (
              <Button size="sm" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

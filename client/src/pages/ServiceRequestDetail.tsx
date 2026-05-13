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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
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
  Eye,
  FileText,
  Mail,
  Home,
  Loader2,
  PlayCircle,
  ArrowRight,
  Download,
  Upload,
  History,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { AZUL_CARS_ORG_ID } from "@shared/const";

interface ServiceRequestDetail {
  id: string;
  requesting_org_id: string;
  requested_by_user_id: string;
  fulfilling_org_id: string;
  request_type: "vehicle" | "transfer";
  status: string;
  priority: string;
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
  client_email: string | null;
  client_address: string | null;
  passport_url: string | null;
  driving_license_url: string | null;
  notes: string | null;
  internal_notes: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  requesting_org_name: string;
  fulfilling_org_name: string;
  requested_by_name: string;
  resolved_by_name: string | null;
  is_incoming: boolean;
  vehicle_info: { id: string; matricula: string; modelo: string } | null;
}

interface StatusHistoryEntry {
  id: string;
  request_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_user_id: string;
  changed_by_name: string | null;
  notes: string | null;
  created_at: string;
}

interface AvailableVehicle {
  id: string;
  matricula: string;
  modelo: string;
  status: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  pending: { label: "Pendiente", icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  in_progress: { label: "En gestión", icon: PlayCircle, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  vehicle_assigned: { label: "Vehículo asignado", icon: Car, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  approved: { label: "Aprobada", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completada", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  rejected: { label: "Rechazada", icon: XCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
  cancelled: { label: "Cancelada", icon: Ban, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
};

const statusSteps = ["pending", "in_progress", "vehicle_assigned", "completed"];

export default function ServiceRequestDetailPage() {
  const { session, organization } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableVehicles, setAvailableVehicles] = useState<AvailableVehicle[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const canManage = hasPermission("transfers.manage");
  const isAzulCars = organization?.id === AZUL_CARS_ORG_ID;
  const isFulfiller = request?.is_incoming ?? false;
  const canPerformActions = canManage && isFulfiller;

  const fetchDetail = useCallback(async () => {
    if (!session?.access_token || !requestId) return;
    try {
      const res = await fetch("/api/get-service-request-detail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        navigate("/service-requests");
      } else {
        setRequest(json.data);
      }
    } catch {
      toast.error("Error al cargar la solicitud");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, requestId, navigate]);

  const fetchHistory = useCallback(async () => {
    if (!session?.access_token || !requestId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/get-service-request-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      const json = await res.json();
      if (!json.error) {
        setStatusHistory(json.data || []);
      }
    } catch {
      // Silently fail for history
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.access_token, requestId]);

  const fetchAvailableVehicles = useCallback(async () => {
    if (!session?.access_token || !isAzulCars) return;
    try {
      const res = await fetch("/api/get-available-vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!json.error) {
        setAvailableVehicles(json.data || []);
      }
    } catch {}
  }, [session?.access_token, isAzulCars]);

  useEffect(() => {
    fetchDetail();
    fetchHistory();
  }, [fetchDetail, fetchHistory]);

  useEffect(() => {
    fetchAvailableVehicles();
  }, [fetchAvailableVehicles]);

  const updateStatus = async (
    newStatus: string,
    extra?: { rejection_reason?: string; internal_notes?: string; vehicle_id?: string }
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/update-service-request-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          request_id: requestId,
          status: newStatus,
          ...extra,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success(`Estado actualizado a "${statusConfig[newStatus]?.label || newStatus}"`);
        fetchDetail();
        fetchHistory();
      }
    } catch {
      toast.error("Error al actualizar el estado");
    } finally {
      setActionLoading(false);
      setShowRejectDialog(false);
      setShowAssignDialog(false);
    }
  };

  const handleDocUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: "passport" | "driving_license"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !request) return;
    setUploadingDoc(docType);
    try {
      let uploadFile: File = file;
      if (file.type.startsWith("image/")) {
        const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.85 });
        uploadFile = compressed.file;
      }
      const ext = uploadFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const storagePath = `${organization?.id}/${docType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("service-request-docs")
        .upload(storagePath, uploadFile, { upsert: true });

      if (uploadError) {
        toast.error(`Error al subir ${file.name}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("service-request-docs")
        .getPublicUrl(storagePath);

      // Update the request with the doc URL
      const res = await fetch("/api/upload-service-request-doc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          request_id: request.id,
          doc_type: docType,
          file_url: urlData.publicUrl,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success("Documento subido correctamente");
        fetchDetail();
      }
    } catch {
      toast.error("Error al subir el documento");
    } finally {
      setUploadingDoc(null);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Solicitud de Servicio">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <Card className="animate-pulse"><CardContent className="h-64" /></Card>
        </div>
      </AppLayout>
    );
  }

  if (!request) {
    return (
      <AppLayout title="Solicitud no encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground">La solicitud no existe o no tienes acceso.</p>
          <Button className="mt-4" onClick={() => navigate("/service-requests")}>
            Volver a solicitudes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const currentStatus = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;
  const currentStepIndex = statusSteps.indexOf(request.status);
  const isTerminal = ["completed", "approved", "rejected", "cancelled"].includes(request.status);

  return (
    <AppLayout title="Detalle de Solicitud">
    <div className="space-y-6 max-w-4xl">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/service-requests")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver a solicitudes
      </Button>

      {/* Header with status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            {request.request_type === "vehicle" ? (
              <Car className="h-6 w-6" />
            ) : (
              <MapPin className="h-6 w-6" />
            )}
            Solicitud de {request.request_type === "vehicle" ? "Vehículo" : "Transfer"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {request.requesting_org_name} → {request.fulfilling_org_name}
          </p>
        </div>
        <Badge className={`${currentStatus.bgColor} ${currentStatus.color} gap-1.5 px-3 py-1.5 text-sm`}>
          <StatusIcon className="h-4 w-4" />
          {currentStatus.label}
        </Badge>
      </div>

      {/* Status Progress Bar */}
      {!isTerminal && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              {statusSteps.map((step, idx) => {
                const stepConf = statusConfig[step];
                const StepIcon = stepConf.icon;
                const isActive = idx <= currentStepIndex;
                const isCurrent = step === request.status;
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className={`flex flex-col items-center ${isCurrent ? "scale-110" : ""}`}>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isActive
                            ? `${stepConf.bgColor} ${stepConf.color}`
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <StepIcon className="h-5 w-5" />
                      </div>
                      <span className={`text-xs mt-1.5 font-medium ${isActive ? "" : "text-muted-foreground"}`}>
                        {stepConf.label}
                      </span>
                    </div>
                    {idx < statusSteps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${idx < currentStepIndex ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejection/Cancellation reason */}
      {request.status === "rejected" && request.rejection_reason && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="py-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Solicitud rechazada</p>
              <p className="text-sm text-muted-foreground mt-1">{request.rejection_reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de la solicitud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField icon={Calendar} label="Fecha inicio" value={format(new Date(request.start_date), "dd MMM yyyy HH:mm", { locale: es })} />
                {request.end_date && (
                  <InfoField icon={Calendar} label="Fecha fin" value={format(new Date(request.end_date), "dd MMM yyyy HH:mm", { locale: es })} />
                )}
                <InfoField icon={Users} label="Pasajeros" value={String(request.passengers)} />
                {request.vehicle_category && (
                  <InfoField icon={Car} label="Categoría vehículo" value={request.vehicle_category} />
                )}
                {request.pickup_location && (
                  <InfoField icon={MapPin} label="Recogida" value={request.pickup_location} />
                )}
                {request.dropoff_location && (
                  <InfoField icon={MapPin} label="Destino" value={request.dropoff_location} />
                )}
                {request.flight_number && (
                  <InfoField icon={Plane} label="Vuelo" value={request.flight_number} />
                )}
              </div>
              {request.notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Notas</p>
                  <p className="text-sm">{request.notes}</p>
                </div>
              )}
              {request.internal_notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Notas internas</p>
                  <p className="text-sm">{request.internal_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Datos del cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {request.client_name && (
                  <InfoField icon={User} label="Nombre" value={request.client_name} />
                )}
                {request.client_phone && (
                  <InfoField icon={Phone} label="Teléfono" value={request.client_phone} />
                )}
                {request.client_email && (
                  <InfoField icon={Mail} label="Email" value={request.client_email} />
                )}
                {request.client_address && (
                  <InfoField icon={Home} label="Dirección domicilio" value={request.client_address} />
                )}
              </div>

              {/* Documents */}
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <DocumentField
                    label="Pasaporte / ID"
                    url={request.passport_url}
                    docType="passport"
                    uploading={uploadingDoc === "passport"}
                    onUpload={(e) => handleDocUpload(e, "passport")}
                  />
                  <DocumentField
                    label="Permiso de conducir"
                    url={request.driving_license_url}
                    docType="driving_license"
                    uploading={uploadingDoc === "driving_license"}
                    onUpload={(e) => handleDocUpload(e, "driving_license")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned vehicle */}
          {request.vehicle_info && (
            <Card className="border-indigo-200 dark:border-indigo-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="h-5 w-5 text-indigo-600" />
                  Vehículo asignado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Car className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">{request.vehicle_info.matricula}</p>
                    <p className="text-sm text-muted-foreground">{request.vehicle_info.modelo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Status History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de cambios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : statusHistory.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay historial todavía</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-4">
                    {statusHistory.map((entry) => {
                      const toConf = statusConfig[entry.to_status];
                      const fromConf = entry.from_status ? statusConfig[entry.from_status] : null;
                      const ToIcon = toConf?.icon || Clock;
                      const dotColor = toConf?.color || "text-muted-foreground";

                      return (
                        <div key={entry.id} className="relative flex gap-4 pl-8">
                          {/* Timeline dot */}
                          <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-background ${toConf?.bgColor || 'bg-muted'}`} />

                          <div className="flex-1 min-w-0 pb-3">
                            {/* Status transition */}
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              <ToIcon className={`h-4 w-4 ${dotColor} shrink-0`} />
                              {entry.from_status ? (
                                <>
                                  <span className="text-muted-foreground">
                                    {fromConf?.label || entry.from_status}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-medium">
                                    {toConf?.label || entry.to_status}
                                  </span>
                                </>
                              ) : (
                                <span className="font-medium">
                                  {toConf?.label || entry.to_status}
                                </span>
                              )}
                            </div>

                            {/* Notes */}
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {entry.notes}
                              </p>
                            )}

                            {/* User and time */}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{entry.changed_by_name || "Usuario"}</span>
                              <span>&middot;</span>
                              <span>
                                {format(new Date(entry.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Actions + Meta */}
        <div className="space-y-6">
          {/* Actions */}
          {canPerformActions && !isTerminal && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Next step action */}
                {request.status === "pending" && (
                  <Button
                    className="w-full"
                    onClick={() => updateStatus("in_progress")}
                    disabled={actionLoading}
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Iniciar gestión
                  </Button>
                )}

                {request.status === "in_progress" && (
                  <Button
                    className="w-full"
                    onClick={() => setShowAssignDialog(true)}
                    disabled={actionLoading}
                  >
                    <Car className="h-4 w-4 mr-2" />
                    Asignar vehículo
                  </Button>
                )}

                {request.status === "vehicle_assigned" && (
                  <Button
                    className="w-full"
                    onClick={() => updateStatus("completed")}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marcar completada
                  </Button>
                )}

                {/* Reject */}
                {["pending", "in_progress"].includes(request.status) && (
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                )}

                {/* Cancel */}
                {["pending", "in_progress", "vehicle_assigned"].includes(request.status) && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => updateStatus("cancelled")}
                    disabled={actionLoading}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancelar solicitud
                  </Button>
                )}

                {/* Internal notes */}
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs">Notas internas</Label>
                  <Textarea
                    placeholder="Añadir notas internas..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!internalNotes.trim() || actionLoading}
                    onClick={() => {
                      // Save notes by updating to same status
                      updateStatus(request.status as any, { internal_notes: internalNotes });
                      setInternalNotes("");
                    }}
                  >
                    Guardar notas
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Requester cancel action */}
          {!isFulfiller && ["pending", "in_progress"].includes(request.status) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700"
                  onClick={() => updateStatus("cancelled")}
                  disabled={actionLoading}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Cancelar solicitud
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Meta info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Solicitado por</span>
                <span className="font-medium">{request.requested_by_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organización</span>
                <span className="font-medium">{request.requesting_org_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creado</span>
                <span>{format(new Date(request.created_at), "dd/MM/yyyy HH:mm")}</span>
              </div>
              {request.resolved_by_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resuelto por</span>
                  <span className="font-medium">{request.resolved_by_name}</span>
                </div>
              )}
              {request.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha resolución</span>
                  <span>{format(new Date(request.resolved_at), "dd/MM/yyyy HH:mm")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs">{request.id.slice(0, 8)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo del rechazo *</Label>
              <Textarea
                placeholder="Explica por qué se rechaza esta solicitud..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || actionLoading}
              onClick={() =>
                updateStatus("rejected", { rejection_reason: rejectionReason })
              }
            >
              {actionLoading ? "Rechazando..." : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Vehicle Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar vehículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {request.vehicle_category && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">
                  Categoría solicitada: <strong>{request.vehicle_category}</strong>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Seleccionar vehículo *</Label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vehículo..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.matricula} — {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableVehicles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay vehículos disponibles en este momento.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!selectedVehicleId || actionLoading}
              onClick={() =>
                updateStatus("vehicle_assigned", { vehicle_id: selectedVehicleId })
              }
            >
              {actionLoading ? "Asignando..." : "Asignar vehículo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function InfoField({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function DocumentField({
  label,
  url,
  docType,
  uploading,
  onUpload,
}: {
  label: string;
  url: string | null;
  docType: string;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      {url ? (
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Eye className="h-4 w-4" />
            Ver documento
          </a>
          <a
            href={url}
            download
            className="text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={onUpload}
            className="hidden"
            id={`upload-${docType}`}
            disabled={uploading}
          />
          <label
            htmlFor={`upload-${docType}`}
            className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer text-sm text-muted-foreground hover:border-primary/50 transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Subiendo..." : "Subir documento"}
          </label>
        </div>
      )}
    </div>
  );
}

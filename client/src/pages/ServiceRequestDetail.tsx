import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Building2,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  Shield,
  CreditCard,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate, useParams } from "react-router-dom";
import { compressImage } from "@/lib/imageCompression";
import { AZUL_CARS_ORG_ID } from "@shared/const";
import { motion } from "framer-motion";

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Status Config ──────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; icon: any; color: string; bgClass: string }> = {
  pending: { label: "Pendiente", icon: Clock, color: "#eab308", bgClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  in_progress: { label: "En gestión", icon: PlayCircle, color: "#3b82f6", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  vehicle_assigned: { label: "Vehículo asignado", icon: Car, color: "#6366f1", bgClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  approved: { label: "Aprobada", icon: CheckCircle2, color: "#22c55e", bgClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  completed: { label: "Completada", icon: CheckCircle2, color: "#22c55e", bgClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  rejected: { label: "Rechazada", icon: XCircle, color: "#ef4444", bgClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  cancelled: { label: "Cancelada", icon: Ban, color: "#6b7280", bgClass: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300" },
};

const statusSteps = ["pending", "in_progress", "vehicle_assigned", "completed"];

// ─── Helper Components ──────────────────────────────────────────────────────

function DetailRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 px-1 ${!last ? "border-b border-border/50" : ""}`}>
      <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-medium text-foreground text-right max-w-[200px] truncate">{value}</span>
    </div>
  );
}

function SectionCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl bg-card border border-border/50 shadow-sm p-4"
    >
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

function DocCard({ label, url, docType, uploading, onUpload }: {
  label: string;
  url: string | null;
  docType: string;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 p-3">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      {url ? (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver documento
            </a>
          </div>
          <a href={url} download className="text-muted-foreground hover:text-foreground p-1">
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
            className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-lg cursor-pointer text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors"
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

// ─── Main Component ─────────────────────────────────────────────────────────

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

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchDetail = useCallback(async () => {
    if (!session?.access_token || !requestId) return;
    try {
      const res = await fetch("/api/get-service-request-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ request_id: requestId }),
      });
      const json = await res.json();
      if (!json.error) setStatusHistory(json.data || []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, [session?.access_token, requestId]);

  const fetchAvailableVehicles = useCallback(async () => {
    if (!session?.access_token || !isAzulCars) return;
    try {
      const res = await fetch("/api/get-available-vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!json.error) setAvailableVehicles(json.data || []);
    } catch {}
  }, [session?.access_token, isAzulCars]);

  useEffect(() => { fetchDetail(); fetchHistory(); }, [fetchDetail, fetchHistory]);
  useEffect(() => { fetchAvailableVehicles(); }, [fetchAvailableVehicles]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const updateStatus = async (
    newStatus: string,
    extra?: { rejection_reason?: string; internal_notes?: string; vehicle_id?: string }
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/update-service-request-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ request_id: requestId, status: newStatus, ...extra }),
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

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: "passport" | "driving_license") => {
    const file = e.target.files?.[0];
    if (!file || !request) return;
    setUploadingDoc(docType);
    try {
      let uploadFile: File = file;
      if (file.type.startsWith("image/")) {
        const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.85 });
        uploadFile = compressed.file;
      }

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("request_id", request.id);
      formData.append("doc_type", docType);

      const res = await fetch("/api/upload-service-request-doc", {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}` },
        body: formData,
      });
      const json = await res.json();
      if (json.error) toast.error(json.error);
      else { toast.success("Documento subido"); fetchDetail(); }
    } catch {
      toast.error("Error al subir el documento");
    } finally {
      setUploadingDoc(null);
      // Reset the input so the same file can be re-selected
      e.target.value = "";
    }
  };

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout title="Solicitud de Servicio">
        <div className="max-w-2xl mx-auto space-y-5 pb-8">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <div className="text-center py-4 space-y-3">
            <Skeleton className="h-16 w-16 mx-auto rounded-full" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-6 w-24 mx-auto rounded-full" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 p-4 space-y-1">
              <Skeleton className="h-3 w-20 mb-3" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <Skeleton className="h-4 flex-1 max-w-[100px]" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </AppLayout>
    );
  }

  // ─── Not Found ──────────────────────────────────────────────────────────

  if (!request) {
    return (
      <AppLayout title="Solicitud no encontrada">
        <div className="container max-w-lg py-16">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FileText className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Solicitud no disponible</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Esta solicitud no existe o no tienes acceso para verla.
              </p>
            </div>
            <Button onClick={() => navigate("/service-requests")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a solicitudes
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Computed Values ────────────────────────────────────────────────────

  const currentStatus = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;
  const currentStepIndex = statusSteps.indexOf(request.status);
  const isTerminal = ["completed", "approved", "rejected", "cancelled"].includes(request.status);
  const isVehicle = request.request_type === "vehicle";

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <AppLayout title={`Solicitud ${isVehicle ? "Vehículo" : "Transfer"}`}>
      <div className="max-w-2xl mx-auto space-y-5 pb-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/service-requests")} className="rounded-xl -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Solicitudes
        </Button>

        {/* Hero Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4`}
            style={{ backgroundColor: `${currentStatus.color}15` }}>
            {isVehicle ? (
              <Car className="h-8 w-8" style={{ color: currentStatus.color }} />
            ) : (
              <MapPin className="h-8 w-8" style={{ color: currentStatus.color }} />
            )}
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Solicitud de {isVehicle ? "Vehículo" : "Transfer"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {request.requesting_org_name} → {request.fulfilling_org_name}
          </p>
          <Badge
            variant="outline"
            className="mt-3 rounded-full px-4 py-1 text-xs font-medium border-0"
            style={{ backgroundColor: `${currentStatus.color}15`, color: currentStatus.color }}
          >
            <StatusIcon className="h-3.5 w-3.5 mr-1" />
            {currentStatus.label}
          </Badge>
        </motion.div>

        {/* Status Progress Steps */}
        {!isTerminal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
            className="rounded-2xl bg-card border border-border/50 shadow-sm p-4"
          >
            <div className="flex items-center justify-between">
              {statusSteps.map((step, idx) => {
                const stepConf = statusConfig[step];
                const StepIcon = stepConf.icon;
                const isActive = idx <= currentStepIndex;
                const isCurrent = step === request.status;
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className={`flex flex-col items-center ${isCurrent ? "scale-110" : ""} transition-transform`}>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={isActive ? { backgroundColor: `${stepConf.color}15`, color: stepConf.color } : undefined}
                      >
                        <StepIcon className={`h-4.5 w-4.5 ${!isActive ? "text-muted-foreground/40" : ""}`} />
                      </div>
                      <span className={`text-[10px] mt-1 font-medium text-center leading-tight ${isActive ? "" : "text-muted-foreground/50"}`}>
                        {stepConf.label}
                      </span>
                    </div>
                    {idx < statusSteps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1.5 rounded-full ${idx < currentStepIndex ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Rejection/Cancellation Banner */}
        {request.status === "rejected" && request.rejection_reason && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Solicitud rechazada</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{request.rejection_reason}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Action Banner (Primary CTA) ── */}
        {canPerformActions && !isTerminal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="space-y-2"
          >
            {request.status === "pending" && (
              <Button
                className="w-full rounded-2xl h-12 text-base"
                onClick={() => updateStatus("in_progress")}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlayCircle className="h-5 w-5 mr-2" />}
                Iniciar gestión
              </Button>
            )}
            {request.status === "in_progress" && (
              <Button
                className="w-full rounded-2xl h-12 text-base"
                onClick={() => setShowAssignDialog(true)}
                disabled={actionLoading}
              >
                <Car className="h-5 w-5 mr-2" />
                Asignar vehículo
              </Button>
            )}
            {request.status === "vehicle_assigned" && (
              <Button
                className="w-full rounded-2xl h-12 text-base"
                onClick={() => updateStatus("completed")}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                Marcar completada
              </Button>
            )}
            <div className="flex gap-2">
              {["pending", "in_progress"].includes(request.status) && (
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl h-10 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800/50"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={actionLoading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
              )}
              {["pending", "in_progress", "vehicle_assigned"].includes(request.status) && (
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl h-10 text-muted-foreground"
                  onClick={() => updateStatus("cancelled")}
                  disabled={actionLoading}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Requester cancel action */}
        {!isFulfiller && ["pending", "in_progress"].includes(request.status) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <Button
              variant="outline"
              className="w-full rounded-2xl h-10 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800/50"
              onClick={() => updateStatus("cancelled")}
              disabled={actionLoading}
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancelar solicitud
            </Button>
          </motion.div>
        )}

        {/* ── Assigned Vehicle ── */}
        {request.vehicle_info && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <Car className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 font-medium uppercase tracking-wider">Vehículo asignado</p>
                <p className="text-lg font-mono font-bold text-indigo-900 dark:text-indigo-200 tracking-wider">{request.vehicle_info.matricula}</p>
                <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80">{request.vehicle_info.modelo}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-indigo-400/50" />
            </div>
          </motion.div>
        )}

        {/* ── Request Details ── */}
        <SectionCard title="Detalles de la solicitud" delay={0.06}>
          <DetailRow icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Fecha inicio"
            value={format(new Date(request.start_date), "dd MMM yyyy · HH:mm", { locale: es })} />
          {request.end_date && (
            <DetailRow icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Fecha fin"
              value={format(new Date(request.end_date), "dd MMM yyyy · HH:mm", { locale: es })} />
          )}
          <DetailRow icon={<Users className="h-4 w-4 text-muted-foreground" />} label="Pasajeros"
            value={String(request.passengers)} />
          {request.vehicle_category && (
            <DetailRow icon={<Car className="h-4 w-4 text-muted-foreground" />} label="Categoría vehículo"
              value={request.vehicle_category} />
          )}
          {request.pickup_location && (
            <DetailRow icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="Punto de recogida"
              value={request.pickup_location} />
          )}
          {request.dropoff_location && (
            <DetailRow icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="Destino"
              value={request.dropoff_location} />
          )}
          {request.flight_number && (
            <DetailRow icon={<Plane className="h-4 w-4 text-muted-foreground" />} label="Nº Vuelo"
              value={request.flight_number} last />
          )}
          {!request.flight_number && (
            <div /> // ensures last row gets border
          )}
          {request.notes && (
            <div className="pt-3 px-1">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm text-foreground">{request.notes}</p>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Client Info ── */}
        <SectionCard title="Datos del cliente" delay={0.08}>
          {request.client_name && (
            <DetailRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="Nombre"
              value={request.client_name} />
          )}
          {request.client_phone && (
            <DetailRow icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="Teléfono"
              value={request.client_phone} />
          )}
          {request.client_email && (
            <DetailRow icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email"
              value={request.client_email} />
          )}
          {request.client_address && (
            <DetailRow icon={<Home className="h-4 w-4 text-muted-foreground" />} label="Dirección domicilio"
              value={request.client_address} last />
          )}
          {!request.client_name && !request.client_phone && !request.client_email && !request.client_address && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Sin datos del cliente</p>
            </div>
          )}
        </SectionCard>

        {/* ── Documents ── */}
        <SectionCard title="Documentos" delay={0.1}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DocCard
              label="Pasaporte / ID"
              url={request.passport_url}
              docType="passport"
              uploading={uploadingDoc === "passport"}
              onUpload={(e) => handleDocUpload(e, "passport")}
            />
            <DocCard
              label="Permiso de conducir"
              url={request.driving_license_url}
              docType="driving_license"
              uploading={uploadingDoc === "driving_license"}
              onUpload={(e) => handleDocUpload(e, "driving_license")}
            />
          </div>
        </SectionCard>

        {/* ── Internal Notes (for fulfiller) ── */}
        {canPerformActions && !isTerminal && (
          <SectionCard title="Notas internas" delay={0.12}>
            {request.internal_notes && (
              <div className="rounded-lg bg-muted/30 p-3 mb-3">
                <p className="text-sm text-foreground">{request.internal_notes}</p>
              </div>
            )}
            <div className="space-y-2">
              <Textarea
                placeholder="Añadir notas internas..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
                className="rounded-xl"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-xl"
                disabled={!internalNotes.trim() || actionLoading}
                onClick={() => {
                  updateStatus(request.status as any, { internal_notes: internalNotes });
                  setInternalNotes("");
                }}
              >
                Guardar notas
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Show internal notes read-only if terminal or not fulfiller */}
        {request.internal_notes && (!canPerformActions || isTerminal) && (
          <SectionCard title="Notas internas" delay={0.12}>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-sm text-foreground">{request.internal_notes}</p>
            </div>
          </SectionCard>
        )}

        {/* ── Status History ── */}
        <SectionCard title="Historial de cambios" delay={0.14}>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex gap-3 py-2">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : statusHistory.length === 0 ? (
            <div className="text-center py-6">
              <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hay historial todavía</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />
              <div className="space-y-1">
                {statusHistory.map((entry, idx) => {
                  const toConf = statusConfig[entry.to_status];
                  const fromConf = entry.from_status ? statusConfig[entry.from_status] : null;
                  const ToIcon = toConf?.icon || Clock;
                  const isLast = idx === statusHistory.length - 1;

                  return (
                    <div key={entry.id} className="relative flex gap-3 py-2 pl-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10"
                        style={{ backgroundColor: `${toConf?.color || '#6b7280'}15` }}
                      >
                        <ToIcon className="h-4 w-4" style={{ color: toConf?.color || '#6b7280' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-sm flex-wrap">
                          {entry.from_status ? (
                            <>
                              <span className="text-muted-foreground">{fromConf?.label || entry.from_status}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                              <span className="font-medium">{toConf?.label || entry.to_status}</span>
                            </>
                          ) : (
                            <span className="font-medium">{toConf?.label || entry.to_status}</span>
                          )}
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {entry.changed_by_name || "Usuario"} · {format(new Date(entry.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Meta Info ── */}
        <SectionCard title="Información" delay={0.16}>
          <DetailRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="Solicitado por"
            value={request.requested_by_name} />
          <DetailRow icon={<Building2 className="h-4 w-4 text-muted-foreground" />} label="Organización origen"
            value={request.requesting_org_name} />
          <DetailRow icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Fecha creación"
            value={format(new Date(request.created_at), "dd/MM/yyyy · HH:mm")} />
          {request.resolved_by_name && (
            <DetailRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="Resuelto por"
              value={request.resolved_by_name} />
          )}
          {request.resolved_at && (
            <DetailRow icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Fecha resolución"
              value={format(new Date(request.resolved_at), "dd/MM/yyyy · HH:mm")} />
          )}
          <DetailRow icon={<FileText className="h-4 w-4 text-muted-foreground" />} label="ID"
            value={request.id.slice(0, 8)} last />
        </SectionCard>
      </div>

      {/* ── Reject Dialog ── */}
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
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || actionLoading}
              onClick={() => updateStatus("rejected", { rejection_reason: rejectionReason })}
            >
              {actionLoading ? "Rechazando..." : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Vehicle Dialog ── */}
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
                <p className="text-xs text-muted-foreground">No hay vehículos disponibles en este momento.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancelar</Button>
            <Button
              disabled={!selectedVehicleId || actionLoading}
              onClick={() => updateStatus("vehicle_assigned", { vehicle_id: selectedVehicleId })}
            >
              {actionLoading ? "Asignando..." : "Asignar vehículo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Eye,
  Upload,
  FileText,
  Mail,
  Home,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "wouter";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";

interface ServiceRequest {
  id: string;
  requesting_org_id: string;
  requested_by_user_id: string;
  fulfilling_org_id: string;
  request_type: "vehicle" | "transfer";
  status: "pending" | "in_progress" | "vehicle_assigned" | "approved" | "rejected" | "completed" | "cancelled";
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
  // Enriched fields
  requesting_org_name: string;
  fulfilling_org_name: string;
  requested_by_name: string;
  resolved_by_name: string | null;
  is_incoming: boolean;
}

interface VehicleModel {
  label: string;
  marca: string;
  modelo: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  in_progress: { label: "En gestión", icon: PlayCircle, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  vehicle_assigned: { label: "Vehículo asignado", icon: Car, color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
  approved: { label: "Aprobada", icon: CheckCircle2, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  completed: { label: "Completada", icon: CheckCircle2, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rechazada", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  cancelled: { label: "Cancelada", icon: Ban, color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
};

export default function ServiceRequests() {
  const { session, organization } = useAuth();
  const { hasPermission } = usePermissions();
  const [, setLocation] = useLocation();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPassport, setUploadingPassport] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    request_type: "vehicle" as "vehicle" | "transfer",
    start_date: "",
    end_date: "",
    vehicle_category: "",
    passengers: 1,
    pickup_location: "",
    dropoff_location: "",
    flight_number: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    client_address: "",
    notes: "",
    passport_url: "",
    driving_license_url: "",
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
    } catch {
      toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, activeTab, statusFilter]);

  const fetchVehicleModels = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/get-vehicle-models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!json.error) {
        setVehicleModels(json.data || []);
      }
    } catch {}
  }, [session?.access_token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchVehicleModels();
  }, [fetchVehicleModels]);

  const handleFileUpload = async (
    file: File,
    docType: "passport" | "driving_license"
  ): Promise<string | null> => {
    try {
      let uploadFile: File = file;
      // Compress images
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
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("service-request-docs")
        .getPublicUrl(storagePath);

      return urlData.publicUrl;
    } catch {
      toast.error("Error al subir archivo");
      return null;
    }
  };

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPassport(true);
    const url = await handleFileUpload(file, "passport");
    if (url) {
      setCreateForm((f) => ({ ...f, passport_url: url }));
      toast.success("Pasaporte/ID subido");
    }
    setUploadingPassport(false);
  };

  const handleLicenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLicense(true);
    const url = await handleFileUpload(file, "driving_license");
    if (url) {
      setCreateForm((f) => ({ ...f, driving_license_url: url }));
      toast.success("Permiso de conducir subido");
    }
    setUploadingLicense(false);
  };

  const handleCreate = async () => {
    if (!createForm.start_date) {
      toast.error("La fecha de inicio es obligatoria");
      return;
    }
    if (!createForm.client_name) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        request_type: createForm.request_type,
        start_date: createForm.start_date,
        end_date: createForm.end_date || undefined,
        vehicle_category: createForm.vehicle_category || undefined,
        passengers: createForm.passengers,
        pickup_location: createForm.pickup_location || undefined,
        dropoff_location: createForm.dropoff_location || undefined,
        flight_number: createForm.flight_number || undefined,
        client_name: createForm.client_name,
        client_phone: createForm.client_phone || undefined,
        client_email: createForm.client_email || undefined,
        client_address: createForm.request_type === "vehicle" ? (createForm.client_address || undefined) : undefined,
        notes: createForm.notes || undefined,
      };

      const res = await fetch("/api/create-service-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        // Upload documents if provided
        const requestId = json.data.id;
        if (createForm.passport_url) {
          await fetch("/api/upload-service-request-doc", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session!.access_token}`,
            },
            body: JSON.stringify({
              request_id: requestId,
              doc_type: "passport",
              file_url: createForm.passport_url,
            }),
          });
        }
        if (createForm.driving_license_url) {
          await fetch("/api/upload-service-request-doc", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session!.access_token}`,
            },
            body: JSON.stringify({
              request_id: requestId,
              doc_type: "driving_license",
              file_url: createForm.driving_license_url,
            }),
          });
        }
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
      request_type: "vehicle",
      start_date: "",
      end_date: "",
      vehicle_category: "",
      passengers: 1,
      pickup_location: "",
      dropoff_location: "",
      flight_number: "",
      client_name: "",
      client_phone: "",
      client_email: "",
      client_address: "",
      notes: "",
      passport_url: "",
      driving_license_url: "",
    });
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="in_progress">En gestión</SelectItem>
            <SelectItem value="vehicle_assigned">Vehículo asignado</SelectItem>
            <SelectItem value="completed">Completadas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
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
                ? "Crea una nueva solicitud para pedir un vehículo o transfer"
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
              onView={() => setLocation(`/service-requests/${request.id}`)}
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
            {/* Org info */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                <strong>De:</strong> {organization?.name} → <strong>A:</strong> Azul Cars
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            {/* Vehicle category dropdown - only for vehicle type */}
            {createForm.request_type === "vehicle" && (
              <div className="space-y-2">
                <Label>Categoría de vehículo (marca y modelo)</Label>
                <Select
                  value={createForm.vehicle_category}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, vehicle_category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar marca/modelo..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {vehicleModels.map((vm) => (
                      <SelectItem key={vm.label} value={vm.label}>
                        {vm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Transfer-specific fields */}
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

            {/* Client info section */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Datos del cliente
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre completo *</Label>
                    <Input
                      placeholder="Nombre del cliente"
                      value={createForm.client_name}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, client_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
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
                  <Label className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email del cliente
                  </Label>
                  <Input
                    type="email"
                    placeholder="cliente@email.com"
                    value={createForm.client_email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, client_email: e.target.value })
                    }
                  />
                </div>

                {/* Address - only for vehicle requests */}
                {createForm.request_type === "vehicle" && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5" />
                      Dirección del domicilio (país de origen)
                    </Label>
                    <Input
                      placeholder="Dirección completa del cliente"
                      value={createForm.client_address}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, client_address: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Document uploads */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentos del cliente
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pasaporte / ID</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handlePassportUpload}
                      className="hidden"
                      id="passport-upload"
                      disabled={uploadingPassport}
                    />
                    <label
                      htmlFor="passport-upload"
                      className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-colors ${
                        createForm.passport_url
                          ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
                      }`}
                    >
                      {uploadingPassport ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : createForm.passport_url ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {createForm.passport_url ? "Subido" : "Subir archivo"}
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Permiso de conducir</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleLicenseUpload}
                      className="hidden"
                      id="license-upload"
                      disabled={uploadingLicense}
                    />
                    <label
                      htmlFor="license-upload"
                      className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-colors ${
                        createForm.driving_license_url
                          ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
                      }`}
                    >
                      {uploadingLicense ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : createForm.driving_license_url ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {createForm.driving_license_url ? "Subido" : "Subir archivo"}
                    </label>
                  </div>
                </div>
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
            <Button onClick={handleCreate} disabled={submitting || uploadingPassport || uploadingLicense}>
              {submitting ? "Creando..." : "Crear Solicitud"}
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
  onView,
  onCancel,
}: {
  request: ServiceRequest;
  canManage: boolean;
  onView: () => void;
  onCancel: () => void;
}) {
  const status = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={onView}>
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

            {/* Vehicle category */}
            {request.vehicle_category && (
              <p className="text-sm text-muted-foreground">
                <Car className="h-3.5 w-3.5 inline mr-1" />
                {request.vehicle_category}
              </p>
            )}

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
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={onView}>
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Button>

            {/* Outgoing + pending/in_progress = can cancel */}
            {!request.is_incoming && ["pending", "in_progress"].includes(request.status) && (
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

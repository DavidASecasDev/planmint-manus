/**
 * ReinforcementAssignDialog — Shows unassigned operations in a deficit hour slot
 * and allows assigning a reinforcement employee (from Mostrador) to them.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  UserPlus,
  MapPin,
  Clock,
  Car,
  User,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UnassignedOperation {
  reservationId: string;
  type: "Entrega" | "Devolución" | "Transfer";
  datetime: string;
  hour: number;
  location: string | null;
  clientName: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  reservationCode: string | null;
  needsRental: boolean;
  needsEscoba: boolean;
  currentRentalName: string | null;
  currentEscobaName: string | null;
}

interface ReinforcementEmployee {
  userId: string;
  name: string;
  team: string;
  shiftStart: string;
  shiftEnd: string;
  availableHours: number;
}

interface ReinforcementAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  employee: ReinforcementEmployee;
  onAssigned?: () => void; // Callback after successful assignment
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReinforcementAssignDialog({
  open,
  onOpenChange,
  date,
  hour,
  employee,
  onAssigned,
}: ReinforcementAssignDialogProps) {
  const { session } = useAuth();
  const [operations, setOperations] = useState<UnassignedOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null); // reservationId being assigned
  const [assignedOps, setAssignedOps] = useState<Set<string>>(new Set());

  // Fetch unassigned operations when dialog opens
  const fetchOperations = useCallback(async () => {
    if (!session?.access_token || !date) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/get-unassigned-operations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ date, hour }),
      });
      const json = await resp.json();
      if (json.ok) {
        setOperations(json.data.operations);
      } else {
        toast.error("Error al cargar operaciones: " + (json.error || "Unknown"));
      }
    } catch (err) {
      toast.error("Error de conexión al cargar operaciones");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, date, hour]);

  useEffect(() => {
    if (open) {
      setAssignedOps(new Set());
      fetchOperations();
    }
  }, [open, fetchOperations]);

  // Assign employee to an operation
  const handleAssign = async (
    op: UnassignedOperation,
    role: "rental" | "escoba"
  ) => {
    if (!session?.access_token) return;
    const key = `${op.reservationId}-${role}`;
    setAssigning(key);
    try {
      const resp = await fetch("/api/assign-reinforcement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reservationId: op.reservationId,
          operationType: op.type,
          role,
          userId: employee.userId,
        }),
      });
      const json = await resp.json();
      if (json.ok) {
        toast.success(
          `${employee.name} asignado como ${role === "rental" ? "Rental" : "Escoba"} a reserva ${op.reservationCode || op.reservationId.substring(0, 8)}`
        );
        setAssignedOps((prev) => new Set(prev).add(key));
        onAssigned?.();
      } else {
        toast.error("Error al asignar: " + (json.error || "Unknown"));
      }
    } catch (err) {
      toast.error("Error de conexión al asignar");
    } finally {
      setAssigning(null);
    }
  };

  const formatTime = (dt: string) => {
    if (dt.length >= 16) return dt.substring(11, 16);
    return "—";
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "Entrega":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Devolución":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Transfer":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dateObj = new Date(date + "T12:00:00");
  const dayName = dayNames[dateObj.getDay()];
  const formattedDate = `${dayName} ${date.substring(8, 10)}/${date.substring(5, 7)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Asignar como refuerzo
          </DialogTitle>
          <DialogDescription>
            Asignar a <strong>{employee.name}</strong> ({employee.team}) a una
            operación sin cubrir el {formattedDate} a las {String(hour).padStart(2, "0")}:00h
          </DialogDescription>
        </DialogHeader>

        {/* Employee info card */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
            {employee.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">{employee.name}</p>
            <p className="text-xs text-muted-foreground">
              {employee.team} · Turno {employee.shiftStart}–{employee.shiftEnd}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {employee.availableHours}h disponibles
          </Badge>
        </div>

        <Separator />

        {/* Operations list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">
              Cargando operaciones...
            </span>
          </div>
        ) : operations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">
              Todas las operaciones de esta franja están asignadas
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              {operations.length} operaci{operations.length === 1 ? "ón" : "ones"}{" "}
              sin asignar completamente
            </p>

            {operations.map((op) => {
              const rentalKey = `${op.reservationId}-rental`;
              const escobaKey = `${op.reservationId}-escoba`;
              const rentalAssigned = assignedOps.has(rentalKey);
              const escobaAssigned = assignedOps.has(escobaKey);

              return (
                <div
                  key={`${op.reservationId}-${op.type}`}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                >
                  {/* Operation header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getTypeBadgeColor(op.type)}`}
                      >
                        {op.type}
                      </Badge>
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatTime(op.datetime)}
                      </span>
                      {op.reservationCode && (
                        <span className="text-xs text-muted-foreground">
                          #{op.reservationCode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operation details */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {op.clientName && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {op.clientName}
                      </div>
                    )}
                    {op.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate" title={op.location}>
                          {op.location}
                        </span>
                      </div>
                    )}
                    {(op.vehicleModel || op.vehiclePlate) && (
                      <div className="flex items-center gap-1">
                        <Car className="h-3 w-3" />
                        {op.vehicleModel}
                        {op.vehiclePlate && (
                          <span className="font-mono">{op.vehiclePlate}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Current assignees */}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      Rental:{" "}
                      {op.currentRentalName ? (
                        <span className="text-foreground font-medium">
                          {op.currentRentalName}
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium">
                          Sin asignar
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      Escoba:{" "}
                      {op.currentEscobaName ? (
                        <span className="text-foreground font-medium">
                          {op.currentEscobaName}
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium">
                          Sin asignar
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Assignment buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {op.needsRental && (
                      <Button
                        size="sm"
                        variant={rentalAssigned ? "outline" : "default"}
                        className={`text-xs h-7 ${rentalAssigned ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}`}
                        disabled={
                          assigning === rentalKey || rentalAssigned
                        }
                        onClick={() => handleAssign(op, "rental")}
                      >
                        {assigning === rentalKey ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : rentalAssigned ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <UserPlus className="h-3 w-3 mr-1" />
                        )}
                        {rentalAssigned
                          ? "Asignado como Rental"
                          : "Asignar como Rental"}
                      </Button>
                    )}
                    {op.needsEscoba && (
                      <Button
                        size="sm"
                        variant={escobaAssigned ? "outline" : "secondary"}
                        className={`text-xs h-7 ${escobaAssigned ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}`}
                        disabled={
                          assigning === escobaKey || escobaAssigned
                        }
                        onClick={() => handleAssign(op, "escoba")}
                      >
                        {assigning === escobaKey ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : escobaAssigned ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <UserPlus className="h-3 w-3 mr-1" />
                        )}
                        {escobaAssigned
                          ? "Asignado como Escoba"
                          : "Asignar como Escoba"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

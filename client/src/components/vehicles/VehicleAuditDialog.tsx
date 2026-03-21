import { useState, useEffect, useMemo } from 'react';
import { VehicleWithTasks } from '@/types/vehicles';
import {
  AUDIT_CHECKLIST,
  CHECKLIST_CATEGORIES,
  ChecklistResult,
  ChecklistItemResult,
  isChecklistComplete,
  hasDefects,
  calculateAuditScore,
} from '@/types/audits';
import { useVehicleAudits } from '@/hooks/useVehicleAudits';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Car,
  Armchair,
  Wrench,
  FileText,
  CheckCircle2,
  XCircle,
  Circle,
  ShieldCheck,
  ShieldX,
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  exterior: Car,
  interior: Armchair,
  mecanica: Wrench,
  documentacion: FileText,
};

interface VehicleAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleWithTasks | null;
}

export function VehicleAuditDialog({ open, onOpenChange, vehicle }: VehicleAuditDialogProps) {
  const {
    latestAudit,
    isLoadingLatestAudit,
    auditHistory,
    createAudit,
    isCreatingAudit,
    updateChecklistItem,
    completeAudit,
    isCompletingAudit,
  } = useVehicleAudits(vehicle?.id);

  const [localResults, setLocalResults] = useState<Record<string, ChecklistResult>>({});
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Sync local state with latest audit data
  useEffect(() => {
    if (latestAudit?.status === 'in_progress' && latestAudit.checklist_results) {
      setLocalResults(latestAudit.checklist_results as Record<string, ChecklistResult>);
      setNotes(latestAudit.notes || '');
    }
  }, [latestAudit]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowHistory(false);
      setShowRejectForm(false);
      setRejectionReason('');
    }
  }, [open]);

  const activeAudit = latestAudit?.status === 'in_progress' ? latestAudit : null;
  const lastCompletedAudit = latestAudit?.status !== 'in_progress' ? latestAudit : null;

  const checkedCount = useMemo(() => {
    return Object.values(localResults).filter(r => r.result !== 'not_checked').length;
  }, [localResults]);

  const approvedCount = useMemo(() => {
    return Object.values(localResults).filter(r => r.result === 'approved').length;
  }, [localResults]);

  const defectCount = useMemo(() => {
    return Object.values(localResults).filter(r => r.result === 'defect').length;
  }, [localResults]);

  const progressPercent = (checkedCount / AUDIT_CHECKLIST.length) * 100;
  const score = calculateAuditScore(localResults);
  const complete = isChecklistComplete(localResults);

  const handleToggleItem = (key: string, result: ChecklistItemResult) => {
    if (!activeAudit) return;

    const currentResult = localResults[key];
    // Toggle: if same result, go back to not_checked
    const newResult: ChecklistItemResult = currentResult?.result === result ? 'not_checked' : result;

    const updatedResults = {
      ...localResults,
      [key]: { key, result: newResult, notes: currentResult?.notes },
    };

    setLocalResults(updatedResults);

    // Debounce save to DB
    updateChecklistItem({
      auditId: activeAudit.id,
      checklistResults: updatedResults,
    });
  };

  const handleStartAudit = () => {
    if (!vehicle) return;
    createAudit({ vehicleId: vehicle.id });
  };

  const handleApprove = () => {
    if (!activeAudit) return;
    completeAudit({
      auditId: activeAudit.id,
      status: 'approved',
      notes,
      checklistResults: localResults,
    });
    onOpenChange(false);
  };

  const handleReject = () => {
    if (!activeAudit || !rejectionReason.trim()) return;
    completeAudit({
      auditId: activeAudit.id,
      status: 'rejected',
      rejectionReason: rejectionReason.trim(),
      notes,
      checklistResults: localResults,
    });
    onOpenChange(false);
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                Auditoría de Calidad — {vehicle.matricula}
              </DialogTitle>
              <DialogDescription>
                {vehicle.modelo || 'Sin modelo'} · {vehicle.categoria || 'Sin categoría'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* ── Loading State ── */}
          {isLoadingLatestAudit && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* ── No Active Audit: Show start button or last result ── */}
          {!isLoadingLatestAudit && !activeAudit && !showHistory && (
            <div className="space-y-4 py-4">
              {/* Last audit result */}
              {lastCompletedAudit && (
                <div className={`rounded-lg border p-4 ${
                  lastCompletedAudit.status === 'approved' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {lastCompletedAudit.status === 'approved' ? (
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-semibold text-sm">
                      Última auditoría: {lastCompletedAudit.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </span>
                    <Badge variant={lastCompletedAudit.status === 'approved' ? 'default' : 'destructive'} className="ml-auto">
                      {lastCompletedAudit.overall_score}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastCompletedAudit.auditor_profile?.name || 'Auditor desconocido'} · {' '}
                    {lastCompletedAudit.completed_at
                      ? format(new Date(lastCompletedAudit.completed_at), "d MMM yyyy, HH:mm", { locale: es })
                      : 'Sin fecha'}
                  </p>
                  {lastCompletedAudit.status === 'rejected' && lastCompletedAudit.rejection_reason && (
                    <p className="text-xs text-red-700 mt-2">
                      <strong>Motivo:</strong> {lastCompletedAudit.rejection_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Start new audit */}
              <div className="text-center py-6">
                <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="font-semibold mb-1">
                  {vehicle.status === 'limpio' ? 'Vehículo listo para auditar' : 'Iniciar auditoría de calidad'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Revisa el checklist de 13 puntos para verificar la preparación del vehículo.
                </p>
                <Button
                  onClick={handleStartAudit}
                  disabled={isCreatingAudit}
                  className="bg-[#1B2A4A] hover:bg-[#1B2A4A]/90"
                >
                  {isCreatingAudit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                  )}
                  Iniciar Auditoría
                </Button>
              </div>

              {/* History button */}
              {auditHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setShowHistory(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  Ver historial ({auditHistory.length} auditorías)
                </Button>
              )}
            </div>
          )}

          {/* ── History View ── */}
          {showHistory && (
            <div className="space-y-3 py-4">
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                ← Volver
              </Button>
              <h3 className="font-semibold text-sm">Historial de Auditorías</h3>
              {auditHistory.map((audit) => (
                <div key={audit.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    {audit.status === 'approved' ? (
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                    ) : audit.status === 'rejected' ? (
                      <ShieldX className="h-4 w-4 text-red-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {audit.status === 'approved' ? 'Aprobada' : audit.status === 'rejected' ? 'Rechazada' : 'En progreso'}
                    </span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {audit.overall_score}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {audit.auditor_profile?.name || 'Desconocido'} · {' '}
                    {format(new Date(audit.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                  {audit.rejection_reason && (
                    <p className="text-xs text-red-600">Motivo: {audit.rejection_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Active Audit: Checklist ── */}
          {activeAudit && !showHistory && (
            <div className="space-y-4 py-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progreso del checklist</span>
                  <span className="font-medium">{checkedCount}/{AUDIT_CHECKLIST.length}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> {approvedCount} aprobados
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-3 w-3" /> {defectCount} defectos
                  </span>
                </div>
              </div>

              <Separator />

              {/* Checklist by category */}
              {CHECKLIST_CATEGORIES.map((category) => {
                const CategoryIcon = CATEGORY_ICONS[category.key] || FileText;
                const items = AUDIT_CHECKLIST.filter(i => i.category === category.key);

                return (
                  <div key={category.key} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <CategoryIcon className="h-4 w-4" />
                      {category.label}
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const result = localResults[item.key];
                        const status = result?.result || 'not_checked';

                        return (
                          <div
                            key={item.key}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                              status === 'approved'
                                ? 'bg-green-50 border-green-200'
                                : status === 'defect'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-background hover:bg-muted/50'
                            }`}
                          >
                            <span className="text-sm">{item.label}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 rounded-full ${
                                  status === 'approved'
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'text-muted-foreground hover:text-green-600 hover:bg-green-50'
                                }`}
                                onClick={() => handleToggleItem(item.key, 'approved')}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 rounded-full ${
                                  status === 'defect'
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'text-muted-foreground hover:text-red-600 hover:bg-red-50'
                                }`}
                                onClick={() => handleToggleItem(item.key, 'defect')}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Observaciones generales</label>
                <Textarea
                  placeholder="Notas adicionales sobre el estado del vehículo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Rejection reason form */}
              {showRejectForm && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Motivo del rechazo
                  </div>
                  <Textarea
                    placeholder="Describe por qué se rechaza la preparación..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                    className="border-red-200"
                  />
                  <p className="text-xs text-red-600">
                    El vehículo volverá a estado &quot;Sucio&quot; para re-preparación.
                  </p>
                </div>
              )}

              {/* Score preview */}
              {complete && (
                <div className={`rounded-lg border p-3 text-center ${
                  !hasDefects(localResults) ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <span className="text-2xl font-bold">{score}%</span>
                  <p className="text-xs text-muted-foreground mt-1">Puntuación de calidad</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* ── Footer Actions ── */}
        {activeAudit && !showHistory && (
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {!showRejectForm ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectForm(true)}
                  disabled={!complete || isCompletingAudit}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <ShieldX className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={!complete || hasDefects(localResults) || isCompletingAudit}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isCompletingAudit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Aprobar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={!rejectionReason.trim() || isCompletingAudit}
                >
                  {isCompletingAudit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldX className="h-4 w-4 mr-2" />
                  )}
                  Confirmar Rechazo
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

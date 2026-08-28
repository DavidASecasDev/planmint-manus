import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, subDays } from 'date-fns';
import {
  AlertCircle, BookOpen, CheckCircle2, ClipboardCheck, FileCode2, FileDown, Info, Loader2,
  RefreshCw, Settings2, ShieldAlert, ShieldCheck, UsersRound,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SesDraftEditor } from '@/components/ses/SesDraftEditor';
import { SesBatchPanel } from '@/components/ses/SesBatchPanel';
import { SesFiltersBar } from '@/components/ses/SesFiltersBar';
import { SesManualDialog } from '@/components/ses/SesManualDialog';
import { SesComplianceDialog } from '@/components/ses/SesComplianceDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermissions } from '@/hooks/usePermissions';
import { useSesFilterPreferences } from '@/hooks/useSesFilterPreferences';
import { useSesHospedajes } from '@/hooks/useSesHospedajes';
import { sanitizeSesFilterPreferences, serializeSesFilters, type SesDraftFilters } from '@/lib/sesFilterPreferences';
import { getSesSettingsNotice } from '@/lib/sesSettingsNotice';
import { countActionableSesIssues, getActionableSesIssues } from '@/lib/sesValidationIssues';
import type { SesContractDraft, SesSettings } from '@/types/sesHospedajes';

const STATUS_LABELS: Record<string, string> = {
  pending_sync: 'Pendiente de sincronizar',
  incomplete: 'Incompleto', ready: 'Listo', batched: 'En lote',
  uploaded_pending_result: 'Subido · pendiente', accepted: 'Aceptado',
  error: 'Error', needs_revision: 'Requiere revisión', requires_review: 'Revisión obligatoria',
};

const PAYMENT_TYPES = [
  ['DESTI', 'Pago en destino'], ['EFECT', 'Efectivo'], ['TARJT', 'Tarjeta'],
  ['PLATF', 'Plataforma de pago'], ['TRANS', 'Transferencia'], ['MOVIL', 'Pago móvil'],
  ['TREG', 'Tarjeta regalo'], ['OTRO', 'Otro'],
];

function dateInput(date: Date) { return format(date, 'yyyy-MM-dd'); }
function displayDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, 'dd/MM/yyyy HH:mm');
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ready') return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Listo</Badge>;
  if (status === 'incomplete') return <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Incompleto</Badge>;
  if (status === 'accepted') return <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">Aceptado</Badge>;
  if (status === 'error') return <Badge variant="destructive">Error</Badge>;
  if (status === 'needs_revision') return <Badge className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50">Requiere revisión</Badge>;
  if (status === 'requires_review') return <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">Revisión obligatoria</Badge>;
  return <Badge variant="secondary">{STATUS_LABELS[status] || status}</Badge>;
}

function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SesSettings | null;
  onSave: (values: Partial<SesSettings>) => Promise<unknown>;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    lessor_code: '', establishment_code: '', default_payment_type: '', default_vehicle_type: 'TURISMO',
  });
  useEffect(() => {
    setForm({
      lessor_code: settings?.lessor_code ?? '',
      establishment_code: settings?.establishment_code ?? '',
      default_payment_type: settings?.default_payment_type ?? '',
      default_vehicle_type: settings?.default_vehicle_type ?? 'TURISMO',
    });
  }, [settings, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuración SES.HOSPEDAJES</DialogTitle>
          <DialogDescription>Los códigos los facilita el portal oficial. No introduzcas aquí usuario ni contraseña del Gobierno.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2"><Label>Código de arrendador</Label><Input maxLength={10} value={form.lessor_code} onChange={(e) => setForm({ ...form, lessor_code: e.target.value.toUpperCase() })} placeholder="10 caracteres" /></div>
          <div className="space-y-2">
            <Label>Código de establecimiento (opcional si se usa dirección)</Label>
            <Input maxLength={10} value={form.establishment_code} onChange={(e) => setForm({ ...form, establishment_code: e.target.value.toUpperCase() })} placeholder="Solo si SES asigna uno a esta sede" />
            <p className="text-xs text-slate-500">Son Malferit se comunica actualmente mediante su dirección estructurada completa.</p>
          </div>
          <div className="space-y-2">
            <Label>Tipo de pago predeterminado</Label>
            <Select value={form.default_payment_type || undefined} onValueChange={(value) => setForm({ ...form, default_payment_type: value })}>
              <SelectTrigger><SelectValue placeholder="Sin predeterminado" /></SelectTrigger>
              <SelectContent>{PAYMENT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de vehículo predeterminado</Label>
            <Select value={form.default_vehicle_type} onValueChange={(value) => setForm({ ...form, default_vehicle_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="TURISMO">Turismo</SelectItem><SelectItem value="FURGONETA">Furgoneta</SelectItem><SelectItem value="MOTO">Moto</SelectItem><SelectItem value="OTRO">Otro</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={async () => {
            await onSave({
              lessor_code: form.lessor_code || null,
              establishment_code: form.establishment_code || null,
              default_payment_type: form.default_payment_type || null,
              default_vehicle_type: form.default_vehicle_type,
            });
            onOpenChange(false);
          }}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SesHospedajes() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canView = hasPermission('ses_hospedajes.view');
  const canEdit = hasPermission('ses_hospedajes.edit');
  const canExport = hasPermission('ses_hospedajes.export');
  const canConfigure = hasPermission('ses_hospedajes.manage_settings');
  const defaultFilters = useMemo<SesDraftFilters>(() => ({
    dateFrom: dateInput(subDays(new Date(), 7)),
    dateTo: dateInput(addDays(new Date(), 30)),
    status: 'all',
    search: '',
  }), []);
  const [filters, setFilters] = useState<SesDraftFilters>(defaultFilters);
  const [pageOffset, setPageOffset] = useState(0);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const savedFiltersRef = useRef<string>('');
  const filterPreferences = useSesFilterPreferences(canView && !permissionsLoading);
  const filtersReady = Boolean(filterPreferences.userId && hydratedUserId === filterPreferences.userId);
  const ses = useSesHospedajes(filters, filtersReady, { limit: 200, offset: pageOffset, searchMode: 'exact' });
  const [selected, setSelected] = useState<SesContractDraft | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [lastExclusions, setLastExclusions] = useState<Array<{ reference: string; reasons: Array<{ code: string; message: string }> }>>([]);

  useEffect(() => {
    if (!filterPreferences.userId || !filterPreferences.isFetched || filterPreferences.isLoading) return;
    const restored = sanitizeSesFilterPreferences(filterPreferences.data, defaultFilters);
    setFilters(restored);
    savedFiltersRef.current = serializeSesFilters(restored);
    setHydratedUserId(filterPreferences.userId);
  }, [defaultFilters, filterPreferences.data, filterPreferences.isFetched, filterPreferences.isLoading, filterPreferences.userId]);

  useEffect(() => {
    if (!filtersReady) return;
    const serialized = serializeSesFilters(filters);
    if (serialized === savedFiltersRef.current) return;
    const timeout = window.setTimeout(() => {
      filterPreferences.save.mutate(filters, {
        onSuccess: (saved) => { savedFiltersRef.current = serializeSesFilters(saved); },
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [filterPreferences.save, filters, filtersReady]);

  useEffect(() => {
    setPageOffset(0);
  }, [filters.dateFrom, filters.dateTo, filters.search, filters.status]);

  useEffect(() => {
    if (!selected) return;
    const refreshed = ses.drafts.find((draft) => draft.id === selected.id);
    if (refreshed) setSelected(refreshed);
  }, [ses.drafts, selected?.id]);

  const ready = ses.summary.ready ?? 0;
  const incomplete = ses.summary.incomplete ?? 0;
  const accepted = ses.summary.accepted ?? 0;
  const schemaMigrationRequired = ses.schemaMigrationRequired;
  const completeness = ses.total ? Math.round((ready / ses.total) * 100) : 0;
  const selectedSaving = ses.updateDraft.isPending || ses.updatePerson.isPending || ses.createPerson.isPending || ses.updateLocation.isPending;
  const readyDrafts = ses.drafts.filter((draft) => draft.status === 'ready' && draft.ready_for_xml);
  const selectedReadyIds = Array.from(selectedIds).filter((id) => readyDrafts.some((draft) => draft.id === id));
  const settingsNotice = getSesSettingsNotice(ses.settings);

  const missingFieldCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const draft of ses.drafts) {
      for (const issue of getActionableSesIssues(draft)) counts.set(issue.label, (counts.get(issue.label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [ses.drafts]);

  if (permissionsLoading || (canView && !filtersReady)) {
    return <AppLayout title="SES.HOSPEDAJES"><div className="space-y-4 p-2"><Skeleton className="h-24" /><Skeleton className="h-96" /></div></AppLayout>;
  }
  if (!canView) {
    return (
      <AppLayout title="SES.HOSPEDAJES">
        <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
          <ShieldAlert className="h-12 w-12 text-slate-400" />
          <h2 className="text-xl font-semibold">Acceso restringido</h2>
          <p className="max-w-md text-sm text-slate-500">Este módulo contiene datos personales sensibles y requiere el permiso SES.HOSPEDAJES.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="SES.HOSPEDAJES">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2"><FileCode2 className="h-5 w-5 text-amber-600" /><span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Cumplimiento · alquiler de vehículos</span></div>
            <h1 className="text-2xl font-bold text-slate-950">SES.HOSPEDAJES</h1>
            <p className="mt-1 text-sm text-slate-500">Prepara, completa y valida contratos en bloque antes de generar el XML oficial.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setManualOpen(true)}><BookOpen className="mr-2 h-4 w-4" />Cómo funciona</Button>
            {canConfigure && !schemaMigrationRequired && <Button variant="outline" onClick={() => setComplianceOpen(true)}><ShieldCheck className="mr-2 h-4 w-4" />Control oficial</Button>}
            {canConfigure && !schemaMigrationRequired && <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Configuración</Button>}
            <Button variant="outline" onClick={() => ses.refetch()} disabled={ses.isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${ses.isLoading ? 'animate-spin' : ''}`} />Actualizar</Button>
            {canEdit && !schemaMigrationRequired && (
              <Button onClick={() => ses.prepare.mutate({ dateFrom: filters.dateFrom, dateTo: filters.dateTo }, { onSuccess: (result) => setLastExclusions(result.exclusions) })} disabled={ses.prepare.isPending}>
                {ses.prepare.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                Preparar reservas
              </Button>
            )}
            {canExport && (
              <Button
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={schemaMigrationRequired || selectedReadyIds.length === 0 || ses.exportXml.isPending}
                onClick={() => ses.exportXml.mutate(selectedReadyIds, { onSuccess: () => setSelectedIds(new Set()) })}
              >
                {ses.exportXml.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Generar XML{selectedReadyIds.length ? ` (${selectedReadyIds.length})` : ''}
              </Button>
            )}
          </div>
        </div>

        {schemaMigrationRequired && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Actualización técnica pendiente · modo solo lectura</AlertTitle>
            <AlertDescription>
              Se muestran los borradores, la configuración y los lotes históricos sin modificarlos. Preparar,
              completar, conciliar y generar XML permanecen bloqueados hasta aplicar la migración compatible revisada.
            </AlertDescription>
          </Alert>
        )}

        {ses.readError && !schemaMigrationRequired && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>No se pudo cargar SES.HOSPEDAJES</AlertTitle>
            <AlertDescription>{ses.readError instanceof Error ? ses.readError.message : 'Error de lectura'}</AlertDescription>
          </Alert>
        )}

        {settingsNotice ? (
          <Alert className={settingsNotice.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-blue-200 bg-blue-50 text-blue-950'}>
            {settingsNotice.kind === 'warning' ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            <AlertTitle>{settingsNotice.title}</AlertTitle>
            <AlertDescription>{settingsNotice.description}</AlertDescription>
          </Alert>
        ) : null}

        {!schemaMigrationRequired && (!ses.settings?.official_xsd_hash || !ses.settings?.official_inventory_confirmed_at) && (
          <Alert className="border-red-200 bg-red-50 text-red-950">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Control oficial pendiente</AlertTitle>
            <AlertDescription>La generación XML permanece bloqueada hasta cargar el XSD oficial y confirmar el inventario de comunicaciones del portal.</AlertDescription>
          </Alert>
        )}

        {lastExclusions.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{lastExclusions.length} reservas excluidas de la preparación automática</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1">
                {lastExclusions.slice(0, 8).map((item) => <p key={item.reference}><strong>#{item.reference}:</strong> {item.reasons.map((reason) => reason.message).join(' · ')}</p>)}
                {lastExclusions.length > 8 && <p>Y {lastExclusions.length - 8} exclusiones adicionales.</p>}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-slate-500">Preparados · filtro</p><p className="mt-1 text-2xl font-bold">{ses.total}</p></div><ClipboardCheck className="h-8 w-8 text-slate-300" /></CardContent></Card>
          <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-emerald-700">Listos · filtro</p><p className="mt-1 text-2xl font-bold text-emerald-900">{ready}</p></div><CheckCircle2 className="h-8 w-8 text-emerald-400" /></CardContent></Card>
          <Card className="border-amber-200 bg-amber-50/50 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-amber-700">Requieren datos · filtro</p><p className="mt-1 text-2xl font-bold text-amber-900">{incomplete}</p></div><AlertCircle className="h-8 w-8 text-amber-400" /></CardContent></Card>
          <Card className="border-blue-200 bg-blue-50/50 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-blue-700">Aceptados · filtro</p><p className="mt-1 text-2xl font-bold text-blue-900">{accepted}</p></div><UsersRound className="h-8 w-8 text-blue-400" /></CardContent></Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between text-sm"><span className="font-medium">Completitud del periodo</span><span className="font-semibold text-emerald-700">{completeness}%</span></div>
            <Progress value={completeness} className="h-2" />
            {missingFieldCounts.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 text-xs text-slate-500">
                <span className="font-medium">Más frecuentes:</span>
                {missingFieldCounts.map(([path, count]) => <Badge key={path} variant="outline" className="font-normal">{path}: {count}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <SesBatchPanel
          batches={ses.batches}
          loading={ses.batchesLoading}
          canManage={canExport && !schemaMigrationRequired}
          savingUpload={ses.markBatchUploaded.isPending}
          savingResult={ses.recordBatchResult.isPending}
          onMarkUploaded={(input) => ses.markBatchUploaded.mutateAsync(input)}
          onRecordResult={(input) => ses.recordBatchResult.mutateAsync(input)}
        />

        <SesFiltersBar filters={filters} onChange={setFilters} saving={filterPreferences.save.isPending} />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar todos los contratos listos"
                    checked={readyDrafts.length > 0 && readyDrafts.every((draft) => selectedIds.has(draft.id))}
                    onCheckedChange={(checked) => setSelectedIds(checked ? new Set(readyDrafts.map((draft) => draft.id)) : new Set())}
                  />
                </TableHead>
                <TableHead>Reserva</TableHead><TableHead>Cliente</TableHead><TableHead>Recogida</TableHead><TableHead>Vehículo</TableHead><TableHead>Estado</TableHead><TableHead>Faltan</TableHead><TableHead className="w-28 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ses.isLoading ? Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : null}
              {!ses.isLoading && ses.drafts.map((draft) => {
                const client = [draft.reservation?.cliente_nombre, draft.reservation?.cliente_apellido].filter(Boolean).join(' ') || 'Sin nombre';
                return (
                  <TableRow
                    key={draft.id}
                    className={schemaMigrationRequired ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}
                    onClick={() => { if (!schemaMigrationRequired) setSelected(draft); }}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        aria-label={`Seleccionar contrato ${draft.reference}`}
                        checked={selectedIds.has(draft.id)}
                        disabled={draft.status !== 'ready' || !draft.ready_for_xml}
                        onCheckedChange={(checked) => setSelectedIds((current) => {
                          const next = new Set(current);
                          if (checked) next.add(draft.id); else next.delete(draft.id);
                          return next;
                        })}
                      />
                    </TableCell>
                    <TableCell><div className="font-semibold text-slate-900">#{draft.reference}</div><div className="text-xs text-slate-400">v{draft.draft_version}</div></TableCell>
                    <TableCell><div className="max-w-44 truncate font-medium">{client}</div><div className="text-xs text-slate-400">{draft.holder?.document_number || 'Sin documento'}</div></TableCell>
                    <TableCell><div className="whitespace-nowrap text-sm">{displayDate(draft.pickup_at)}</div><div className="max-w-52 truncate text-xs text-slate-400">{draft.pickup_location?.name || 'Sin lugar'}</div></TableCell>
                    <TableCell><div className="font-medium">{draft.vehicle_plate || '—'}</div><div className="max-w-40 truncate text-xs text-slate-400">{[draft.vehicle_brand, draft.vehicle_model].filter(Boolean).join(' ') || 'Sin modelo'}</div></TableCell>
                    <TableCell><StatusBadge status={draft.status} />{draft.eligibility_errors?.[0] && <p className="mt-1 max-w-48 text-xs text-red-600">{draft.eligibility_errors[0].message}</p>}{!draft.is_officially_clear && draft.official_check_status === 'not_checked' && <p className="mt-1 text-xs text-amber-600">Inventario oficial sin confirmar</p>}</TableCell>
                    <TableCell>{countActionableSesIssues(draft) || draft.eligibility_errors?.length || !draft.is_officially_clear ? <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700"><AlertCircle className="h-4 w-4" />{countActionableSesIssues(draft) + (draft.eligibility_errors?.length ?? 0) + (!draft.is_officially_clear ? 1 : 0)}</div> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" disabled={schemaMigrationRequired} onClick={(event) => { event.stopPropagation(); setSelected(draft); }}>{schemaMigrationRequired ? 'Solo lectura' : draft.status === 'ready' ? 'Revisar' : 'Completar'}</Button></TableCell>
                  </TableRow>
                );
              })}
              {!ses.isLoading && ses.drafts.length === 0 && (
                <TableRow><TableCell colSpan={8} className="h-52 text-center"><FileCode2 className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="font-medium text-slate-700">No hay contratos preparados</p><p className="mt-1 text-sm text-slate-400">Selecciona un periodo y pulsa “Preparar reservas”.</p></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {ses.total > 200 && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span>Mostrando {pageOffset + 1}–{Math.min(pageOffset + ses.pageCount, ses.total)} de {ses.total} contratos filtrados</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={pageOffset === 0} onClick={() => setPageOffset(Math.max(0, pageOffset - 200))}>Anterior</Button><Button variant="outline" size="sm" disabled={pageOffset + ses.pageCount >= ses.total} onClick={() => setPageOffset(pageOffset + 200)}>Siguiente</Button></div>
          </div>
        )}
      </div>

      <SesDraftEditor
        draft={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        onUpdatePerson={(input) => ses.updatePerson.mutateAsync(input)}
        onCreatePerson={(input) => ses.createPerson.mutateAsync(input)}
        onUpdateDraft={(input) => ses.updateDraft.mutateAsync(input)}
        onUpdateLocation={(input) => ses.updateLocation.mutateAsync(input)}
        onSearchMunicipalities={ses.searchMunicipalities}
        saving={selectedSaving}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={ses.settings}
        onSave={(values) => ses.updateSettings.mutateAsync(values)}
        saving={ses.updateSettings.isPending}
      />
      <SesManualDialog open={manualOpen} onOpenChange={setManualOpen} />
      <SesComplianceDialog
        open={complianceOpen}
        onOpenChange={setComplianceOpen}
        settings={ses.settings}
        inventoryTotal={ses.officialInventory.total}
        uploadingXsd={ses.uploadXsd.isPending}
        importingInventory={ses.importOfficialInventory.isPending}
        onUploadXsd={(input) => ses.uploadXsd.mutateAsync(input)}
        onImportInventory={(input) => ses.importOfficialInventory.mutateAsync(input)}
      />
    </AppLayout>
  );
}

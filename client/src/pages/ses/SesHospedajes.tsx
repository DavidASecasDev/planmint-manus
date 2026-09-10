import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, subDays } from 'date-fns';
import {
  AlertCircle, BookOpen, CheckCircle2, ClipboardCheck, FileCode2, FileDown, History, Info, Loader2,
  RefreshCw, Settings2, ShieldAlert,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SesDraftEditor } from '@/components/ses/SesDraftEditor';
import { SesFiltersBar } from '@/components/ses/SesFiltersBar';
import { SesManualDialog } from '@/components/ses/SesManualDialog';
import { SesOfficialCheckDialog } from '@/components/ses/SesOfficialCheckDialog';
import { SesPagination } from '@/components/ses/SesPagination';
import { SesDraftActions } from '@/components/ses/SesDraftActions';
import { SesDailyReviewPanel } from '@/components/ses/SesDailyReviewPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermissions } from '@/hooks/usePermissions';
import { useSesFilterPreferences } from '@/hooks/useSesFilterPreferences';
import { useSesHospedajes } from '@/hooks/useSesHospedajes';
import { sanitizeSesFilterPreferences, serializeSesFilters, type SesDraftFilters } from '@/lib/sesFilterPreferences';
import { getSesSettingsNotice } from '@/lib/sesSettingsNotice';
import { canSelectSesDraftForXml } from '@/lib/sesSelection';
import { countActionableSesIssues, getActionableSesIssues } from '@/lib/sesValidationIssues';
import type { SesContractDraft, SesReviewItem, SesSettings } from '@/types/sesHospedajes';

const PAYMENT_TYPES = [
  ['DESTI', 'Pago en destino'], ['EFECT', 'Efectivo'], ['TARJT', 'Tarjeta'],
  ['PLATF', 'Plataforma de pago'], ['TRANS', 'Transferencia'], ['MOVIL', 'Pago móvil'],
  ['TREG', 'Tarjeta regalo'], ['OTRO', 'Otro'],
];
const SES_PAGE_SIZE = 50;

function dateInput(date: Date) { return format(date, 'yyyy-MM-dd'); }
function displayDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, 'dd/MM/yyyy HH:mm');
}

function StatusBadge({ draft }: { draft: SesContractDraft }) {
  if (draft.status === 'accepted') return <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aceptado por SES</Badge>;
  if (draft.status === 'uploaded_pending_result') return <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">Presentado · pendiente</Badge>;
  if (draft.operationalStatus === 'ready') return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Listo para XML</Badge>;
  if (draft.operationalStatus === 'incomplete') return <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Incompleta</Badge>;
  return <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">XML generado · no presentado</Badge>;
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
  const ses = useSesHospedajes(filters, filtersReady, { limit: SES_PAGE_SIZE, offset: pageOffset, searchMode: 'exact' });
  const [selected, setSelected] = useState<SesContractDraft | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [officialCheckDraft, setOfficialCheckDraft] = useState<SesContractDraft | null>(null);
  const [dailyReviewOpen, setDailyReviewOpen] = useState(false);
  const [pendingReviewDraftId, setPendingReviewDraftId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!pendingReviewDraftId) return;
    const draft = ses.drafts.find((candidate) => candidate.id === pendingReviewDraftId);
    if (draft) {
      setSelected(draft);
      setPendingReviewDraftId(null);
    }
  }, [pendingReviewDraftId, ses.drafts]);

  const openReviewItem = (item: SesReviewItem) => {
    if (!item.draft_id) return;
    const draft = ses.drafts.find((candidate) => candidate.id === item.draft_id);
    if (draft) setSelected(draft);
    else {
      setPendingReviewDraftId(item.draft_id);
      setFilters((current) => ({ ...current, search: String(item.external_booking_id) }));
      setPageOffset(0);
    }
    setDailyReviewOpen(false);
  };

  const ready = ses.summary.ready ?? 0;
  const incomplete = ses.summary.incomplete ?? 0;
  const xmlGenerated = ses.summary.xml_generated ?? 0;
  const schemaMigrationRequired = ses.schemaMigrationRequired;
  const selectedSaving = ses.updateDraft.isPending || ses.updatePerson.isPending || ses.createPerson.isPending || ses.updateLocation.isPending;
  const readyDrafts = ses.drafts.filter(canSelectSesDraftForXml);
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
            <p className="mt-1 text-sm text-slate-500">Sincroniza Rently, completa solo lo que falta y descarga un XML con los contratos seleccionados.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setManualOpen(true)}><BookOpen className="mr-2 h-4 w-4" />Cómo funciona</Button>
            <Button variant="outline" onClick={() => setDailyReviewOpen(true)}><ClipboardCheck className="mr-2 h-4 w-4" />Revisar entregas</Button>
            {canConfigure && !schemaMigrationRequired && <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Configuración</Button>}
            {canEdit && !schemaMigrationRequired && (
              <Button variant="outline" onClick={() => ses.syncAll.mutate()} disabled={ses.syncAll.isPending}>
                {ses.syncAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {ses.syncAll.isPending ? 'Sincronizando…' : 'Sincronizar Rently'}
              </Button>
            )}
            {canExport && (
              <Button
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={schemaMigrationRequired || selectedReadyIds.length === 0 || ses.exportXml.isPending}
                onClick={() => ses.exportXml.mutate(selectedReadyIds, { onSuccess: () => setSelectedIds(new Set()) })}
              >
                {ses.exportXml.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Descargar XML{selectedReadyIds.length ? ` (${selectedReadyIds.length})` : ''}
              </Button>
            )}
          </div>
        </div>

        {schemaMigrationRequired && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Actualización técnica pendiente · modo solo lectura</AlertTitle>
            <AlertDescription>
              Se muestran los borradores y el historial sin modificarlos. Sincronizar, completar y descargar XML
              permanecen bloqueados hasta aplicar la migración compatible revisada.
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

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-emerald-700">Listos · filtro</p><p className="mt-1 text-2xl font-bold text-emerald-900">{ready}</p></div><CheckCircle2 className="h-8 w-8 text-emerald-400" /></CardContent></Card>
          <Card className="border-amber-200 bg-amber-50/50 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-amber-700">Incompletos · filtro</p><p className="mt-1 text-2xl font-bold text-amber-900">{incomplete}</p></div><AlertCircle className="h-8 w-8 text-amber-400" /></CardContent></Card>
          <Card className="border-blue-200 bg-blue-50/50 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-blue-700">XML generado · no implica presentación</p><p className="mt-1 text-2xl font-bold text-blue-900">{xmlGenerated}</p></div><History className="h-8 w-8 text-blue-400" /></CardContent></Card>
        </div>

        {missingFieldCounts.length > 0 && <p className="text-sm text-slate-500"><strong>Campos pendientes más frecuentes:</strong> {missingFieldCounts.map(([path, count]) => `${path} (${count})`).join(' · ')}</p>}

        <SesFiltersBar filters={filters} onChange={setFilters} saving={filterPreferences.save.isPending} />

        <SesPagination total={ses.total} offset={pageOffset} limit={SES_PAGE_SIZE} pageCount={ses.pageCount} onOffsetChange={setPageOffset} />

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
                <TableHead>Reserva</TableHead><TableHead>Cliente</TableHead><TableHead>Recogida</TableHead><TableHead>Vehículo</TableHead><TableHead>Estado</TableHead><TableHead>Faltan</TableHead><TableHead className="sticky right-0 z-10 w-64 bg-slate-50 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ses.isLoading ? Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : null}
              {!ses.isLoading && ses.drafts.map((draft) => {
                const client = [draft.reservation?.cliente_nombre, draft.reservation?.cliente_apellido].filter(Boolean).join(' ') || 'Sin nombre';
                const actionableIssues = getActionableSesIssues(draft);
                const reviewConflicts = draft.reviewConflicts ?? [];
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
                        disabled={!canSelectSesDraftForXml(draft)}
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
                    <TableCell><StatusBadge draft={draft} />{draft.sesDuplicateWarning && <p className="mt-1 max-w-56 text-xs text-amber-700">Aviso SES: {draft.sesDuplicateWarning.message}</p>}{draft.syncConflicts.length > 0 && <p className="mt-1 max-w-56 text-xs text-blue-700">{draft.syncConflicts.length} corrección(es) manual(es) preservada(s)</p>}{reviewConflicts.length > 0 && <p className="mt-1 max-w-56 text-xs font-medium text-rose-700">{reviewConflicts.length} contradicción(es) por resolver</p>}</TableCell>
                    <TableCell>{actionableIssues.length > 0 || reviewConflicts.length > 0 ? <div className="max-w-64 space-y-1"><div className="flex items-center gap-1.5 text-sm font-medium text-amber-700"><AlertCircle className="h-4 w-4" />Faltantes: {actionableIssues.length}</div>{actionableIssues.length > 0 && <p className="text-xs leading-4 text-amber-700">{actionableIssues.map((issue) => issue.label).join(' · ')}</p>}<p className={reviewConflicts.length ? 'text-sm font-medium text-rose-700' : 'text-xs text-slate-400'}>Contradicciones: {reviewConflicts.length}</p></div> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}</TableCell>
                    <TableCell className="sticky right-0 z-10 bg-white text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"><SesDraftActions draft={draft} canExport={canExport} schemaMigrationRequired={schemaMigrationRequired} checking={ses.checkOfficialCommunication.isPending} onCheck={() => setOfficialCheckDraft(draft)} onComplete={() => setSelected(draft)} /></TableCell>
                  </TableRow>
                );
              })}
              {!ses.isLoading && ses.drafts.length === 0 && (
                <TableRow><TableCell colSpan={8} className="h-52 text-center"><FileCode2 className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="font-medium text-slate-700">No hay reservas sincronizadas</p><p className="mt-1 text-sm text-slate-400">Pulsa “Sincronizar Rently” para importar y actualizar todas las disponibles.</p></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <SesPagination total={ses.total} offset={pageOffset} limit={SES_PAGE_SIZE} pageCount={ses.pageCount} onOffsetChange={setPageOffset} />
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
      <SesOfficialCheckDialog
        draft={officialCheckDraft}
        open={Boolean(officialCheckDraft)}
        onOpenChange={(open) => !open && setOfficialCheckDraft(null)}
        checking={ses.checkOfficialCommunication.isPending}
        onCheck={(input) => ses.checkOfficialCommunication.mutateAsync(input)}
      />
      <SesDailyReviewPanel
        open={dailyReviewOpen}
        onOpenChange={setDailyReviewOpen}
        canEdit={canEdit && !schemaMigrationRequired}
        onOpenDraft={openReviewItem}
      />
    </AppLayout>
  );
}

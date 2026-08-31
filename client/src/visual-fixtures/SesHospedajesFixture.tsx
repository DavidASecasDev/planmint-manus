import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, CheckCircle2, Download, History, RefreshCw } from 'lucide-react';
import '@/index.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SesDraftActions } from '@/components/ses/SesDraftActions';
import { SesOfficialCheckDialog } from '@/components/ses/SesOfficialCheckDialog';
import { SesPagination } from '@/components/ses/SesPagination';
import { canSelectSesDraftForXml } from '@/lib/sesSelection';
import type { SesContractDraft } from '@/types/sesHospedajes';

function syntheticDraft(values: Partial<SesContractDraft>): SesContractDraft {
  return {
    id: '11111111-1111-4111-8111-111111111111', reservation_id: '21111111-1111-4111-8111-111111111111',
    external_booking_id: 65001, reference: 'SYNTHETIC-65001', status: 'incomplete', contract_date: '2026-08-28',
    pickup_at: '2026-08-28T10:00:00Z', return_at: '2026-08-30T10:00:00Z', pickup_location_id: null,
    return_location_id: null, holder_profile_id: null, primary_driver_profile_id: null, secondary_driver_profile_id: null,
    payment_type: null, payment_date: null, payment_medium: null, payment_holder: null, card_expiry: null,
    vehicle_category: 'AUTOMOVIL', vehicle_type: 'TURISMO', vehicle_brand: 'BMW', vehicle_model: 'X1',
    vehicle_plate: '1234ABC', vehicle_vin: 'WBA00000000000001', vehicle_color: 'BLANCO', km_pickup: 100, km_return: null,
    gps_data: null, validation_errors: [], eligibility_errors: [], is_complete: false, is_eligible: true,
    is_officially_clear: false, ready_for_xml: false, official_check_status: 'not_checked', manual_fields: [],
    draft_version: 1, updated_at: '2026-08-28T00:00:00Z', operationalStatus: 'incomplete', readyForXml: false,
    missingFields: [], invalidFields: [], sourceByField: {}, syncConflicts: [], sesDuplicateWarning: null,
    reservation: { id: '21111111-1111-4111-8111-111111111111', external_reservation_id: '65001', cliente_nombre: 'Persona', cliente_apellido: 'Sintética' },
    holder: null, primary_driver: null, secondary_driver: null, pickup_location: null, return_location: null,
    ...values,
  };
}

const FIXTURE_DRAFTS: SesContractDraft[] = [
  syntheticDraft({
    missingFields: [{ path: 'payment_type', code: 'required', message: 'Falta el tipo de pago' }],
    validation_errors: [{ path: 'payment_type', code: 'required', message: 'Falta el tipo de pago' }],
    sourceByField: { vehicle_plate: 'rently', vehicle_vin: 'rently' },
  }),
  syntheticDraft({
    id: '12222222-2222-4222-8222-222222222222', reservation_id: '22222222-2222-4222-8222-222222222222',
    reference: 'SYNTHETIC-65002', external_booking_id: 65002, status: 'ready', payment_type: 'TARJT',
    operationalStatus: 'ready', readyForXml: true, ready_for_xml: true, is_complete: true,
    sourceByField: { vehicle_plate: 'manual', vehicle_vin: 'rently', payment_type: 'derived' },
    syncConflicts: [{ field: 'vehicle_plate', keptSource: 'manual', incomingSource: 'rently', existingValue: '5678DEF', incomingValue: '5678DFE' }],
    vehicle_plate: '5678DEF', sesDuplicateWarning: { level: 'warning', message: 'Posible comunicación previa; decisión del operador.', reasons: ['accepted'] },
  }),
  syntheticDraft({
    id: '13333333-3333-4333-8333-333333333333', reservation_id: '23333333-3333-4333-8333-333333333333',
    reference: 'SYNTHETIC-65003', external_booking_id: 65003, status: 'batched', operationalStatus: 'xml_generated',
    readyForXml: false, ready_for_xml: false, vehicle_plate: '9012GHI',
  }),
];

function Fixture() {
  const [checkedIds, setCheckedIds] = useState(() => window.location.search.includes('selected=1') ? new Set([FIXTURE_DRAFTS[1].id]) : new Set<string>());
  const [officialDraft, setOfficialDraft] = useState<SesContractDraft | null>(() => window.location.search.includes('dialog=1') ? FIXTURE_DRAFTS[1] : null);
  const selected = useMemo(() => FIXTURE_DRAFTS.filter((draft) => checkedIds.has(draft.id) && canSelectSesDraftForXml(draft)), [checkedIds]);
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Fixture visual aislada · solo datos sintéticos</p><h1 className="text-3xl font-bold">SES.HOSPEDAJES</h1><p className="mt-1 text-sm text-slate-500">Sincronizar Rently → completar → seleccionar → descargar XML.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Sincronizar Rently</Button><Button disabled={!selected.length} className="bg-emerald-700 text-white"><Download className="mr-2 h-4 w-4" />Descargar XML{selected.length ? ` (${selected.length})` : ''}</Button></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3"><Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><p className="text-sm text-amber-700">Incompletos</p><p className="text-2xl font-bold">1</p></CardContent></Card><Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-4"><p className="text-sm text-emerald-700">Listos</p><p className="text-2xl font-bold">1</p></CardContent></Card><Card className="border-blue-200 bg-blue-50"><CardContent className="p-4"><p className="text-sm text-blue-700">XML generado</p><p className="text-2xl font-bold">1</p></CardContent></Card></div>
      <SesPagination total={3} offset={0} limit={50} pageCount={3} onOffsetChange={() => undefined} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><Table><TableHeader><TableRow><TableHead className="w-10" /><TableHead>Reserva</TableHead><TableHead>Vehículo</TableHead><TableHead>Estado</TableHead><TableHead>Faltan / avisos</TableHead><TableHead className="sticky right-0 bg-slate-50 text-right">Acción</TableHead></TableRow></TableHeader><TableBody>{FIXTURE_DRAFTS.map((draft) => <TableRow key={draft.id}><TableCell><Checkbox checked={checkedIds.has(draft.id)} disabled={!canSelectSesDraftForXml(draft)} onCheckedChange={(checked) => setCheckedIds((current) => { const next = new Set(current); checked ? next.add(draft.id) : next.delete(draft.id); return next; })} /></TableCell><TableCell className="font-semibold">#{draft.reference}</TableCell><TableCell>{draft.vehicle_plate}</TableCell><TableCell>{draft.operationalStatus === 'ready' ? <Badge className="bg-emerald-100 text-emerald-700">Lista para XML</Badge> : draft.operationalStatus === 'xml_generated' ? <Badge className="bg-blue-100 text-blue-700"><History className="mr-1 h-3 w-3" />XML generado</Badge> : <Badge className="bg-amber-100 text-amber-700">Incompleta</Badge>}</TableCell><TableCell>{draft.missingFields.length ? <span className="flex items-center gap-1 text-sm text-amber-700"><AlertCircle className="h-4 w-4" />Tipo de pago</span> : draft.sesDuplicateWarning ? <span className="text-xs text-amber-700">Aviso SES no bloqueante · corrección manual preservada</span> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}</TableCell><TableCell className="sticky right-0 bg-white"><SesDraftActions draft={draft} canExport schemaMigrationRequired={false} checking={false} onCheck={() => setOfficialDraft(draft)} onComplete={() => undefined} /></TableCell></TableRow>)}</TableBody></Table></div>
      <p className="text-xs text-slate-500">La reserva lista conserva un aviso SES y un conflicto manual, pero sigue seleccionable para XML.</p>
    </div>
    <SesOfficialCheckDialog draft={officialDraft} open={Boolean(officialDraft)} onOpenChange={(open) => !open && setOfficialDraft(null)} checking={false} onCheck={async () => undefined} />
  </main>;
}

createRoot(document.getElementById('ses-fixture-root')!).render(<Fixture />);

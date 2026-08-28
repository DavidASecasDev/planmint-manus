import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileCode2 } from 'lucide-react';
import '@/index.css';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SesDraftActions } from '@/components/ses/SesDraftActions';
import { SesOfficialCheckDialog } from '@/components/ses/SesOfficialCheckDialog';
import { SesPagination } from '@/components/ses/SesPagination';
import type { SesContractDraft } from '@/types/sesHospedajes';

const FIXTURE_DRAFTS: SesContractDraft[] = [
  {
    id: '11111111-1111-4111-8111-111111111111', reservation_id: '21111111-1111-4111-8111-111111111111',
    external_booking_id: 65001, reference: 'SYNTHETIC-65001', status: 'incomplete', contract_date: '2026-08-28',
    pickup_at: '2026-08-28T10:00:00Z', return_at: '2026-08-30T10:00:00Z', pickup_location_id: null,
    return_location_id: null, holder_profile_id: null, primary_driver_profile_id: null, secondary_driver_profile_id: null,
    payment_type: null, payment_date: null, payment_medium: null, payment_holder: null, card_expiry: null,
    vehicle_category: 'AUTOMOVIL', vehicle_type: 'TURISMO', vehicle_brand: 'Marca sintética', vehicle_model: 'Modelo A',
    vehicle_plate: '1234ABC', vehicle_vin: null, vehicle_color: 'BLANCO', km_pickup: 100, km_return: null,
    gps_data: null, validation_errors: [{ path: 'payment_type', code: 'required', message: 'Falta el tipo de pago' }],
    eligibility_errors: [], is_complete: false, is_eligible: true, is_officially_clear: false, ready_for_xml: false,
    official_check_status: 'not_checked', manual_fields: [], draft_version: 1, updated_at: '2026-08-28T00:00:00Z',
    reservation: { id: '21111111-1111-4111-8111-111111111111', external_reservation_id: '65001', cliente_nombre: 'Cliente', cliente_apellido: 'Sintético A' },
    holder: null, primary_driver: null, secondary_driver: null, pickup_location: null, return_location: null,
  },
  {
    id: '12222222-2222-4222-8222-222222222222', reservation_id: '22222222-2222-4222-8222-222222222222',
    external_booking_id: 65002, reference: 'SYNTHETIC-65002', status: 'pending_sync', contract_date: '2026-08-28',
    pickup_at: null, return_at: null, pickup_location_id: null, return_location_id: null, holder_profile_id: null,
    primary_driver_profile_id: null, secondary_driver_profile_id: null, payment_type: null, payment_date: null,
    payment_medium: null, payment_holder: null, card_expiry: null, vehicle_category: null, vehicle_type: null,
    vehicle_brand: null, vehicle_model: null, vehicle_plate: null, vehicle_vin: null, vehicle_color: null,
    km_pickup: null, km_return: null, gps_data: null, validation_errors: [], eligibility_errors: [{ code: 'not_in_rently_intersection', message: 'Pendiente de revalidación Rently' }],
    is_complete: false, is_eligible: false, is_officially_clear: false, ready_for_xml: false, official_check_status: 'not_checked',
    manual_fields: [], draft_version: 1, updated_at: '2026-08-28T00:00:00Z',
    reservation: { id: '22222222-2222-4222-8222-222222222222', external_reservation_id: '65002', cliente_nombre: 'Cliente', cliente_apellido: 'Sintético B' },
    holder: null, primary_driver: null, secondary_driver: null, pickup_location: null, return_location: null,
  },
];

function Fixture() {
  const [selected, setSelected] = useState<SesContractDraft | null>(() => window.location.search.includes('dialog=1') ? FIXTURE_DRAFTS[0] : null);
  return <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Fixture visual aislada · sin conexión de datos</p><h1 className="text-3xl font-bold">SES.HOSPEDAJES</h1><p className="mt-1 text-sm text-slate-500">Datos exclusivamente sintéticos. Esta página no importa autenticación, Supabase ni el cliente API.</p></header>
      <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-sm text-slate-500">Total filtrado</p><p className="text-2xl font-bold">367</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-slate-500">Incompletos</p><p className="text-2xl font-bold text-amber-700">339</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-slate-500">Pendientes SES</p><p className="text-2xl font-bold text-blue-700">2</p></CardContent></Card></div>
      <SesPagination total={367} offset={0} limit={50} pageCount={50} onOffsetChange={() => undefined} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><Table><TableHeader><TableRow><TableHead>Reserva</TableHead><TableHead>Cliente</TableHead><TableHead>Vehículo</TableHead><TableHead>Estado</TableHead><TableHead className="sticky right-0 z-10 bg-slate-50 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">Acción</TableHead></TableRow></TableHeader><TableBody>{FIXTURE_DRAFTS.map((draft) => <TableRow key={draft.id}><TableCell className="font-semibold">#{draft.reference}</TableCell><TableCell>{draft.reservation?.cliente_nombre} {draft.reservation?.cliente_apellido}</TableCell><TableCell>{draft.vehicle_plate || 'Pendiente'}</TableCell><TableCell>{draft.status === 'incomplete' ? 'Incompleto' : 'Pendiente Rently'}</TableCell><TableCell className="sticky right-0 z-10 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"><SesDraftActions draft={draft} canExport schemaMigrationRequired={false} checking={false} onCheck={() => setSelected(draft)} onComplete={() => undefined} /></TableCell></TableRow>)}</TableBody></Table></div>
      <p className="flex items-center gap-2 text-xs text-slate-500"><FileCode2 className="h-4 w-4" />La fixture prueba que «Comprobar SES» aparece antes de «Completar» en ambos estados.</p>
    </div>
    <SesOfficialCheckDialog draft={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} checking={false} onCheck={async () => undefined} />
  </main>;
}

createRoot(document.getElementById('ses-fixture-root')!).render(<Fixture />);

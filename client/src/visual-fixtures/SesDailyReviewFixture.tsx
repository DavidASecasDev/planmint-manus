import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarRange, CheckCircle2, FileCheck2, PlusCircle, RefreshCw } from 'lucide-react';
import '@/index.css';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const rows = [
  {
    id: 'synthetic-5578', reference: 5578, status: 'Entrega acreditada', statusClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    planned: '2026-09-09T18:00:00', delivery: '2026-09-09T17:56:39.05', dropoff: '2026-09-10T18:00:00',
    evidence: 'Delivery 5578.pdf', generated: '2026-09-09T17:56:39', missing: 0, conflicts: 0, next: 'Completar campos SES pendientes', current: null, proposed: null,
  },
  {
    id: 'synthetic-5582', reference: 5582, status: 'Contradicción acreditada', statusClass: 'border-rose-200 bg-rose-50 text-rose-700',
    planned: '2026-09-10T10:00:00', delivery: '2026-09-09T23:05:19.643', dropoff: '2026-09-10T17:30:11.73',
    evidence: 'Delivery 5582.pdf', generated: '2026-09-09T23:05:19', missing: 1, conflicts: 4, next: 'Resolver documento, nombre y permiso sin sobrescribir manuales', current: 'Permiso actual: P•••••A', proposed: 'Propuesto: LIC-••••',
  },
];

function Fixture() {
  const interactionMode = new URLSearchParams(window.location.search).get('interaction') ?? 'manual';
  const [historicalFrom, setHistoricalFrom] = useState('2026-09-08');
  const [historicalTo, setHistoricalTo] = useState('2026-09-14');
  const [refreshCount, setRefreshCount] = useState(0);
  const [submittedRange, setSubmittedRange] = useState<string | null>(null);
  const historicalFromRef = useRef<HTMLInputElement>(null);
  const historicalToRef = useRef<HTMLInputElement>(null);
  const submitVisibleRange = () => setSubmittedRange(JSON.stringify({
    dateFrom: historicalFromRef.current?.value || historicalFrom,
    dateTo: historicalToRef.current?.value || historicalTo,
  }));

  useEffect(() => {
    const mode = interactionMode;
    if (!mode || !historicalFromRef.current) return;
    const input = historicalFromRef.current;
    const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    input.focus();
    if (setNativeValue) setNativeValue.call(input, '2026-09-09');
    else input.value = '2026-09-09';
    if (mode === 'keyboard') {
      setHistoricalFrom('2026-09-09');
    } else if (mode === 'fill') {
      setHistoricalFrom(input.value);
    }
    input.blur();
    window.setTimeout(() => {
      setRefreshCount((value) => value + 1);
      window.setTimeout(submitVisibleRange, 0);
    }, 0);
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-[1450px] overflow-hidden rounded-2xl border bg-white shadow-xl">
        <header className="bg-slate-950 px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Fixture visual aislada · solo datos sintéticos</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold"><FileCheck2 className="h-6 w-6" />Revisar entregas</h1>
          <p className="mt-1 text-sm text-slate-300">Lotes persistentes de entregas. Las fechas previstas y reales permanecen separadas.</p>
        </header>
        <div className="space-y-5 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto]">
            <div className="space-y-2"><Label>Revisión diaria</Label><Input type="date" value="2026-09-09" readOnly /></div>
            <Button className="self-end"><RefreshCw className="mr-2 h-4 w-4" />Revisar ahora</Button>
            <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label>Histórico desde</Label><Input ref={historicalFromRef} type="date" value={historicalFrom} onChange={(event) => setHistoricalFrom(event.currentTarget.value)} onInput={(event) => setHistoricalFrom(event.currentTarget.value)} onBlur={(event) => setHistoricalFrom(event.currentTarget.value)} /></div><div className="space-y-2"><Label>Hasta</Label><Input ref={historicalToRef} type="date" value={historicalTo} onChange={(event) => setHistoricalTo(event.currentTarget.value)} onInput={(event) => setHistoricalTo(event.currentTarget.value)} onBlur={(event) => setHistoricalTo(event.currentTarget.value)} /></div></div>
            <Button variant="outline" className="self-end" onClick={submitVisibleRange}><CalendarRange className="mr-2 h-4 w-4" />Iniciar histórico</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600"><Button size="sm" variant="ghost" onClick={() => setRefreshCount((value) => value + 1)}>Simular refresco de datos</Button><span>Interacción: {interactionMode}</span><span>Refrescos: {refreshCount}</span><span data-testid="range-result">Rango enviado: {submittedRange ?? 'pendiente'}</span></div>
          <div className="grid gap-3 sm:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Candidatas conocidas</p><p className="text-2xl font-bold">103</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-emerald-700">Entrega acreditada</p><p className="text-2xl font-bold text-emerald-800">1</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-amber-700">Pendientes</p><p className="text-2xl font-bold text-amber-800">102</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-rose-700">Errores</p><p className="text-2xl font-bold text-rose-800">0</p></CardContent></Card></div>
          <div><p className="break-all font-mono text-xs text-slate-600"><span className="font-sans font-medium">ID de lote:</span> fixture-401e92af-c590-4968-bf44-8abf2a392605</p></div>
          <div className="space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Cobertura global confirmada</span><span>0%</span></div><Progress value={0} /><p className="text-xs text-slate-500">103/103 candidatas conocidas procesadas. Este recuento no representa el total global hasta confirmar todas las páginas, sedes y estados.</p></div>
          <Alert className="border-amber-200 bg-amber-50 text-amber-950"><RefreshCw className="h-4 w-4" /><AlertTitle>Cobertura todavía no confirmada</AlertTitle><AlertDescription>El último barrido acreditado era incremental y tenía ventana temporal filtrada. No se interpreta como ausencia de datos ni como revisión completa.</AlertDescription></Alert>
          <div className="overflow-x-auto rounded-xl border"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Reserva</TableHead><TableHead>Fechas</TableHead><TableHead>Evidencia</TableHead><TableHead>Faltantes / contradicciones</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><p className="font-semibold">#{row.reference}</p><Badge className={`${row.statusClass} hover:bg-inherit`}>{row.status}</Badge></TableCell><TableCell className="min-w-56"><p className="text-xs text-slate-500">Prevista</p><p className="font-mono text-xs">{row.planned}</p><p className="mt-2 text-xs text-slate-500">Entrega real</p><p className="font-mono text-xs font-semibold">{row.delivery}</p><p className="mt-2 text-xs text-slate-500">Devolución</p><p className="font-mono text-xs">{row.dropoff}</p></TableCell><TableCell className="min-w-52"><p className="font-medium">{row.evidence}</p><p className="font-mono text-xs text-slate-500">{row.generated}</p><div className="mt-2 flex gap-1"><Badge variant="outline">rently: consultada</Badge><Badge variant="outline">hubspot: propuesta</Badge></div>{row.current && <div className="mt-3 rounded-lg border bg-slate-50 p-2 text-left text-xs"><p><span className="text-slate-500">Actual:</span> {row.current}</p><p className="mt-1"><span className="text-slate-500">Propuesta:</span> {row.proposed}</p><p className="mt-1 text-slate-500">Destino: conductor principal · permiso</p></div>}</TableCell><TableCell className="min-w-64"><p className={row.missing ? 'font-medium text-amber-700' : 'text-slate-400'}>Faltantes: {row.missing}</p><p className={row.conflicts ? 'font-medium text-rose-700' : 'text-slate-400'}>Contradicciones abiertas: {row.conflicts}</p>{row.conflicts > 0 && <p className="mt-1 text-xs text-rose-600">No estará Listo para XML hasta resolverlas.</p>}<p className="mt-2 text-xs text-slate-500">Siguiente: {row.next}</p></TableCell><TableCell className="min-w-56"><div className="flex flex-col items-stretch gap-2"><Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4 w-4" />Añadir dato encontrado</Button><Button size="sm" variant="outline"><FileCheck2 className="mr-2 h-4 w-4" />Acreditar justificante</Button>{row.conflicts > 0 && <Button size="sm">Resolver contradicción</Button>}</div></TableCell></TableRow>)}</TableBody></Table></div>
          <p className="text-xs text-slate-500">Esta pantalla no consulta Supabase, Rently, HubSpot ni respond.io. No contiene PII ni ejecuta operaciones reales.</p>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('ses-daily-review-fixture-root')!).render(<Fixture />);

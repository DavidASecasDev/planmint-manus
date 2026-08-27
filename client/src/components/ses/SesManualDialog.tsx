import {
  AlertTriangle, ArrowRight, BookOpen, CheckCircle2, CloudDownload,
  FileCheck2, FileCode2, Hand, Info, RefreshCw, ShieldCheck, UploadCloud,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SES_AUTOMATIC_DATA, SES_GOLDEN_RULES, SES_MANUAL_DATA, SES_MANUAL_STATUSES,
  SES_MANUAL_STEPS,
} from '@/lib/sesManual';

const STEP_ICONS = [ShieldCheck, RefreshCw, FileCheck2, Hand, FileCode2, UploadCloud, CheckCircle2];

const STATUS_TONES = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  orange: 'border-orange-200 bg-orange-50 text-orange-800',
} as const;

function DataList({ items, automatic }: { items: string[]; automatic: boolean }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
          {automatic
            ? <CloudDownload className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            : <Hand className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
          <p className="text-sm leading-5 text-slate-700">{item}</p>
        </div>
      ))}
    </div>
  );
}

export function SesManualDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-5xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-5 text-white sm:px-7">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2 text-amber-300">
              <BookOpen className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Manual operativo</span>
            </div>
            <DialogTitle className="text-xl text-white sm:text-2xl">Cómo funciona SES.HOSPEDAJES</DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-6 text-slate-300">
              Guía exacta para preparar contratos, completar únicamente las excepciones, generar el XML,
              subirlo manualmente y registrar el resultado oficial sin duplicados.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="h-[calc(92vh-154px)]">
          <div className="space-y-5 p-4 sm:p-7">
            <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-[auto_1fr]">
              <Info className="h-5 w-5 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-950">La idea en una línea</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Rently aporta lo que conoce; PlanMint conserva las correcciones manuales y valida;
                  el empleado completa solo lo realmente pendiente; SES.HOSPEDAJES decide la aceptación final.
                </p>
              </div>
            </div>

            <Tabs defaultValue="workflow" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-slate-100 p-1">
                <TabsTrigger value="workflow" className="py-2 text-xs sm:text-sm">Paso a paso</TabsTrigger>
                <TabsTrigger value="data" className="py-2 text-xs sm:text-sm">Datos</TabsTrigger>
                <TabsTrigger value="states" className="py-2 text-xs sm:text-sm">Estados y seguridad</TabsTrigger>
              </TabsList>

              <TabsContent value="workflow" className="mt-5">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                  <span>Rently</span><ArrowRight className="h-3.5 w-3.5" /><span>Preparar</span>
                  <ArrowRight className="h-3.5 w-3.5" /><span>Completar</span>
                  <ArrowRight className="h-3.5 w-3.5" /><span>XML</span>
                  <ArrowRight className="h-3.5 w-3.5" /><span>Portal</span>
                  <ArrowRight className="h-3.5 w-3.5" /><span>Conciliar</span>
                </div>
                <Accordion type="multiple" defaultValue={['step-1', 'step-2']} className="space-y-2">
                  {SES_MANUAL_STEPS.map((step, index) => {
                    const Icon = STEP_ICONS[index];
                    return (
                      <AccordionItem key={step.number} value={`step-${step.number}`} className="rounded-xl border border-slate-200 px-4 data-[state=open]:bg-slate-50/70">
                        <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">{step.number}</span>
                          <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-slate-900"><Icon className="hidden h-4 w-4 text-amber-700 sm:block" />{step.title}</span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4 pl-0 text-sm leading-6 text-slate-600 sm:pl-11">
                          <p>{step.action}</p>
                          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Resultado:</strong> {step.result}</span></div>
                          {step.warning && <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{step.warning}</span></div>}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </TabsContent>

              <TabsContent value="data" className="mt-5 space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <section>
                    <div className="mb-3 flex items-center gap-2"><CloudDownload className="h-5 w-5 text-emerald-700" /><h3 className="font-semibold text-slate-900">PlanMint intenta importar</h3></div>
                    <DataList items={SES_AUTOMATIC_DATA} automatic />
                  </section>
                  <section>
                    <div className="mb-3 flex items-center gap-2"><Hand className="h-5 w-5 text-amber-700" /><h3 className="font-semibold text-slate-900">Requiere confirmación humana</h3></div>
                    <DataList items={SES_MANUAL_DATA} automatic={false} />
                  </section>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
                  <strong>Prioridad de datos:</strong> corrección manual protegida → perfil SES reutilizable → detalle de Rently → reserva sincronizada → campo pendiente.
                  Si Rently devuelve un valor vacío, nunca borra un dato detallado o manual ya guardado.
                </div>
              </TabsContent>

              <TabsContent value="states" className="mt-5 space-y-6">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[116px_1fr] gap-3 bg-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[150px_1fr_1fr]">
                    <span>Estado</span><span>Qué significa</span><span className="hidden sm:block">Qué hacer</span>
                  </div>
                  {SES_MANUAL_STATUSES.map((item) => (
                    <div key={item.status} className="grid grid-cols-[116px_1fr] gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:grid-cols-[150px_1fr_1fr]">
                      <Badge variant="outline" className={`h-fit w-fit ${STATUS_TONES[item.tone]}`}>{item.status}</Badge>
                      <div><p className="text-slate-700">{item.meaning}</p><p className="mt-1 text-xs font-medium text-slate-500 sm:hidden">Acción: {item.nextAction}</p></div>
                      <p className="hidden text-slate-600 sm:block">{item.nextAction}</p>
                    </div>
                  ))}
                </div>

                <Separator />
                <section>
                  <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-900" /><h3 className="font-semibold text-slate-900">Cinco reglas que no deben romperse</h3></div>
                  <div className="grid gap-2">
                    {SES_GOLDEN_RULES.map((rule, index) => (
                      <div key={rule} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-5 text-slate-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span>
                        <span>{rule}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

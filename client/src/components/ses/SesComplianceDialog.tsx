import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileCode2, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SesSettings } from '@/types/sesHospedajes';

type InventoryItem = {
  officialCommunicationCode: string;
  officialLotCode?: string | null;
  reference: string;
  contractDate: string;
  vehiclePlate?: string | null;
  status: 'active' | 'accepted' | 'annulled' | 'error';
};

export function SesComplianceDialog({
  open, onOpenChange, settings, inventoryTotal, uploadingXsd, importingInventory,
  onUploadXsd, onImportInventory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SesSettings | null;
  inventoryTotal: number;
  uploadingXsd: boolean;
  importingInventory: boolean;
  onUploadXsd: (input: { fileName: string; version: string; content: string }) => Promise<unknown>;
  onImportInventory: (input: { sourceDate?: string; items: InventoryItem[] }) => Promise<unknown>;
}) {
  const [xsdFile, setXsdFile] = useState<File | null>(null);
  const [xsdVersion, setXsdVersion] = useState(settings?.official_xsd_version ?? '');
  const [sourceDate, setSourceDate] = useState('');
  const [inventoryJson, setInventoryJson] = useState('[]');
  const [parseError, setParseError] = useState('');

  const uploadXsd = async () => {
    if (!xsdFile || !xsdVersion.trim()) return;
    await onUploadXsd({ fileName: xsdFile.name, version: xsdVersion.trim(), content: await xsdFile.text() });
    setXsdFile(null);
  };

  const importInventory = async () => {
    setParseError('');
    try {
      const parsed = JSON.parse(inventoryJson) as InventoryItem[];
      if (!Array.isArray(parsed)) throw new Error('El contenido debe ser una lista JSON');
      if (parsed.length === 0) throw new Error('La lista está vacía. No se reemplaza ni se borra el historial existente.');
      await onImportInventory({ ...(sourceDate ? { sourceDate } : {}), items: parsed });
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'JSON no válido');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-700" />Control previo oficial</DialogTitle>
          <DialogDescription>Consulta la validación disponible y añade evidencia oficial sin sustituir el historial. Nunca introduzcas credenciales del portal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">1. Validación del XML</h3><p className="text-sm text-slate-500">Sin XSD cargado se aplica el contrato estructural derivado de la plantilla oficial y las Instrucciones v1.2.0. Un XSD oficial auténtico y completo tiene siempre precedencia.</p></div>
              {settings?.official_xsd_hash ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
            </div>
            {settings?.official_xsd_hash && <p className="rounded-md bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-800">v{settings.official_xsd_version} · {settings.official_xsd_hash.slice(0, 16)}…</p>}
            {!settings?.official_xsd_hash && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Modo estructural oficial</AlertTitle><AlertDescription>Se comprueban namespace, orden, cardinalidades y formatos del contrato local. No se inventa ningún XSD.</AlertDescription></Alert>}
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-2"><Label>Archivo .xsd oficial</Label><Input type="file" accept=".xsd,application/xml,text/xml" onChange={(event) => setXsdFile(event.target.files?.[0] ?? null)} /></div>
              <div className="space-y-2"><Label>Versión oficial</Label><Input value={xsdVersion} onChange={(event) => setXsdVersion(event.target.value)} placeholder="Ej. 1.2.0" /></div>
            </div>
            <Button variant="outline" disabled={!xsdFile || !xsdVersion.trim() || uploadingXsd} onClick={uploadXsd}>
              {uploadingXsd ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCode2 className="mr-2 h-4 w-4" />}Guardar XSD
            </Button>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">2. Evidencia oficial aditiva</h3><p className="text-sm text-slate-500">Opcionalmente añade comunicaciones activas, aceptadas, anuladas o con error. Nunca reemplaza registros previos ni acredita una cobertura global.</p></div>
              <ShieldCheck className="h-5 w-5 text-blue-700" />
            </div>
            <p className="text-xs text-slate-500">Evidencias registradas: {inventoryTotal}. Cada contrato debe comprobarse por su identidad exacta antes de quedar listo.</p>
            <div className="space-y-2"><Label>Fecha de la fuente (opcional)</Label><Input type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} /></div>
            <div className="space-y-2">
              <Label>Lista JSON exportada o transcrita del portal</Label>
              <Textarea className="min-h-36 font-mono text-xs" value={inventoryJson} onChange={(event) => setInventoryJson(event.target.value)} placeholder='[{"officialCommunicationCode":"…","reference":"4130","contractDate":"2026-08-18","vehiclePlate":"0000AAA","status":"accepted"}]' />
            </div>
            {parseError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No se puede importar</AlertTitle><AlertDescription>{parseError}</AlertDescription></Alert>}
            <Button variant="outline" disabled={importingInventory} onClick={importInventory}>
              {importingInventory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Añadir evidencia
            </Button>
          </section>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

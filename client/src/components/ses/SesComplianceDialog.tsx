import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileCode2, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  onImportInventory: (input: { sourceDate: string; confirmedComplete: true; items: InventoryItem[] }) => Promise<unknown>;
}) {
  const [xsdFile, setXsdFile] = useState<File | null>(null);
  const [xsdVersion, setXsdVersion] = useState(settings?.official_xsd_version ?? '');
  const [sourceDate, setSourceDate] = useState('');
  const [inventoryJson, setInventoryJson] = useState('[]');
  const [confirmedComplete, setConfirmedComplete] = useState(false);
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
      await onImportInventory({ sourceDate, confirmedComplete: true, items: parsed });
      setConfirmedComplete(false);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'JSON no válido');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-700" />Control previo oficial</DialogTitle>
          <DialogDescription>Configura las dos comprobaciones obligatorias antes del XML. Nunca introduzcas credenciales del portal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">1. XSD oficial</h3><p className="text-sm text-slate-500">Cada XML se valida contra este archivo antes de crear el lote.</p></div>
              {settings?.official_xsd_hash ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
            </div>
            {settings?.official_xsd_hash && <p className="rounded-md bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-800">v{settings.official_xsd_version} · {settings.official_xsd_hash.slice(0, 16)}…</p>}
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
              <div><h3 className="font-semibold">2. Inventario oficial</h3><p className="text-sm text-slate-500">Importa las comunicaciones ya activas, aceptadas, anuladas o con error para impedir duplicados.</p></div>
              {settings?.official_inventory_confirmed_at ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
            </div>
            <p className="text-xs text-slate-500">Registradas: {inventoryTotal}. Última cobertura confirmada: {settings?.official_inventory_source_date ?? 'sin confirmar'}.</p>
            <div className="space-y-2"><Label>Fecha de cobertura del portal</Label><Input type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} /></div>
            <div className="space-y-2">
              <Label>Lista JSON exportada o transcrita del portal</Label>
              <Textarea className="min-h-36 font-mono text-xs" value={inventoryJson} onChange={(event) => setInventoryJson(event.target.value)} placeholder='[{"officialCommunicationCode":"…","reference":"4130","contractDate":"2026-08-18","vehiclePlate":"0000AAA","status":"accepted"}]' />
            </div>
            {parseError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No se puede importar</AlertTitle><AlertDescription>{parseError}</AlertDescription></Alert>}
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmedComplete} onCheckedChange={(value) => setConfirmedComplete(value === true)} /><span>Confirmo que la lista cubre todas las comunicaciones oficiales conocidas hasta la fecha indicada.</span></label>
            <Button variant="outline" disabled={!sourceDate || !confirmedComplete || importingInventory} onClick={importInventory}>
              {importingInventory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar y confirmar cobertura
            </Button>
          </section>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

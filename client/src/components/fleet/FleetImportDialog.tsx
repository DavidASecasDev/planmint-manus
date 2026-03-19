import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

function parseDate(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'number' && value > 1 && value < 100000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().split('T')[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return undefined;
}

interface FleetImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATE_COLUMNS = ['Matrícula', 'Modelo', 'Categoría', 'Proveedor', 'Nº Contrato', 'Fecha Inicio (YYYY-MM-DD)', 'Fecha Fin (YYYY-MM-DD)', 'Nº Bastidor', 'Marca', 'Color', 'Combustible', 'Motor', 'CV'];

export function FleetImportDialog({ open, onOpenChange }: FleetImportDialogProps) {
  const { importVehicles } = useFleetVehicles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flota');
    XLSX.writeFile(wb, 'plantilla_flota.xlsx');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<any>(ws);
        setPreview(data);
      } catch {
        toast.error('Error al leer el archivo');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const vehicles = preview.map(row => ({
        matricula: String(row['Matrícula'] || row['matricula'] || '').trim(),
        modelo: String(row['Modelo'] || row['modelo'] || '').trim() || undefined,
        categoria: String(row['Categoría'] || row['categoria'] || '').trim() || undefined,
        proveedor: String(row['Proveedor'] || row['proveedor'] || '').trim() || undefined,
        numero_contrato: String(row['Nº Contrato'] || row['numero_contrato'] || '').trim() || undefined,
        fecha_inicio_contrato: parseDate(row['Fecha Inicio (YYYY-MM-DD)'] || row['fecha_inicio_contrato']),
        fecha_fin_contrato: parseDate(row['Fecha Fin (YYYY-MM-DD)'] || row['fecha_fin_contrato']),
        numero_bastidor: String(row['Nº Bastidor'] || row['numero_bastidor'] || '').trim() || undefined,
        marca: String(row['Marca'] || row['marca'] || '').trim() || undefined,
        color: String(row['Color'] || row['color'] || '').trim() || undefined,
        combustible: String(row['Combustible'] || row['combustible'] || '').trim() || undefined,
        motor: String(row['Motor'] || row['motor'] || '').trim() || undefined,
        cv: row['CV'] || row['cv'] ? Number(row['CV'] || row['cv']) : undefined,
      })).filter(v => v.matricula);

      await importVehicles.mutateAsync(vehicles);
      setPreview([]);
      onOpenChange(false);
    } catch {
      // error handled in hook
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Flota desde Excel/CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Descargar Plantilla
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Seleccionar Archivo
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
          </div>

          {preview.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{preview.length} vehículos encontrados</p>
              <div className="rounded-lg border border-border overflow-x-auto max-h-60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {Object.keys(preview[0]).map(key => (
                        <th key={key} className="p-2 text-left font-medium text-muted-foreground">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="p-2">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 10 && <p className="text-xs text-muted-foreground">...y {preview.length - 10} más</p>}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setPreview([]); onOpenChange(false); }}>Cancelar</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? 'Importando...' : `Importar ${preview.length} Vehículos`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

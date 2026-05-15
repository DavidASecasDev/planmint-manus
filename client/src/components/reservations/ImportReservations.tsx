import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReservations } from '@/hooks/useReservations';
import { CreateReservationData, ExcelRow, ImportPreview } from '@/types/reservations';
import { cn } from '@/lib/utils';

// Mapeo de columnas Excel a campos de la base de datos
const COLUMN_MAPPING: Record<string, keyof CreateReservationData | null> = {
  'Id': 'external_reservation_id',
  'Columna 1': null, // Fecha/hora combinada - se parsea por separado
  'Fecha de Creación': 'fecha_creacion',
  'Estado': 'estado',
  'Nombre del Cliente': 'cliente_nombre',
  'Apellido del Cliente': 'cliente_apellido',
  'Cliente': null, // Nombre completo - se parsea por separado
  'Precio': 'precio',
  'Modelo': 'modelo',
  'Auto': 'auto',
  'Desde': 'desde',
  'Hasta': 'hasta',
  'Fecha de Devolución': 'devolucion',
  'Duración': 'duracion',
  'Lugar de Entrega': 'lugar_entrega',
  'Lugar de Devolución': 'lugar_devolucion',
  'Lugar': null, // Lugar genérico - se parsea por separado
  'Categoría': 'categoria',
  'A Pedido': 'a_pedido',
  'Origen de reserva': 'origen_reserva',
  'Creado por': 'creado_por',
  'Tarifa': 'tarifa',
  'Acuerdo Comercial': 'acuerdo_comercial',
  'Acuerdo de precios': 'acuerdo_precios',
  'Mail': 'email',
  'Teléfono': 'telefono',
  'Tipo Documento Cliente': 'tipo_documento_cliente',
  'Documento Cliente': 'documento_cliente',
  'Código': 'codigo',
  'Reserva': 'external_reservation_id', // Alias alternativo
  'reserv': 'external_reservation_id', // Otro alias
};

function parseDate(value: string | number | null | undefined): string | undefined {
  if (!value) return undefined;
  
  // Si es un número (serial date de Excel)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0).toISOString();
    }
  }
  
  // Si es Date object (xlsx con cellDates: true)
  if (value !== null && typeof value === 'object' && 'getTime' in (value as object)) {
    return (value as unknown as Date).toISOString();
  }
  
  // Si es string, intentar parsear
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    
    // Formato "DD/MM/YYYY HH:MM AM/PM" (ej: "08/11/2025 09:30 AM")
    const dateTimeMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (dateTimeMatch) {
      const [, day, month, year, hourStr, minute, ampm] = dateTimeMatch;
      let hour = parseInt(hourStr, 10);
      
      // Convertir 12h a 24h
      if (ampm) {
        const isPM = ampm.toUpperCase() === 'PM';
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
      }
      
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, parseInt(minute));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
    
    // Formato DD/MM/YYYY sin hora
    const dateOnlyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateOnlyMatch) {
      const [, day, month, year] = dateOnlyMatch;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
    
    // Intentar parse nativo como último recurso
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  return undefined;
}

function parsePrice(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  
  if (typeof value === 'number') return value;
  
  // Limpiar string: quitar símbolos de moneda, espacios, convertir coma a punto
  const cleaned = value.toString()
    .replace(/[€$\s]/g, '')
    .replace(',', '.');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

function mapRowToData(row: Record<string, unknown>): CreateReservationData | null {
  const externalId = row['Id']?.toString().trim();
  if (!externalId) return null;
  
  // Ignorar reservas canceladas
  const estado = row['Estado']?.toString().trim().toLowerCase();
  if (estado === 'cancelada' || estado === 'cancelado') return null;
  
  const data: CreateReservationData = {
    external_reservation_id: externalId,
  };
  
  for (const [excelCol, dbField] of Object.entries(COLUMN_MAPPING)) {
    if (!dbField || dbField === 'external_reservation_id') continue;
    
    const value = row[excelCol];
    if (value === null || value === undefined || value === '') continue;
    
    if (dbField === 'fecha_creacion' || dbField === 'desde' || dbField === 'hasta' || dbField === 'devolucion') {
      const parsed = parseDate(value as string | number);
      if (parsed) (data as unknown as Record<string, unknown>)[dbField] = parsed;
    } else if (dbField === 'precio') {
      const parsed = parsePrice(value as string | number);
      if (parsed !== undefined) data.precio = parsed;
    } else {
      (data as unknown as Record<string, unknown>)[dbField] = value.toString().trim();
    }
  }
  
  return data;
}

export function ImportReservations() {
  const { checkDuplicates, importReservations } = useReservations();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    duplicates: number;
    errors: { row: CreateReservationData; error: string }[];
  } | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setPreview(null);
    setImportResult(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
      
      // Mapear filas (incluyendo flag de canceladas)
      const mappedRows: { row: Record<string, unknown>; data: CreateReservationData | null; cancelled: boolean }[] = rows.map(row => {
        const estado = (row['Estado'] as string)?.toString().trim().toLowerCase();
        const isCancelled = estado === 'cancelada' || estado === 'cancelado';
        return {
          row,
          data: isCancelled ? null : mapRowToData(row),
          cancelled: isCancelled,
        };
      });
      
      // Obtener IDs para verificar duplicados
      const externalIds = mappedRows
        .filter(r => r.data)
        .map(r => r.data?.external_reservation_id ?? '');
      
      const existingIds = await checkDuplicates(externalIds);
      
      // Construir preview
      const previewResult: ImportPreview & { canceladas: number } = {
        total: rows.length,
        nuevas: 0,
        duplicadas: 0,
        errores: 0,
        canceladas: 0,
        rows: [],
      };
      
      for (const { row, data, cancelled } of mappedRows) {
        if (cancelled) {
          previewResult.canceladas++;
          previewResult.rows.push({
            row: row as unknown as ExcelRow,
            status: 'cancelled' as 'new' | 'duplicate' | 'error',
          });
        } else if (!data) {
          previewResult.errores++;
          previewResult.rows.push({
            row: row as unknown as ExcelRow,
            status: 'error',
            error: 'Falta el campo Id',
          });
        } else if (existingIds.has(data.external_reservation_id)) {
          previewResult.duplicadas++;
          previewResult.rows.push({
            row: row as unknown as ExcelRow,
            status: 'duplicate',
          });
        } else {
          previewResult.nuevas++;
          previewResult.rows.push({
            row: row as unknown as ExcelRow,
            status: 'new',
          });
        }
      }
      
      setPreview(previewResult);
    } catch (error) {
      console.error('Error parsing Excel:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [checkDuplicates]);

  const handleImport = async () => {
    if (!preview) return;
    
    setIsProcessing(true);
    
    try {
      // Solo importar las nuevas
      const newRows = preview.rows
        .filter(r => r.status === 'new')
        .map(r => mapRowToData(r.row as unknown as Record<string, unknown>))
        .filter((d): d is CreateReservationData => d !== null);
      
      const result = await importReservations.mutateAsync(newRows);
      setImportResult(result);
      setPreview(null);
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImport = () => {
    setPreview(null);
    setImportResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Reservas
        </CardTitle>
        <CardDescription>
          Sube un archivo Excel exportado desde tu software de reservas. 
          Solo se insertarán las reservas nuevas (nunca se modifican existentes).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resultado de importación */}
        {importResult && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium">Importación completada</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">
                  {importResult.inserted}
                </Badge>
                <span>insertadas</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {importResult.duplicates}
                </Badge>
                <span>duplicadas</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">
                  {importResult.errors.length}
                </Badge>
                <span>errores</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={resetImport}>
              Importar otro archivo
            </Button>
          </div>
        )}

        {/* Preview */}
        {preview && !importResult && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold">{preview.total}</div>
                  <div className="text-muted-foreground">total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{preview.nuevas}</div>
                  <div className="text-muted-foreground">nuevas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{preview.duplicadas}</div>
                  <div className="text-muted-foreground">duplicadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">{(preview as typeof preview & { canceladas?: number }).canceladas || 0}</div>
                  <div className="text-muted-foreground">canceladas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{preview.errores}</div>
                  <div className="text-muted-foreground">errores</div>
                </div>
              </div>
            </div>

            {/* Preview list */}
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                  {preview.rows.slice(0, 50).map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 text-xs rounded",
                      item.status === 'new' && "bg-green-500/10",
                      item.status === 'duplicate' && "bg-amber-500/10",
                      item.status === 'error' && "bg-red-500/10",
                      item.status === ('cancelled' as typeof item.status) && "bg-muted/50 opacity-50"
                    )}
                  >
                    {item.status === 'new' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    {item.status === 'duplicate' && <AlertCircle className="h-3 w-3 text-amber-500" />}
                    {item.status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
                    {item.status === ('cancelled' as typeof item.status) && <XCircle className="h-3 w-3 text-muted-foreground" />}
                    <span className="font-mono">{item.row.Id || '—'}</span>
                    <span className="text-muted-foreground">
                      {item.row['Nombre del Cliente']} {item.row['Apellido del Cliente']}
                    </span>
                    {item.status === 'duplicate' && (
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        Ya existe
                      </Badge>
                    )}
                    {item.status === ('cancelled' as typeof item.status) && (
                      <Badge variant="outline" className="text-[10px] ml-auto text-muted-foreground">
                        Cancelada
                      </Badge>
                    )}
                    {item.error && (
                      <span className="text-red-500 ml-auto">{item.error}</span>
                    )}
                  </div>
                ))}
                {preview.rows.length > 50 && (
                  <div className="text-center text-xs text-muted-foreground py-2">
                    ... y {preview.rows.length - 50} más
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetImport} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isProcessing || preview.nuevas === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Importar ${preview.nuevas} nuevas`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* File input */}
        {!preview && !importResult && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="excel-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="excel-upload"
              className={cn(
                "flex flex-col items-center gap-2 cursor-pointer",
                isProcessing && "cursor-wait opacity-50"
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {isProcessing ? 'Procesando...' : 'Click para seleccionar un archivo Excel'}
              </span>
              <span className="text-xs text-muted-foreground">
                Formatos soportados: .xlsx, .xls
              </span>
            </label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

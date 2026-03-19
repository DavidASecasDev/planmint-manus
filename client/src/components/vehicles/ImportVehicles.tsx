import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useVehicleImport } from '@/hooks/useVehicleImport';
import { parseVehicleExcel, downloadTemplate, type VehicleImportRow, type ParsedVehicleImport } from '@/lib/vehicleImportTemplate';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportVehiclesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportVehicles({ open, onOpenChange }: ImportVehiclesProps) {
  const { validateImport, importVehicles, isImporting } = useVehicleImport();
  
  const [parsedData, setParsedData] = useState<ParsedVehicleImport[] | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Por favor, sube un archivo Excel (.xlsx o .xls)');
      return;
    }

    setIsValidating(true);
    try {
      const rows = await parseVehicleExcel(file);
      
      if (rows.length === 0) {
        toast.error('El archivo está vacío o no tiene el formato correcto');
        setIsValidating(false);
        return;
      }

      const validated = await validateImport(rows);
      setParsedData(validated);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Error al procesar el archivo');
    } finally {
      setIsValidating(false);
    }
  }, [validateImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // Reset input
  }, [handleFile]);

  const handleImport = () => {
    if (!parsedData) return;
    
    const validRows = parsedData.filter(r => r.status !== 'error');
    if (validRows.length === 0) {
      toast.error('No hay vehículos válidos para importar');
      return;
    }

    importVehicles(parsedData, {
      onSuccess: () => {
        setParsedData(null);
        onOpenChange(false);
      },
    });
  };

  const handleClose = () => {
    if (!isImporting) {
      setParsedData(null);
      onOpenChange(false);
    }
  };

  const summary = parsedData ? {
    new: parsedData.filter(r => r.status === 'new').length,
    update: parsedData.filter(r => r.status === 'update').length,
    error: parsedData.filter(r => r.status === 'error').length,
    total: parsedData.length,
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Vehículos</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel con los vehículos a importar. Los vehículos existentes se actualizarán.
          </DialogDescription>
        </DialogHeader>

        {!parsedData ? (
          <div className="space-y-4">
            {/* Download template */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Plantilla de importación</p>
                  <p className="text-xs text-muted-foreground">
                    Descarga la plantilla con las columnas requeridas
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>

            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                isValidating && "opacity-50 pointer-events-none"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {isValidating ? (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Procesando archivo...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arrastra tu archivo Excel aquí o
                  </p>
                  <label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleInputChange}
                    />
                    <Button variant="secondary" size="sm" asChild>
                      <span className="cursor-pointer">Seleccionar archivo</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Resumen:</span>
              <Badge variant="default" className="bg-primary">
                {summary?.new} nuevos
              </Badge>
              <Badge variant="secondary">
                {summary?.update} actualizaciones
              </Badge>
              {summary?.error ? (
                <Badge variant="destructive">
                  {summary.error} errores
                </Badge>
              ) : null}
            </div>

            {/* Preview table */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Estado</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Ubicación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, idx) => (
                    <TableRow 
                      key={idx}
                      className={cn(
                        row.status === 'error' && "bg-destructive/10"
                      )}
                    >
                      <TableCell>
                        {row.status === 'new' && (
                          <Badge variant="default" className="bg-primary text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Nuevo
                          </Badge>
                        )}
                        {row.status === 'update' && (
                          <Badge variant="secondary" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Actualizar
                          </Badge>
                        )}
                        {row.status === 'error' && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{row.matricula}</TableCell>
                      <TableCell>{row.modelo || '-'}</TableCell>
                      <TableCell>{row.categoria || '-'}</TableCell>
                      <TableCell>
                        {row.status === 'error' ? (
                          <span className="text-destructive text-xs">{row.errorMessage}</span>
                        ) : (
                          row.ubicacion || '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancelar
          </Button>
          {parsedData && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setParsedData(null)}
                disabled={isImporting}
              >
                Volver
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isImporting || summary?.new === 0 && summary?.update === 0}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {(summary?.new || 0) + (summary?.update || 0)} vehículos
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

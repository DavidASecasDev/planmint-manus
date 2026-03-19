import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDamageCatalog } from '@/hooks/useDamageCatalog';
import { downloadDamageCatalogTemplate, parseExcelToCatalog } from '@/lib/damageCatalogTemplate';
import type { CatalogImportPreview, CatalogImportRow, DamageCatalogFormData } from '@/types/garatech';

interface ImportDamageCatalogProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function ImportDamageCatalog({ onComplete, onCancel }: ImportDamageCatalogProps) {
  const { checkExistingItems, importCatalog } = useDamageCatalog();
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    
    try {
      // Parse Excel
      const parsed = await parseExcelToCatalog(file);
      
      // Get names for duplicate check
      const names = parsed
        .filter(r => r.data?.name_es)
        .map(r => r.data!.name_es!);
      
      // Check existing
      const existing = await checkExistingItems(names);
      
      // Build preview rows
      const rows: CatalogImportRow[] = parsed.map(row => ({
        data: row.data,
        status: row.error 
          ? 'error' as const
          : existing.has(row.data?.name_es?.toLowerCase() || '')
            ? 'update' as const
            : 'new' as const,
        error: row.error || undefined,
      }));
      
      setPreview({
        total: rows.length,
        nuevos: rows.filter(r => r.status === 'new').length,
        actualizar: rows.filter(r => r.status === 'update').length,
        errores: rows.filter(r => r.status === 'error').length,
        rows,
      });
    } catch (error) {
      console.error('Error parsing file:', error);
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    
    setIsImporting(true);
    
    try {
      const validItems = preview.rows
        .filter(r => r.status !== 'error' && r.data)
        .map(r => r.data as Partial<DamageCatalogFormData>);
      
      await importCatalog.mutateAsync(validItems);
      onComplete?.();
    } finally {
      setIsImporting(false);
    }
  };

  const formatPrice = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '--';
    return `${value}€`;
  };

  const getStatusBadge = (status: CatalogImportRow['status']) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Nuevo</Badge>;
      case 'update':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"><RefreshCw className="h-3 w-3 mr-1" />Actualizar</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Catálogo de Daños
        </CardTitle>
        <CardDescription>
          Sube un archivo Excel con la lista de tipos de daño y precios por nivel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions & Download Template */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <p className="text-sm font-medium">Formato requerido:</p>
            <p className="text-xs text-muted-foreground">
              Columnas: Nombre ES, Nombre EN, Nivel 1-5, Categoría
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadDamageCatalogTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Descargar Plantilla
          </Button>
        </div>

        {/* File Upload */}
        {!preview && (
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Procesando archivo...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Arrastra o haz clic para subir</p>
                <p className="text-xs text-muted-foreground">Archivos .xlsx o .xls</p>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{preview.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{preview.nuevos}</p>
                <p className="text-xs text-green-600/70">Nuevos</p>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{preview.actualizar}</p>
                <p className="text-xs text-orange-600/70">Actualizar</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{preview.errores}</p>
                <p className="text-xs text-red-600/70">Errores</p>
              </div>
            </div>

            {/* Table */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Nivel 1</TableHead>
                    <TableHead className="text-right">Nivel 2</TableHead>
                    <TableHead className="text-right">Nivel 3</TableHead>
                    <TableHead className="text-right">Nivel 4</TableHead>
                    <TableHead className="text-right">Nivel 5</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, idx) => (
                    <TableRow key={idx} className={row.status === 'error' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium">
                        {row.data?.name_es || row.error}
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(row.data?.price_level_1)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.data?.price_level_2)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.data?.price_level_3)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.data?.price_level_4)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.data?.price_level_5)}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Warning */}
            {preview.actualizar > 0 && (
              <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Los items existentes con el mismo nombre serán actualizados con los nuevos precios
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setPreview(null);
                  onCancel?.();
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={isImporting || preview.total - preview.errores === 0}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {preview.total - preview.errores} items
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

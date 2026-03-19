import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, Trash2, RefreshCw, ExternalLink, Check, AlertCircle, Calculator, MapPin, Users, Car } from 'lucide-react';
import { useTransferDocuments } from '@/hooks/useTransferDocuments';
import type { TransferDocument, TransferDocumentType, ExtractedTransferItem } from '@/types/transfers';
import { cn } from '@/lib/utils';
import { calculateClientInvoice, formatCurrency } from '@/utils/transferCalculations';

interface TransferDocumentsSectionProps {
  requestId: string;
  documents: TransferDocument[];
  onApplyCost?: (cost: number, type: TransferDocumentType, items?: ExtractedTransferItem[]) => void;
  isApplyingCost?: boolean;
}

const DOC_TYPE_META: Record<TransferDocumentType, { label: string; color: string }> = {
  presupuesto: { label: 'Presupuesto', color: 'bg-secondary/50 text-secondary-foreground' },
  factura: { label: 'Factura', color: 'bg-primary/10 text-primary' },
};

export function TransferDocumentsSection({ requestId, documents, onApplyCost, isApplyingCost }: TransferDocumentsSectionProps) {
  const presupuestoInputRef = useRef<HTMLInputElement>(null);
  const facturaInputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument, deleteDocument, getDocumentUrl, retryAI, isUploading, isDeleting } = useTransferDocuments(requestId);

  const presupuesto = documents.find(d => d.document_type === 'presupuesto');
  const factura = documents.find(d => d.document_type === 'factura');

  const handleFileSelect = async (file: File, type: TransferDocumentType) => {
    await uploadDocument({ file, documentType: type });
  };

  const handleOpenDocument = async (doc: TransferDocument) => {
    const url = await getDocumentUrl(doc.storage_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const formatItemDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const getDetectedItems = (doc: TransferDocument): ExtractedTransferItem[] => {
    // Try detected_items first, then fall back to ai_raw_data.items
    if (doc.detected_items && doc.detected_items.length > 0) {
      return doc.detected_items;
    }
    if (doc.ai_raw_data?.items && doc.ai_raw_data.items.length > 0) {
      return doc.ai_raw_data.items;
    }
    return [];
  };

  const renderDocumentSlot = (
    type: TransferDocumentType,
    doc: TransferDocument | undefined,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const meta = DOC_TYPE_META[type];
    const detectedItems = doc ? getDetectedItems(doc) : [];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{meta.label}</span>
          </div>
          {!doc && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Subir
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelect(file, type);
              e.target.value = '';
            }
          }}
        />

        {doc && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className={cn('text-xs shrink-0', meta.color)}>
                  {meta.label}
                </Badge>
                <span className="text-sm truncate">{doc.file_name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenDocument(doc)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteDocument(doc)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* AI Status */}
            <div className="flex items-center gap-2 text-sm">
              {doc.ai_status === 'pending' && (
                <span className="text-muted-foreground">Pendiente de análisis</span>
              )}
              {doc.ai_status === 'processing' && (
                <span className="text-blue-600 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analizando...
                </span>
              )}
              {doc.ai_status === 'completed' && (
                <span className="text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Analizado
                </span>
              )}
              {doc.ai_status === 'failed' && (
                <div className="flex items-center gap-2">
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Error
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={() => retryAI(doc.id)}
                  >
                    <RefreshCw className="h-3 w-3" /> Reintentar
                  </Button>
                </div>
              )}
            </div>

            {/* Detected Data */}
            {doc.ai_status === 'completed' && (doc.detected_amount || doc.detected_provider || doc.detected_date) && (
              <div className="p-3 rounded bg-primary/5 border border-primary/20 space-y-3 text-sm">
                <p className="font-medium text-primary">Datos detectados:</p>
                <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                  {doc.detected_amount && (
                    <div>
                      <span className="text-xs text-muted-foreground/70">Importe:</span>
                      <p className="font-medium text-foreground">{formatCurrency(doc.detected_amount)}</p>
                    </div>
                  )}
                  {doc.detected_provider && (
                    <div>
                      <span className="text-xs text-muted-foreground/70">Proveedor:</span>
                      <p className="font-medium text-foreground">{doc.detected_provider}</p>
                    </div>
                  )}
                  {doc.detected_date && (
                    <div>
                      <span className="text-xs text-muted-foreground/70">Fecha:</span>
                      <p className="font-medium text-foreground">
                        {new Date(doc.detected_date).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Detected Items Preview */}
                {detectedItems.length > 0 && (
                  <div className="pt-2 border-t border-primary/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-primary" />
                      <p className="text-xs font-medium text-primary">
                        Trayectos detectados ({detectedItems.length}):
                      </p>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {detectedItems.map((item, i) => (
                        <div 
                          key={i} 
                          className="text-xs p-2 bg-background rounded border flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-muted-foreground shrink-0">
                              {formatItemDate(item.date)}
                            </span>
                            <span className="truncate">
                              {item.pickup_location || '?'} → {item.dropoff_location || '?'}
                            </span>
                            {item.pax_count && (
                              <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
                                <Users className="h-3 w-3" /> {item.pax_count}
                              </span>
                            )}
                            {item.vehicle_type && (
                              <span className="flex items-center gap-0.5 text-muted-foreground shrink-0 hidden sm:flex">
                                <Car className="h-3 w-3" /> {item.vehicle_type}
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-foreground shrink-0">
                            {item.amount ? formatCurrency(item.amount) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Se crearán {detectedItems.length} trayecto{detectedItems.length !== 1 ? 's' : ''} al aplicar
                    </p>
                  </div>
                )}

                {/* Apply Cost Button */}
                {doc.detected_amount && onApplyCost && (
                  <div className="pt-2 border-t border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        <p>Al aplicar se calculará:</p>
                        <p className="font-medium text-foreground">
                          Total cliente: {formatCurrency(calculateClientInvoice(doc.detected_amount).clientTotal)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onApplyCost(doc.detected_amount!, type, detectedItems.length > 0 ? detectedItems : undefined)}
                        disabled={isApplyingCost}
                        className="gap-2"
                      >
                        {isApplyingCost ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Calculator className="h-4 w-4" />
                        )}
                        {detectedItems.length > 0 ? 'Aplicar y Crear Items' : 'Aplicar Coste'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!doc && (
          <p className="text-sm text-muted-foreground">Sin documento</p>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {renderDocumentSlot('presupuesto', presupuesto, presupuestoInputRef)}
      {renderDocumentSlot('factura', factura, facturaInputRef)}
    </div>
  );
}
import { useState, useRef, useEffect } from 'react';
import { FileText, Upload, Trash2, ExternalLink, Loader2, ChevronDown, ChevronUp, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRepairInvoices } from '@/hooks/useRepairInvoices';
import { INVOICE_ITEM_CATEGORY_LABELS, type RepairInvoice, type InvoiceOCRStatus } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';

interface RepairInvoicesTabProps {
  repairId: string;
}

const OCR_STATUS_LABELS: Record<InvoiceOCRStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando con IA...',
  completed: 'Procesado',
  failed: 'Error al procesar',
};

const OCR_STATUS_COLORS: Record<InvoiceOCRStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function RepairInvoicesTab({ repairId }: RepairInvoicesTabProps) {
  const queryClient = useQueryClient();
  const { invoices, isLoading, totalAmount, uploadInvoice, deleteInvoice, getInvoiceUrl } = useRepairInvoices(repairId);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Polling for processing invoices - also refresh repairs for cost_final updates
  useEffect(() => {
    const hasProcessing = invoices.some(inv => inv.ocr_status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['repair-invoices', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
    }, 3000);

    return () => clearInterval(interval);
  }, [invoices, queryClient, repairId]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    
    const file = files[0];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return;
    }
    
    await uploadInvoice.mutateAsync({ file });
  };

  const handleViewInvoice = async (invoice: RepairInvoice) => {
    if (!invoice.storage_path) return;
    
    try {
      const url = await getInvoiceUrl(invoice.storage_path);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error getting invoice URL:', error);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '—';
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex items-center justify-between">
        <Button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadInvoice.isPending}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Subir Factura
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        
        {totalAmount > 0 && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Facturas</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalAmount)}</p>
          </div>
        )}
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay facturas adjuntas</p>
            <p className="text-sm mt-1">Sube facturas en PDF o imagen</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <Collapsible 
                open={expandedInvoices.has(invoice.id)}
                onOpenChange={() => toggleExpanded(invoice.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">
                          {invoice.invoice_number || invoice.file_name || 'Factura'}
                        </CardTitle>
                        <Badge className={`${OCR_STATUS_COLORS[invoice.ocr_status]} gap-1`}>
                          {invoice.ocr_status === 'processing' && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {invoice.ocr_status === 'completed' && (
                            <Sparkles className="h-3 w-3" />
                          )}
                          {invoice.ocr_status === 'failed' && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {OCR_STATUS_LABELS[invoice.ocr_status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {invoice.invoice_date && (
                          <span>
                            {format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: es })}
                          </span>
                        )}
                        {invoice.supplier_name && (
                          <span>{invoice.supplier_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</p>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {expandedInvoices.has(invoice.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* Invoice Items */}
                    {invoice.items && invoice.items.length > 0 ? (
                      <div className="border rounded-lg divide-y mt-2">
                        {invoice.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div className="flex-1">
                              <p>{item.description}</p>
                              {item.category && (
                                <p className="text-xs text-muted-foreground">
                                  {INVOICE_ITEM_CATEGORY_LABELS[item.category]}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(item.total_price)}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} x {formatCurrency(item.unit_price)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">
                        Sin líneas de detalle
                      </p>
                    )}

                    {/* Totals */}
                    <div className="mt-3 pt-3 border-t space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(invoice.subtotal_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IVA (21%)</span>
                        <span>{formatCurrency(invoice.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>{formatCurrency(invoice.total_amount)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      {invoice.storage_path && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Ver documento
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteInvoice.mutateAsync(invoice)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

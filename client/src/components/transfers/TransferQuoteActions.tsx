import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Download, Loader2, AlertCircle, Settings, ShieldAlert } from 'lucide-react';
import { useTransferQuotePdf, type PdfLanguage } from '@/hooks/useTransferQuotePdf';
import { useNavigate } from 'react-router-dom';
import { evaluateMarginAlert } from '@/utils/marginAlerts';
import { useMarginThresholds } from '@/hooks/useMarginThresholds';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/utils/transferCalculations';
import type { TransferRequest, TransferItem, PricingMode } from '@/types/transfers';

interface TransferQuoteActionsProps {
  request: TransferRequest;
  items: TransferItem[];
}

export function TransferQuoteActions({ request, items }: TransferQuoteActionsProps) {
  const { generateQuotePdf, generateInvoicePdf, isGenerating, settingsComplete, calculatePdfTotals } = useTransferQuotePdf();
  const navigate = useNavigate();
  const thresholds = useMarginThresholds();
  const { createNotification } = useNotifications();
  const { profile } = useAuth();
  const [language, setLanguage] = useState<PdfLanguage>('es');
  const [showLowMarginDialog, setShowLowMarginDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'quote' | 'invoice' | null>(null);

  const canGenerate = items.length > 0;

  // Use the same calculation as the PDF for consistency
  const pricingMode: PricingMode = request.pricing_mode || 'zone_tariff';
  const { total } = calculatePdfTotals(items, pricingMode);

  // Evaluate margin alert with configurable thresholds
  const marginAlert = evaluateMarginAlert(items, pricingMode, {
    danger: thresholds.danger,
    warning: thresholds.warning,
  });

  const sendLowMarginNotification = async (docType: 'quote' | 'invoice') => {
    try {
      const docName = docType === 'quote' ? 'presupuesto' : 'factura';
      const clientName = request.client_name || 'Sin nombre';
      await createNotification({
        user_id: profile?.id || '',
        title: `Alerta: ${docName} con margen bajo (${marginAlert.marginPercent}%) - ${clientName}`,
        body: `Se ha generado un ${docName} para "${clientName}" (Ref: ${request.request_number || request.id?.slice(0, 8)}) con un margen del ${marginAlert.marginPercent}% (umbral: ${thresholds.danger}%). Coste proveedor: ${formatCurrency(marginAlert.providerCost)}, Total cliente: ${formatCurrency(marginAlert.clientTotal)}.`,
        type: 'transfer_note',
        entity_type: 'transfer_request',
        entity_id: request.id || '',
      });
    } catch {
      // Notification failure should not block document generation
      console.error('Failed to send low margin notification');
    }
  };

  const handleGenerateQuote = () => {
    if (marginAlert.level === 'danger') {
      setPendingAction('quote');
      setShowLowMarginDialog(true);
      return;
    }
    generateQuotePdf(request, items, language);
  };

  const handleGenerateInvoice = () => {
    if (marginAlert.level === 'danger') {
      setPendingAction('invoice');
      setShowLowMarginDialog(true);
      return;
    }
    generateInvoicePdf(request, items, language);
  };

  const handleConfirmLowMargin = async () => {
    setShowLowMarginDialog(false);
    // Send notification to admin about low-margin document generation
    if (pendingAction) {
      await sendLowMarginNotification(pendingAction);
    }
    if (pendingAction === 'quote') {
      generateQuotePdf(request, items, language);
    } else if (pendingAction === 'invoice') {
      generateInvoicePdf(request, items, language);
    }
    setPendingAction(null);
  };

  const handleCancelLowMargin = () => {
    setShowLowMarginDialog(false);
    setPendingAction(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Documentos Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settingsComplete && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Configura los datos de facturación para generar documentos</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/settings?tab=transfers')}
                  className="ml-4 gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Configurar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!canGenerate && settingsComplete && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Añade trayectos para poder generar documentos
              </AlertDescription>
            </Alert>
          )}

          {/* Low margin warning in documents section */}
          {marginAlert.level === 'danger' && canGenerate && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                El margen es solo del {marginAlert.marginPercent}% (mínimo configurado: {thresholds.danger}%). 
                Se pedirá confirmación antes de generar documentos.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Idioma:</span>
            <Select value={language} onValueChange={(value: PdfLanguage) => setLanguage(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerateQuote}
              disabled={!canGenerate || !settingsComplete || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar Presupuesto
            </Button>
            
            <Button
              variant="outline"
              onClick={handleGenerateInvoice}
              disabled={!canGenerate || !settingsComplete || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar Factura
            </Button>
          </div>

          {total > 0 && (
            <p className="text-sm text-muted-foreground">
              Total a facturar: <span className="font-medium text-foreground">{formatCurrency(total)}</span>
              <span className="text-xs ml-1">(IVA incl.)</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Low margin confirmation dialog */}
      <AlertDialog open={showLowMarginDialog} onOpenChange={setShowLowMarginDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              Margen inferior al {thresholds.danger}%
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  El margen actual de esta solicitud es del <strong className="text-red-600">{marginAlert.marginPercent}%</strong>, 
                  por debajo del mínimo configurado del {thresholds.danger}%.
                </p>
                <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total cliente:</span>
                    <span className="font-medium">{formatCurrency(marginAlert.clientTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coste proveedor:</span>
                    <span className="font-medium">{formatCurrency(marginAlert.providerCost)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span>Margen bruto:</span>
                    <span className="font-medium text-red-600">{formatCurrency(marginAlert.internalMargin)}</span>
                  </div>
                </div>
                <p className="text-sm">
                  ¿Deseas continuar y generar el {pendingAction === 'quote' ? 'presupuesto' : 'factura'} con este margen?
                  <br />
                  <span className="text-muted-foreground text-xs">Se enviará una notificación al administrador.</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLowMargin}>
              Cancelar y revisar precios
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLowMargin}
              className="bg-red-600 hover:bg-red-700"
            >
              Generar igualmente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

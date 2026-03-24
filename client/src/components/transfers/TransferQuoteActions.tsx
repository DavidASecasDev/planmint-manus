import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, AlertCircle, Settings } from 'lucide-react';
import { useTransferQuotePdf, type PdfLanguage } from '@/hooks/useTransferQuotePdf';
import { useNavigate } from 'react-router-dom';
import type { TransferRequest, TransferItem, PricingMode } from '@/types/transfers';

interface TransferQuoteActionsProps {
  request: TransferRequest;
  items: TransferItem[];
}

export function TransferQuoteActions({ request, items }: TransferQuoteActionsProps) {
  const { generateQuotePdf, generateInvoicePdf, isGenerating, settingsComplete, calculatePdfTotals } = useTransferQuotePdf();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<PdfLanguage>('es');

  const canGenerate = items.length > 0;

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '0,00 €';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Use the same calculation as the PDF for consistency
  const pricingMode: PricingMode = request.pricing_mode || 'zone_tariff';
  const { total } = calculatePdfTotals(items, pricingMode);

  return (
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

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Idioma:</span>
          <Select value={language} onValueChange={(value: PdfLanguage) => setLanguage(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">🇪🇸 Español</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => generateQuotePdf(request, items, language)}
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
            onClick={() => generateInvoicePdf(request, items, language)}
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
  );
}

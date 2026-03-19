import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Upload, Trash2, FileText, Building2 } from 'lucide-react';
import { useTransferInvoiceSettings } from '@/hooks/useTransferInvoiceSettings';

export function TransferInvoiceSettings() {
  const { settings, isLoading, saveSettings, uploadLogo, deleteLogo, isSaving, isUploadingLogo } = useTransferInvoiceSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [quotePrefix, setQuotePrefix] = useState('PRE-');
  const [invoicePrefix, setInvoicePrefix] = useState('FAC-');
  const [footerText, setFooterText] = useState('');
  const [bankDetails, setBankDetails] = useState('');

  // Load existing settings
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || '');
      setTaxId(settings.tax_id || '');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setEmail(settings.email || '');
      setQuotePrefix(settings.quote_prefix || 'PRE-');
      setInvoicePrefix(settings.invoice_prefix || 'FAC-');
      setFooterText(settings.footer_text || '');
      setBankDetails(settings.bank_details || '');
    }
  }, [settings]);

  const handleSave = async () => {
    await saveSettings({
      company_name: companyName || null,
      tax_id: taxId || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      quote_prefix: quotePrefix,
      invoice_prefix: invoicePrefix,
      footer_text: footerText || null,
      bank_details: bankDetails || null,
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 2MB.');
        return;
      }
      await uploadLogo(file);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Datos de Facturación</CardTitle>
        </div>
        <CardDescription>
          Configura los datos que aparecerán en los presupuestos y facturas generados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo */}
        <div className="space-y-3">
          <Label>Logo de empresa</Label>
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <div className="relative">
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  className="h-16 w-auto max-w-[200px] object-contain rounded border bg-white p-1"
                />
              </div>
            ) : (
              <div className="h-16 w-32 rounded border border-dashed flex items-center justify-center bg-muted/30">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="gap-2"
              >
                {isUploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {settings?.logo_url ? 'Cambiar' : 'Subir logo'}
              </Button>
              {settings?.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteLogo()}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleFileSelect}
            />
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG o WEBP. Máximo 2MB.</p>
        </div>

        <Separator />

        {/* Fiscal data */}
        <div className="space-y-4">
          <h4 className="font-medium">Datos fiscales</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre comercial</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Tu Empresa SL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">CIF/NIF</Label>
              <Input
                id="taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="B12345678"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, CP, Ciudad"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email de facturación</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="facturacion@empresa.com"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Document numbering */}
        <div className="space-y-4">
          <h4 className="font-medium">Numeración de documentos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quotePrefix">Prefijo presupuestos</Label>
              <Input
                id="quotePrefix"
                value={quotePrefix}
                onChange={(e) => setQuotePrefix(e.target.value)}
                placeholder="PRE-"
              />
              <p className="text-xs text-muted-foreground">
                Ej: {quotePrefix}2026-0001
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoicePrefix">Prefijo facturas</Label>
              <Input
                id="invoicePrefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="FAC-"
              />
              <p className="text-xs text-muted-foreground">
                Ej: {invoicePrefix}2026-0001
              </p>
            </div>
          </div>
          {settings && (
            <p className="text-sm text-muted-foreground">
              Próximo presupuesto: #{settings.next_quote_number} · 
              Próxima factura: #{settings.next_invoice_number}
            </p>
          )}
        </div>

        <Separator />

        {/* Footer text */}
        <div className="space-y-4">
          <h4 className="font-medium">Textos personalizables</h4>
          <div className="space-y-2">
            <Label htmlFor="bankDetails">Datos bancarios</Label>
            <Textarea
              id="bankDetails"
              value={bankDetails}
              onChange={(e) => setBankDetails(e.target.value)}
              placeholder="IBAN: ES00 0000 0000 0000 0000 0000&#10;Banco: ..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerText">Pie de documento</Label>
            <Textarea
              id="footerText"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Gracias por confiar en nosotros..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

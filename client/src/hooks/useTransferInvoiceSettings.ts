/**
 * Stub for transfer invoice settings — company branding info for PDF generation.
 * Previously tied to pricing/invoicing, now just returns company metadata.
 */
export function useTransferInvoiceSettings() {
  const settings = {
    company_name: 'Azul Cars',
    logo_url: '',
    tax_id: '',
    phone: '',
    email: '',
    address: '',
    footer_text: '',
  };

  return { settings, isLoading: false };
}

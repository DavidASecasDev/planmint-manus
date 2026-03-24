import type { TransferRequest } from '@/types/transfers';

/**
 * Formats a number as a currency string for CSV (no symbol, comma as decimal for ES locale).
 */
function csvNumber(value: number | null | undefined): string {
  if (value == null) return '0';
  return value.toFixed(2).replace('.', ',');
}

/**
 * Escapes a CSV field value (wraps in quotes if it contains commas, quotes, or newlines).
 */
function escapeField(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const PRICING_MODE_LABELS: Record<string, string> = {
  zone_tariff: 'Tarifa por zona',
  provider_quote: 'Presupuesto proveedor',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_gestion: 'En gestión',
  presupuesto_enviado: 'Ppto. Enviado',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

/**
 * Generates a CSV string from an array of transfer requests.
 * Uses semicolon as delimiter for Excel compatibility in Spanish locale.
 */
export function generateTransfersCsv(requests: TransferRequest[]): string {
  const headers = [
    'Número',
    'Broker',
    'Cliente',
    'Estado',
    'Modo de precio',
    'Nº Trayectos',
    'Primera fecha',
    'Total cliente (€)',
    'Coste proveedor (€)',
    'Margen (€)',
    'Creado',
  ];

  const rows = requests.map(r => {
    const providerCost = r.provider_cost || 0;
    const clientTotal = r.total_amount || r.client_total || 0;
    const margin = clientTotal - providerCost;

    return [
      escapeField(r.request_number || ''),
      escapeField(r.broker_name || ''),
      escapeField(r.client_name || ''),
      escapeField(STATUS_LABELS[r.status] || r.status),
      escapeField(PRICING_MODE_LABELS[r.pricing_mode || 'zone_tariff'] || 'Zona'),
      String(r.items_count || 0),
      r.first_transfer_date || '',
      csvNumber(clientTotal),
      csvNumber(providerCost),
      csvNumber(margin),
      r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES') : '',
    ].join(';');
  });

  // Add totals row
  const totalClient = requests.reduce((sum, r) => sum + (r.total_amount || r.client_total || 0), 0);
  const totalProvider = requests.reduce((sum, r) => sum + (r.provider_cost || 0), 0);
  const totalMargin = totalClient - totalProvider;
  const totalItems = requests.reduce((sum, r) => sum + (r.items_count || 0), 0);

  const totalsRow = [
    escapeField('TOTALES'),
    '',
    '',
    '',
    '',
    String(totalItems),
    '',
    csvNumber(totalClient),
    csvNumber(totalProvider),
    csvNumber(totalMargin),
    '',
  ].join(';');

  // BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  return bom + [headers.join(';'), ...rows, '', totalsRow].join('\n');
}

/**
 * Downloads the CSV as a file.
 */
export function downloadTransfersCsv(requests: TransferRequest[], filename?: string): void {
  const csv = generateTransfersCsv(requests);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `transfers_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

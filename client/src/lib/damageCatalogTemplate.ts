import * as XLSX from 'xlsx';
import type { DamageCatalogFormData, DamageCategory } from '@/types/garatech';

// Template data with example items
const TEMPLATE_DATA = [
  {
    'Nombre ES': 'Daños leves por pieza',
    'Nombre EN': 'Slight damages per part',
    'Nivel 1': 300,
    'Nivel 2': 350,
    'Nivel 3': 400,
    'Nivel 4': 450,
    'Nivel 5': '',
    'Categoría': 'general',
  },
  {
    'Nombre ES': 'Daños medios por pieza',
    'Nombre EN': 'Medium damages per part',
    'Nivel 1': 450,
    'Nivel 2': 450,
    'Nivel 3': 500,
    'Nivel 4': 600,
    'Nivel 5': '',
    'Categoría': 'general',
  },
  {
    'Nombre ES': 'Daños fuertes por pieza',
    'Nombre EN': 'Heavy damages per part',
    'Nivel 1': 600,
    'Nivel 2': 700,
    'Nivel 3': 800,
    'Nivel 4': 950,
    'Nivel 5': '',
    'Categoría': 'general',
  },
  {
    'Nombre ES': 'Retrovisor exterior',
    'Nombre EN': 'External rear-view mirror',
    'Nivel 1': 300,
    'Nivel 2': 450,
    'Nivel 3': 600,
    'Nivel 4': 800,
    'Nivel 5': '',
    'Categoría': 'exterior',
  },
  {
    'Nombre ES': 'Ópticas delanteras',
    'Nombre EN': 'Headlights',
    'Nivel 1': 650,
    'Nivel 2': 1200,
    'Nivel 3': 1600,
    'Nivel 4': 1900,
    'Nivel 5': '',
    'Categoría': 'luces',
  },
];

export function generateDamageCatalogTemplate(): Blob {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_DATA);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Nombre ES
    { wch: 25 }, // Nombre EN
    { wch: 10 }, // Nivel 1
    { wch: 10 }, // Nivel 2
    { wch: 10 }, // Nivel 3
    { wch: 10 }, // Nivel 4
    { wch: 10 }, // Nivel 5
    { wch: 12 }, // Categoría
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
  
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadDamageCatalogTemplate(): void {
  const blob = generateDamageCatalogTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_catalogo_danos.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse price from Excel cell
function parsePrice(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return isNaN(num) || num < 0 ? undefined : num;
}

// Parse category from Excel cell
function parseCategory(value: unknown): DamageCategory {
  const valid: DamageCategory[] = ['general', 'exterior', 'interior', 'cristales', 'luces', 'neumaticos'];
  const cat = String(value || '').toLowerCase().trim();
  return valid.includes(cat as DamageCategory) ? cat as DamageCategory : 'general';
}

// Map Excel row to catalog item
export function mapRowToCatalogItem(row: Record<string, unknown>): {
  data: Partial<DamageCatalogFormData> | null;
  error: string | null;
} {
  const nameEs = row['Nombre ES']?.toString().trim();
  
  if (!nameEs) {
    return { data: null, error: 'Nombre ES es obligatorio' };
  }
  
  const price1 = parsePrice(row['Nivel 1']);
  if (price1 === undefined) {
    return { data: null, error: 'Nivel 1 es obligatorio' };
  }
  
  return {
    data: {
      name_es: nameEs,
      name_en: row['Nombre EN']?.toString().trim() || undefined,
      price_level_1: price1,
      price_level_2: parsePrice(row['Nivel 2']),
      price_level_3: parsePrice(row['Nivel 3']),
      price_level_4: parsePrice(row['Nivel 4']),
      price_level_5: parsePrice(row['Nivel 5']),
      category: parseCategory(row['Categoría']),
    },
    error: null,
  };
}

// Parse Excel file to catalog items
export async function parseExcelToCatalog(file: File): Promise<{
  data: Partial<DamageCatalogFormData> | null;
  error: string | null;
}[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
  
  return rows.map(mapRowToCatalogItem);
}

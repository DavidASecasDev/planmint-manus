import * as XLSX from 'xlsx';

export interface VehicleImportRow {
  matricula: string;
  modelo?: string;
  categoria?: string;
  ubicacion?: string;
}

export interface ParsedVehicleImport extends VehicleImportRow {
  status: 'new' | 'update' | 'error';
  errorMessage?: string;
  existingVehicleId?: string;
}

export const VEHICLE_IMPORT_COLUMNS = [
  { key: 'matricula', label: 'Matrícula', required: true },
  { key: 'modelo', label: 'Modelo', required: false },
  { key: 'categoria', label: 'Categoría', required: false },
  { key: 'ubicacion', label: 'Ubicación', required: false },
];

export function generateVehicleTemplate(): Blob {
  const headers = VEHICLE_IMPORT_COLUMNS.map(col => col.label);
  
  const exampleData = [
    headers,
    ['7130NCM', 'Citroën C3', 'CDMR', 'Aeropuerto'],
    ['3902MWM', 'Peugeot 208', 'EBMR', 'Oficina Central'],
    ['1234ABC', 'Seat Ibiza', 'ECMR', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(exampleData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Matrícula
    { wch: 20 }, // Modelo
    { wch: 12 }, // Categoría
    { wch: 20 }, // Ubicación
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vehículos');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function parseVehicleExcel(file: File): Promise<VehicleImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header mapping
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { 
          defval: '' 
        });

        const vehicles: VehicleImportRow[] = jsonData.map(row => {
          // Find the matricula column (case insensitive)
          const matriculaKey = Object.keys(row).find(k => 
            k.toLowerCase() === 'matrícula' || k.toLowerCase() === 'matricula'
          );
          const modeloKey = Object.keys(row).find(k => 
            k.toLowerCase() === 'modelo'
          );
          const categoriaKey = Object.keys(row).find(k => 
            k.toLowerCase() === 'categoría' || k.toLowerCase() === 'categoria'
          );
          const ubicacionKey = Object.keys(row).find(k => 
            k.toLowerCase() === 'ubicación' || k.toLowerCase() === 'ubicacion'
          );

          return {
            matricula: (matriculaKey ? row[matriculaKey] : '').toString().trim().toUpperCase(),
            modelo: modeloKey ? row[modeloKey]?.toString().trim() : undefined,
            categoria: categoriaKey ? row[categoriaKey]?.toString().trim().toUpperCase() : undefined,
            ubicacion: ubicacionKey ? row[ubicacionKey]?.toString().trim() : undefined,
          };
        }).filter(v => v.matricula); // Filter out empty rows

        resolve(vehicles);
      } catch (error) {
        reject(new Error('Error al leer el archivo Excel'));
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadTemplate() {
  const blob = generateVehicleTemplate();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_vehiculos.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

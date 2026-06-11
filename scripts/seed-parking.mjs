import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'https://exayzwdudssyegxjiyrk.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('No SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const sb = createClient(url, key);
const organizationId = 'a23a0d42-5af7-4cda-9955-569c10cc6714'; // Azul Cars

async function main() {
  // Check if zones already exist
  const { data: existing } = await sb
    .from('parking_zones')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log('Parking ya configurado. Eliminando datos existentes para re-seed...');
    // Delete existing spots and zones
    await sb.from('parking_spots').delete().eq('organization_id', organizationId);
    await sb.from('parking_zones').delete().eq('organization_id', organizationId);
    console.log('Datos anteriores eliminados.');
  }

  // Create zones
  const zoneDefinitions = [
    { name: 'Zona Principal', description: 'Plazas 1-43 (área derecha)', color: '#10B981', sort_order: 1 },
    { name: 'Zona Central', description: 'Plazas 44-69 (columnas centrales)', color: '#3B82F6', sort_order: 2 },
    { name: 'Zona Lateral', description: 'Plazas 70-95 (pares de columnas)', color: '#8B5CF6', sort_order: 3 },
    { name: 'Zona Exterior', description: 'Plazas 96-110 (columna izquierda)', color: '#F59E0B', sort_order: 4 },
    { name: 'Sucios', description: 'Vehículos pendientes de limpieza', color: '#EF4444', sort_order: 5 },
  ];

  const { data: createdZones, error: zoneErr } = await sb
    .from('parking_zones')
    .insert(zoneDefinitions.map(z => ({ ...z, organization_id: organizationId })))
    .select();

  if (zoneErr || !createdZones) {
    console.error('Error creando zonas:', zoneErr?.message);
    process.exit(1);
  }

  console.log(`✓ ${createdZones.length} zonas creadas`);

  // Map zone names to IDs
  const zoneMap = new Map(createdZones.map(z => [z.name, z.id]));

  // Define spots for each zone based on the real layout
  const spotDefinitions = [
    {
      zone: 'Zona Principal',
      spots: [
        // Row 1: 1-11
        ...Array.from({ length: 11 }, (_, i) => ({ number: i + 1, row: 0, col: i })),
        // Row 2: 12-19
        ...Array.from({ length: 8 }, (_, i) => ({ number: i + 12, row: 1, col: i })),
        // Row 3: 20-27
        ...Array.from({ length: 8 }, (_, i) => ({ number: i + 20, row: 2, col: i })),
        // Row 4: 28-35
        ...Array.from({ length: 8 }, (_, i) => ({ number: i + 28, row: 3, col: i })),
        // Row 5: 36-43
        ...Array.from({ length: 8 }, (_, i) => ({ number: i + 36, row: 4, col: i })),
      ],
    },
    {
      zone: 'Zona Central',
      spots: [
        // Left column: 44,46,48,50,52,54,56,58,60,62,64,66,68
        ...[44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68].map((n, i) => ({ number: n, row: i, col: 0 })),
        // Right column: 45,47,49,51,53,55,57,59,61,63,65,67,69
        ...[45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69].map((n, i) => ({ number: n, row: i, col: 1 })),
      ],
    },
    {
      zone: 'Zona Lateral',
      spots: [
        // Left column: 70,72,74,76,78,80,82,84,86,88,90,92,94
        ...[70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94].map((n, i) => ({ number: n, row: i, col: 0 })),
        // Right column: 71,73,75,77,79,81,83,85,87,89,91,93,95
        ...[71, 73, 75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95].map((n, i) => ({ number: n, row: i, col: 1 })),
      ],
    },
    {
      zone: 'Zona Exterior',
      spots: Array.from({ length: 15 }, (_, i) => ({ number: 96 + i, row: i, col: 0 })),
    },
  ];

  // Insert all spots
  const allSpots = [];
  for (const def of spotDefinitions) {
    const zoneId = zoneMap.get(def.zone);
    if (!zoneId) { console.error(`Zone not found: ${def.zone}`); continue; }
    for (const s of def.spots) {
      allSpots.push({
        organization_id: organizationId,
        zone_id: zoneId,
        spot_number: s.number,
        label: `${s.number}`,
        grid_row: s.row,
        grid_col: s.col,
        status: 'free',
      });
    }
  }

  const { error: spotsErr } = await sb.from('parking_spots').insert(allSpots);
  if (spotsErr) {
    console.error('Error creando plazas:', spotsErr.message);
    process.exit(1);
  }

  console.log(`✓ ${allSpots.length} plazas creadas`);
  console.log('');
  console.log('Resumen:');
  for (const def of spotDefinitions) {
    console.log(`  - ${def.zone}: ${def.spots.length} plazas`);
  }
  console.log(`  - Sucios: zona creada (sin plazas numeradas)`);
  console.log('');
  console.log('✓ Parking seed completado exitosamente');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

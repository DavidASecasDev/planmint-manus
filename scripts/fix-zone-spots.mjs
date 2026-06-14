import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

// Target spot counts per zone
const TARGET_COUNTS = {
  'Zona 1': 10,
  'Zona 2': 16,
  'Zona 3': 16,
  'Zona 4': 13,
  'Zona 5': 13,
  'Zona 6': 13,
  'Zona 7': 13,
  'Zona 8': 15,
};

async function main() {
  // Get all zones
  const { data: zones, error: zErr } = await sb
    .from('parking_zones')
    .select('id, name')
    .order('sort_order');
  
  if (zErr) { console.error('Error fetching zones:', zErr); process.exit(1); }
  console.log('Current zones:', zones.map(z => z.name).join(', '));

  for (const zone of zones) {
    const target = TARGET_COUNTS[zone.name];
    if (!target) {
      console.log(`  Skipping ${zone.name} (no target defined)`);
      continue;
    }

    // Get current spots for this zone
    const { data: spots, error: sErr } = await sb
      .from('parking_spots')
      .select('id, spot_number, status')
      .eq('zone_id', zone.id)
      .order('spot_number');
    
    if (sErr) { console.error(`Error fetching spots for ${zone.name}:`, sErr); continue; }
    
    const currentCount = spots.length;
    console.log(`  ${zone.name}: ${currentCount} spots → target ${target}`);

    if (currentCount > target) {
      // Need to remove spots - remove from the end, preferring 'libre' spots
      const toRemove = currentCount - target;
      // Sort: libre spots at the end first (so we remove those)
      const sortedForRemoval = [...spots].sort((a, b) => {
        if (a.status === 'libre' && b.status !== 'libre') return 1;
        if (a.status !== 'libre' && b.status === 'libre') return -1;
        return b.spot_number - a.spot_number; // higher numbers first
      });
      
      const idsToRemove = sortedForRemoval.slice(0, toRemove).map(s => s.id);
      console.log(`    Removing ${toRemove} spots (IDs: ${idsToRemove.join(', ')})`);
      
      const { error: delErr } = await sb
        .from('parking_spots')
        .delete()
        .in('id', idsToRemove);
      
      if (delErr) console.error(`    Error removing spots:`, delErr);
      else console.log(`    ✓ Removed ${toRemove} spots`);
      
    } else if (currentCount < target) {
      // Need to add spots
      const toAdd = target - currentCount;
      const maxSpotNum = spots.length > 0 ? Math.max(...spots.map(s => s.spot_number)) : 0;
      
      const newSpots = [];
      for (let i = 1; i <= toAdd; i++) {
        newSpots.push({
          zone_id: zone.id,
          spot_number: maxSpotNum + i,
          status: 'libre',
        });
      }
      
      console.log(`    Adding ${toAdd} spots (numbers ${maxSpotNum + 1} to ${maxSpotNum + toAdd})`);
      
      const { error: insErr } = await sb
        .from('parking_spots')
        .insert(newSpots);
      
      if (insErr) console.error(`    Error adding spots:`, insErr);
      else console.log(`    ✓ Added ${toAdd} spots`);
      
    } else {
      console.log(`    ✓ Already correct`);
    }
  }

  // Now renumber all spots sequentially within each zone
  console.log('\nRenumbering spots sequentially...');
  for (const zone of zones) {
    if (!TARGET_COUNTS[zone.name]) continue;
    
    const { data: spots } = await sb
      .from('parking_spots')
      .select('id, spot_number')
      .eq('zone_id', zone.id)
      .order('spot_number');
    
    if (!spots) continue;
    
    for (let i = 0; i < spots.length; i++) {
      const expectedNum = i + 1;
      if (spots[i].spot_number !== expectedNum) {
        await sb
          .from('parking_spots')
          .update({ spot_number: expectedNum })
          .eq('id', spots[i].id);
      }
    }
    console.log(`  ${zone.name}: renumbered ${spots.length} spots (1-${spots.length})`);
  }

  // Final verification
  console.log('\n=== Final Verification ===');
  for (const zone of zones) {
    const { count } = await sb
      .from('parking_spots')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', zone.id);
    
    const { count: freeCount } = await sb
      .from('parking_spots')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', zone.id)
      .eq('status', 'libre');
    
    console.log(`  ${zone.name}: ${count} total, ${freeCount} libres`);
  }
}

main().catch(console.error);

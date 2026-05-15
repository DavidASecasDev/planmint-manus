import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function enableRealtime() {
  // 1. Check tables are accessible
  const { data: d1, error: e1 } = await supabase.from('en_camino_tracking').select('id').limit(1);
  console.log('en_camino_tracking accessible:', e1 ? `ERROR: ${e1.message}` : 'OK');

  const { data: d2, error: e2 } = await supabase.from('location_history').select('id').limit(1);
  console.log('location_history accessible:', e2 ? `ERROR: ${e2.message}` : 'OK');

  // 2. Enable realtime publication for the tables via SQL
  // This adds the tables to the supabase_realtime publication
  const tables = ['en_camino_tracking', 'location_history'];
  
  for (const table of tables) {
    try {
      // First try to add to the existing publication
      const { error } = await supabase.rpc('exec_sql', {
        query: `ALTER PUBLICATION supabase_realtime ADD TABLE public.${table};`
      });
      
      if (error) {
        console.log(`RPC exec_sql for ${table}:`, error.message);
        // Try alternative: direct REST call
      } else {
        console.log(`Realtime enabled for ${table} via RPC`);
      }
    } catch (err) {
      console.log(`Error enabling realtime for ${table}:`, err.message);
    }
  }

  // 3. Test subscription
  console.log('\nTesting realtime subscription...');
  const channel = supabase.channel('test-realtime-check');
  
  channel.on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'en_camino_tracking' 
  }, (payload) => {
    console.log('Realtime event:', payload.eventType);
  });

  const status = await new Promise((resolve) => {
    channel.subscribe((st) => {
      console.log('Channel status:', st);
      resolve(st);
    });
    setTimeout(() => resolve('timeout'), 8000);
  });

  console.log('Subscription result:', status);
  
  await supabase.removeChannel(channel);
  
  if (status === 'SUBSCRIBED') {
    console.log('\n✅ Supabase Realtime is working! Subscriptions will receive push events.');
  } else {
    console.log('\n⚠️  Subscription status:', status);
    console.log('You may need to enable Realtime in the Supabase Dashboard:');
    console.log('  Database > Replication > Add tables: en_camino_tracking, location_history');
  }
  
  process.exit(0);
}

enableRealtime().catch(console.error);

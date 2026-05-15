import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRealtimeEvents() {
  let gotEvent = false;
  
  const channel = supabase.channel('insert-test-v2');
  
  channel.on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'en_camino_tracking' 
  }, (payload) => {
    console.log('GOT REALTIME EVENT:', payload.eventType, JSON.stringify(payload.new).slice(0, 100));
    gotEvent = true;
  });

  await new Promise(r => {
    channel.subscribe((st) => {
      console.log('Subscribed:', st);
      r();
    });
  });

  // Wait for subscription to stabilize
  await new Promise(r => setTimeout(r, 2000));
  console.log('Inserting test record...');

  const { data, error } = await supabase.from('en_camino_tracking').insert({
    reservation_id: '00000000-0000-0000-0000-000000000001',
    operation_type: 'entrega',
    en_camino_at: new Date().toISOString(),
    destination_address: 'TEST REALTIME - DELETE ME'
  }).select().single();

  console.log('Insert:', error ? `ERROR: ${error.message}` : `OK id=${data.id.slice(0,8)}`);

  // Wait for event
  await new Promise(r => setTimeout(r, 4000));

  if (gotEvent) {
    console.log('\n✅ REALTIME EVENTS ARE WORKING! Push events received.');
  } else {
    console.log('\n❌ No realtime event received. Publication may not be properly enabled.');
  }

  // Clean up
  if (data?.id) {
    await supabase.from('en_camino_tracking').delete().eq('id', data.id);
    console.log('Cleaned up test record');
  }

  await supabase.removeChannel(channel);
  process.exit(0);
}

testRealtimeEvents().catch(console.error);

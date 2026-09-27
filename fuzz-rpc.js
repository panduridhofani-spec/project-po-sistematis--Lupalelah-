const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const env = envContent.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
  }, {});

  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  const destNames = [
    'p_receiving_shift_number', 
    'p_destination_shift_number', 
    'p_receiving_shift', 
    'p_destination_shift',
    'p_target_shift_number'
  ];
  const sourceNames = [
    'p_source_shift_number', 
    'p_source_shift', 
    'p_shift_number'
  ];

  for (const src of sourceNames) {
    for (const dest of destNames) {
      const args = {
        p_operational_date: '2026-09-22',
        p_items: [],
      };
      args[src] = 1;
      args[dest] = 2;

      const { data, error } = await supabase.rpc('create_urgent_po', args);
      
      if (error && error.message.includes('Could not find the function')) {
        // signature mismatch, ignore
      } else {
        console.log(`FOUND CORRECT SIGNATURE! source: ${src}, dest: ${dest}`);
        console.log('Result:', error ? error.message : 'Success');
        return;
      }
    }
  }
  
  // What if it's missing p_items? Or named differently?
  console.log('No permutation found. Trying without p_items...');
  const res = await supabase.rpc('create_urgent_po', {
    p_operational_date: '2026-09-22',
    p_source_shift_number: 1,
    p_receiving_shift_number: 2
  });
  console.log(res.error ? res.error.message : 'Success');
}

main().catch(console.error);

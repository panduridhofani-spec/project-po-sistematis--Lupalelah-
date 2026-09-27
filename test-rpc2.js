const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const env = envContent.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
  }, {});

  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const res = await fetch(url + '/rest/v1/', { 
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Accept': 'application/openapi+json' } 
  });
  const data = await res.json();
  
  console.log('Available RPCs:');
  const rpcs = Object.keys(data.paths || {}).filter(p => p.startsWith('/rpc/'));
  console.log(rpcs.join('\n'));
  
  const urgentPo = rpcs.find(p => p.includes('create_urgent_po'));
  if (urgentPo) {
    console.log('\nDefinition for', urgentPo);
    console.log(JSON.stringify(data.paths[urgentPo], null, 2));
  }
}

main().catch(console.error);

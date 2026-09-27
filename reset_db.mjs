import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const targetDate = '2026-09-23';
  console.log(`Resetting stock_takings and regular_pos for date: ${targetDate}...`);

  // Delete Stock Takings
  const { error: stockError } = await supabase
    .from('stock_takings')
    .delete()
    .eq('operational_date', targetDate);

  if (stockError) console.error('Error deleting stock takings:', stockError);
  else console.log('Successfully deleted stock takings for ' + targetDate);

  // Delete Regular POs
  const { error: poError } = await supabase
    .from('regular_pos')
    .delete()
    .eq('operational_date', targetDate);

  if (poError) console.error('Error deleting regular POs:', poError);
  else console.log('Successfully deleted regular POs for ' + targetDate);
}

run();

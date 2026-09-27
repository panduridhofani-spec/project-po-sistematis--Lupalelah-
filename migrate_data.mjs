import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

// Init Supabase
const supabase = createClient(envVars['EXPO_PUBLIC_SUPABASE_URL'], envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY']);

// Init Firebase
const firebaseConfig = {
  apiKey: envVars['EXPO_PUBLIC_FIREBASE_API_KEY'],
  authDomain: envVars['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'],
  projectId: envVars['EXPO_PUBLIC_FIREBASE_PROJECT_ID'],
  storageBucket: envVars['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: envVars['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
  appId: envVars['EXPO_PUBLIC_FIREBASE_APP_ID']
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  console.log('Starting migration...');

  // 1. Migrate Categories
  console.log('Fetching categories from Supabase...');
  const { data: categories } = await supabase.from('categories').select('*');
  for (const cat of categories || []) {
    await setDoc(doc(db, 'categories', cat.id), cat);
  }
  console.log(`Migrated ${categories?.length || 0} categories.`);

  // 2. Migrate Products
  console.log('Fetching products from Supabase...');
  const { data: products } = await supabase.from('products').select('*');
  for (const prod of products || []) {
    await setDoc(doc(db, 'products', prod.id), prod);
  }
  console.log(`Migrated ${products?.length || 0} products.`);

  // 3. Migrate Users (Profiles)
  console.log('Fetching profiles from Supabase...');
  const { data: profiles } = await supabase.from('profiles').select('*');
  for (const prof of profiles || []) {
    await setDoc(doc(db, 'users', prof.id), prof);
  }
  console.log(`Migrated ${profiles?.length || 0} user profiles.`);

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);

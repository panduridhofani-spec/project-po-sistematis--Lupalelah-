import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);

async function seed() {
  console.log('Seeding Firebase...');

  // Create Users
  const users = [
    { email: 'leader@cafe.com', pass: 'password123', role: 'LEADER_BARISTA', name: 'Leader Barista', activeShift: 1 },
    { email: 'logistik@cafe.com', pass: 'password123', role: 'LOGISTICS', name: 'Tim Logistik', activeShift: null }
  ];

  for (const u of users) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, u.email, u.pass);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        id: userCredential.user.uid,
        full_name: u.name,
        role: u.role,
        active: true,
        activeShift: u.activeShift
      });
      console.log(`Created user ${u.email}`);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log(`User ${u.email} already exists.`);
      } else {
        console.error(e);
      }
    }
  }

  // Create Categories
  const catId = 'cat-1';
  await setDoc(doc(db, 'categories', catId), {
    id: catId,
    name: 'Bahan Pokok'
  });

  // Create Products
  const products = [
    { id: 'prod-1', category_id: catId, name: 'Beras', safety_stock: 5, unit: 'kg', active: true },
    { id: 'prod-2', category_id: catId, name: 'Gula', safety_stock: 5, unit: 'kg', active: true },
    { id: 'prod-3', category_id: catId, name: 'Minyak Goreng', safety_stock: 5, unit: 'liter', active: true }
  ];

  for (const p of products) {
    await setDoc(doc(db, 'products', p.id), p);
  }
  console.log('Seeded products.');
  
  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(console.error);

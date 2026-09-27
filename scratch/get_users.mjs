import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

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

async function run() {
  const users = await getDocs(collection(db, 'users'));
  users.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  process.exit(0);
}

run();

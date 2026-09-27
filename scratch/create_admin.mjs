import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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

async function createAdmin() {
  console.log('Creating Admin Account...');
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, 'admin@lups.com', 'admin123');
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      id: userCredential.user.uid,
      full_name: 'Master Admin',
      role: 'ADMIN',
      active: true,
      activeShift: null
    });
    console.log('Created user admin@lups.com');
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log('User admin@lups.com already exists. Maybe wrong password or it was created previously.');
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}

createAdmin().catch(console.error);

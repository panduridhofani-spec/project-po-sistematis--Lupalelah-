import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);

async function run() {
  const email = 'adminlupalelah@gmail.com';
  const pass = 'admin123';
  
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, 'users', cred.user.uid), {
      id: cred.user.uid,
      full_name: 'Admin Baru',
      email: email,
      role: 'MASTER_ADMIN',
      active: true,
      activeShift: null
    });
    console.log('Created adminlupalelah@gmail.com successfully!');
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists. Attempting sign-in...');
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, 'users', cred.user.uid), {
          id: cred.user.uid,
          full_name: 'Admin Baru',
          email: email,
          role: 'MASTER_ADMIN',
          active: true,
          activeShift: null
        }, { merge: true });
        console.log('Updated admin profile successfully!');
      } catch(err) {
        console.error('Failed to sign in:', err);
      }
    } else {
      console.error('Error creating admin:', e);
    }
  }
  process.exit(0);
}
run();

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  const newEmail = 'leaderlupalelah@gmail.com';
  const newPass = 'leader123';
  const oldEmail = 'leader2@gmail.com';
  
  let oldId = null;
  let newId = null;

  // 1. Find the old account ID
  const snap = await getDocs(collection(db, 'users'));
  const allUsers = [];
  snap.forEach(d => {
    const data = d.data();
    allUsers.push({ id: d.id, ...data });
    if (data.email === oldEmail) {
      oldId = d.id;
    }
  });

  if (!oldId) {
    console.log("Could not find the old account (leader2@gmail.com) in Firestore.");
  } else {
    console.log("Found old account with ID:", oldId);
  }

  // 2. Create the new account
  try {
    const cred = await createUserWithEmailAndPassword(auth, newEmail, newPass);
    newId = cred.user.uid;
    await setDoc(doc(db, 'users', newId), {
      id: newId,
      full_name: 'Leader Baru',
      email: newEmail,
      role: 'LEADER_BARISTA',
      active: true,
      activeShift: null
    });
    console.log('Created new account successfully:', newEmail);
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log('New account already exists in Auth. Cannot proceed without Admin SDK to get UID safely. Delete it from Firebase Console first if this happens.');
      process.exit(1);
    } else {
      console.error('Error creating new account:', e);
      process.exit(1);
    }
  }

  // 3. Migrate employees
  if (oldId && newId) {
    let count = 0;
    for (const user of allUsers) {
      if (user.account_id === oldId) {
        await updateDoc(doc(db, 'users', user.id), { account_id: newId });
        console.log(`Migrated employee ${user.full_name} to new account.`);
        count++;
      }
    }
    console.log(`Successfully migrated ${count} employees.`);

    // 4. Delete old account from Firestore
    await deleteDoc(doc(db, 'users', oldId));
    console.log('Deleted old account from Firestore.');
  }

  process.exit(0);
}
run();

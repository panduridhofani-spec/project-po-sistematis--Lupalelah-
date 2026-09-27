import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
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

async function run() {
  const snap = await getDocs(collection(db, 'users'));
  const docs = [];
  let leaderId = '';
  
  snap.forEach(d => {
    const data = d.data();
    docs.push({ id: d.id, ...data });
    if (data.email === 'leader2@gmail.com') {
      leaderId = d.id;
    }
  });
  
  if (!leaderId) {
    console.log("Could not find leader2@gmail.com account");
    return;
  }
  
  let count = 0;
  for (const user of docs) {
    if (!user.email && !user.account_id) {
      await updateDoc(doc(db, 'users', user.id), { account_id: leaderId });
      console.log(`Updated ${user.full_name} to belong to leader2@gmail.com`);
      count++;
    }
  }
  console.log(`Total updated: ${count}`);
}
run();

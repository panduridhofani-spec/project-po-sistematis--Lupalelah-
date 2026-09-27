import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBlEWw7r48iFvgazeHA9D0h-UW4xEz1V-4",
  authDomain: "po-sistematis-lups.firebaseapp.com",
  projectId: "po-sistematis-lups",
  storageBucket: "po-sistematis-lups.firebasestorage.app",
  messagingSenderId: "45916398920",
  appId: "1:45916398920:web:e43296a4862834e442bf7d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersToCreate = [
  { id: 'admin-new', email: 'admin2@cafe.com', role: 'MASTER_ADMIN', name: 'Admin Baru' },
  { id: 'leader-new', email: 'leader2@gmail.com', role: 'LEADER_BARISTA', name: 'Leader Baru' },
  { id: 'logistik-new', email: 'logistik2@gmail.com', role: 'LOGISTICS', name: 'Logistik Baru' }
];

async function registerAndSeed() {
  console.log("Mendaftarkan akun baru dengan password123...");
  for (const u of usersToCreate) {
    try {
      // 1. Buat di Firebase Auth
      await createUserWithEmailAndPassword(auth, u.email, 'password123');
      console.log(`✅ Auth: Berhasil mendaftar ${u.email}`);
      
      // 2. Buat di Firestore
      await setDoc(doc(db, 'users', u.id), {
        id: u.id,
        email: u.email,
        full_name: u.name,
        role: u.role,
        active: true,
        created_at: new Date().toISOString()
      });
      console.log(`✅ DB: Profil ${u.email} berhasil dimasukkan ke Firestore`);
    } catch (error) {
      console.error(`❌ Gagal untuk ${u.email}:`, error.message);
    }
  }
  console.log("Selesai!");
  process.exit(0);
}

registerAndSeed();

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

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

const usersToCreate = [
  { email: 'admin@cafe.com', password: 'password123' },
  { email: 'leader@gmail.com', password: 'password123' },
  { email: 'logistik@gmail.com', password: 'password123' },
  { email: 'barista@gmail.com', password: 'password123' }
];

async function registerUsers() {
  console.log("Mulai mendaftarkan akun ke Firebase Authentication...");
  for (const u of usersToCreate) {
    try {
      await createUserWithEmailAndPassword(auth, u.email, u.password);
      console.log(`✅ Berhasil mendaftar: ${u.email} / ${u.password}`);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`⚠️ Akun sudah ada di Firebase: ${u.email}. Silakan gunakan password yang pernah Anda buat untuk email ini.`);
      } else {
        console.error(`❌ Gagal mendaftar ${u.email}:`, error.message);
      }
    }
  }
  console.log("Selesai!");
  process.exit(0);
}

registerUsers();

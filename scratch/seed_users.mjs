import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Gunakan konfigurasi dari .env
const firebaseConfig = {
  apiKey: "AIzaSyBlEWw7r48iFvgazeHA9D0h-UW4xEz1V-4",
  authDomain: "po-sistematis-lups.firebaseapp.com",
  projectId: "po-sistematis-lups",
  storageBucket: "po-sistematis-lups.firebasestorage.app",
  messagingSenderId: "45916398920",
  appId: "1:45916398920:web:e43296a4862834e442bf7d",
  measurementId: "G-L0LHXS9SVS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedUsers() {
  try {
    console.log('Menambahkan profil pengguna tambahan...');

    const users = [
      {
        id: 'leader-1',
        email: 'leader@gmail.com',
        full_name: 'Leader Barista (Gmail)',
        role: 'LEADER_BARISTA',
        active: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'leader-2',
        email: 'leader@cafe.com',
        full_name: 'Leader Barista (Cafe)',
        role: 'LEADER_BARISTA',
        active: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'logistik-1',
        email: 'logistik@gmail.com',
        full_name: 'Logistik (Gmail)',
        role: 'LOGISTICS',
        active: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'logistik-2',
        email: 'logistik@cafe.com',
        full_name: 'Logistik (Cafe)',
        role: 'LOGISTICS',
        active: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'barista-1',
        email: 'barista@gmail.com',
        full_name: 'Barista (Gmail)',
        role: 'BARISTA',
        active: true,
        created_at: new Date().toISOString()
      }
    ];

    for (const user of users) {
      await setDoc(doc(db, 'users', user.id), user);
      console.log(`Profil untuk ${user.email} berhasil dibuat.`);
    }

    console.log('Semua profil tambahan berhasil dibuat!');
  } catch (error) {
    console.error('Error:', error);
  }
}

seedUsers();

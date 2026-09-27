import { initializeApp } from 'firebase/app';
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
const db = getFirestore(app);

async function seedShifts() {
  console.log('Menambahkan jadwal shift ke Firestore...');
  const shifts = [
    { shift_number: 1, start_time: '07:00:00', end_time: '15:00:00', active: true },
    { shift_number: 2, start_time: '15:00:00', end_time: '23:00:00', active: true },
    { shift_number: 3, start_time: '23:00:00', end_time: '07:00:00', active: true },
    { shift_number: 4, start_time: '08:00:00', end_time: '17:00:00', active: true } // Shift khusus misal
  ];

  for (const s of shifts) {
    try {
      await setDoc(doc(db, 'shift_schedules', s.shift_number.toString()), {
        shift_number: s.shift_number,
        start_time: s.start_time,
        end_time: s.end_time,
        active: s.active,
        updated_at: new Date().toISOString()
      });
      console.log(`✅ Shift ${s.shift_number} berhasil dibuat.`);
    } catch (e) {
      console.error(`❌ Gagal membuat Shift ${s.shift_number}:`, e.message);
    }
  }
  console.log('Selesai!');
  process.exit(0);
}

seedShifts();

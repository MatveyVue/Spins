// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBhTL7JcmGtdwPpJyKkwMRoIEOIU17ZxUk",
  authDomain: "tapalka-c9556.firebaseapp.com",
  databaseURL: "https://tapalka-c9556-default-rtdb.firebaseio.com",
  projectId: "tapalka-c9556",
  storageBucket: "tapalka-c9556.firebasestorage.app",
  messagingSenderId: "386428968826",
  appId: "1:386428968826:web:de56837a0bbc2cf27940c3",
  measurementId: "G-YENX5XCT8J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
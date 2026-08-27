import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAJlvTpmA5gChV7D9LC3yjGnPsG8pW7plA",
  authDomain: "urtc-app.firebaseapp.com",
  projectId: "urtc-app",
  storageBucket: "urtc-app.firebasestorage.app",
  messagingSenderId: "507846689605",
  appId: "1:507846689605:web:dd08e4a1fcb6c03ea6342c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };

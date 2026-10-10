import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Cloud config comes ONLY from NEXT_PUBLIC_FIREBASE_* (see .env.local.example). There is deliberately no built-in default:
// a build without it never talks to any Firebase project, so a test run cannot touch the production data by accident.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let app = null, db = null, auth = null;
if (firebaseConfigured && typeof window !== "undefined") {
  const isNew = !getApps().length;
  app = isNew ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" && isNew) {
    // Local emulators (automated tests only)
    connectFirestoreEmulator(db, "127.0.0.1", 8089);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
}

export { app, db, auth };

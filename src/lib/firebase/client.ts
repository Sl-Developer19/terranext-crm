import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { env } from '@/lib/env';

/**
 * Client Firebase SDK singleton (browser + RSC-safe module init).
 * Emulator wiring is env-gated so local development never touches
 * production data (Doc 22 M1; staging strategy C-3).
 */

let emulatorsConnected = false;

function app(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  const e = env();
  return initializeApp({
    apiKey: e.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: e.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: e.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: e.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: e.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

function connectEmulators(auth: Auth, db: Firestore, storage: FirebaseStorage): void {
  if (emulatorsConnected || !env().NEXT_PUBLIC_USE_EMULATORS) return;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  emulatorsConnected = true;
}

export function firebaseAuth(): Auth {
  const a = getAuth(app());
  connectEmulators(a, getFirestore(app()), getStorage(app()));
  return a;
}

export function firebaseDb(): Firestore {
  const db = getFirestore(app());
  connectEmulators(getAuth(app()), db, getStorage(app()));
  return db;
}

export function firebaseStorage(): FirebaseStorage {
  const s = getStorage(app());
  connectEmulators(getAuth(app()), getFirestore(app()), s);
  return s;
}

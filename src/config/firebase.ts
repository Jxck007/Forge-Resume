import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, getDocFromServer, doc } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export let app: FirebaseApp | undefined;
export let db: Firestore | undefined;
export let auth: Auth | undefined;
export let storage: FirebaseStorage | undefined;

interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const firebaseConfig: FirebaseClientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const hasFirebaseEnvironment = Object.values(firebaseConfig).every(Boolean);

export function initializeFirebase(config: FirebaseClientConfig) {
  if (!getApps().length) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }
  
  db = getFirestore(app);
  
  auth = getAuth(app);
  storage = getStorage(app);
  
  return { app, db, auth, storage };
}

export function isFirebaseConfigured(): boolean {
  return !!app && !!db && !!auth;
}

export function getDb() {
  if (!db) throw new Error("Firebase not initialized");
  return db;
}

export function getAuthInstance() {
  if (!auth) throw new Error("Firebase not initialized");
  return auth;
}

export async function testFirebaseConnection(): Promise<boolean> {
  if (!db || !auth) throw new Error("Firebase not initialized");
  try {
    // Only probe a path the signed-in user is allowed to read. Anonymous startup
    // must not intentionally trigger a Firestore permission-denied response.
    if (auth.currentUser) {
      await getDocFromServer(doc(db, 'users', auth.currentUser.uid));
    }
    return true;
  } catch (err: unknown) {
    const error = err as { message?: string };
    if (error.message?.includes('API key not valid')) {
       resetFirebaseConfiguration();
    }
    throw err;
  }
}

export function resetFirebaseConfiguration() {
  sessionStorage.clear();
  window.location.reload();
}

if (hasFirebaseEnvironment) {
  initializeFirebase(firebaseConfig);
}

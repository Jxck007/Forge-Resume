import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, getDocFromServer, doc } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import * as firebaseConfigJson from '../../firebase-applet-config.json';

export let app: FirebaseApp | undefined;
export let db: Firestore | undefined;
export let auth: Auth | undefined;
export let storage: FirebaseStorage | undefined;

export function initializeFirebase(config: any) {
  if (!getApps().length) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }
  
  if (config.firestoreDatabaseId) {
    db = getFirestore(app, config.firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
  
  auth = getAuth(app);
  storage = getStorage(app);
  
  console.log('--- FIREBASE STARTUP DIAGNOSTICS ---');
  console.log(`Current Firebase Project ID: ${config.projectId}`);
  console.log(`Current Auth Domain: ${config.authDomain}`);
  console.log(`Current Firestore Instance: ${config.firestoreDatabaseId || 'default'}`);
  console.log(`Current Storage Bucket: ${config.storageBucket}`);
  console.log(`Connected Project: ${config.projectId}`);
  console.log('------------------------------------');
  
  if (config.projectId && String(config.projectId).includes('focused-scarab-')) {
    // Note: If the user says focused-scarab is the old one, we warn here.
    // However, if focused-scarab-qln7n is the new one, they might see this warning.
    // The prompt asked to search for focused-scarab. We will log a warning if needed:
    // console.warn("Old Firebase project reference detected");
  }
  
  // Expose reset globally
  (window as any).resetFirebaseConfiguration = resetFirebaseConfiguration;
  
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
  if (!db) throw new Error("Database not initialized");
  try {
    await getDocFromServer(doc(db, 'system', 'healthcheck'));
    return true;
  } catch (err: any) {
    if (err.code === 'permission-denied') return true;
    console.error("Firebase Configuration Error: ", err.message || err);
    if (err.message && err.message.includes('API key not valid')) {
       resetFirebaseConfiguration();
    }
    throw err;
  }
}

export function resetFirebaseConfiguration() {
  console.log('Resetting Firebase Configuration');
  localStorage.removeItem('forge_custom_firebase_config');
  // clear indexdb via indexedDB.deleteDatabase ? Not easily done for all unless we know names.
  // We'll clear session and local storage
  sessionStorage.clear();
  window.location.reload();
}

try {
  const configToUse = (firebaseConfigJson as any).default || firebaseConfigJson;
  const localConfigStr = localStorage.getItem('forge_custom_firebase_config');
  
  if (localConfigStr && configToUse && configToUse.projectId) {
    try {
      const customConfig = JSON.parse(localConfigStr);
      if (customConfig.projectId !== configToUse.projectId) {
        console.warn(`Stale cached Firebase config found for project "${customConfig.projectId}". Purging local cache to enforce project "${configToUse.projectId}".`);
        localStorage.removeItem('forge_custom_firebase_config');
      }
    } catch {
      localStorage.removeItem('forge_custom_firebase_config');
    }
  }

  if (configToUse && configToUse.apiKey && !configToUse.apiKey.includes('AIzaSy...')) {
    initializeFirebase(configToUse);
  } else {
    const safeLocalConfigStr = localStorage.getItem('forge_custom_firebase_config');
    if (safeLocalConfigStr) {
      const customConfig = JSON.parse(safeLocalConfigStr);
      initializeFirebase(customConfig);
    }
  }
} catch {
  // Ignored
}


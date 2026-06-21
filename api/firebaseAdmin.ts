import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type ServiceAccountShape = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export class FirebaseAdminConfigurationError extends Error {
  constructor() {
    super('Firebase Admin is not configured.');
    this.name = 'FirebaseAdminConfigurationError';
  }
}

export const isFirebaseAdminConfigurationError = (error: unknown) =>
  error instanceof FirebaseAdminConfigurationError;

const readServiceAccount = (): ServiceAccountShape => {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded) as Partial<ServiceAccountShape>;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          project_id: parsed.project_id,
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch {
      // Fall through to individual server environment variables.
    }
  }

  const project_id = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const client_email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const private_key = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!project_id || !client_email || !private_key) {
    throw new FirebaseAdminConfigurationError();
  }
  return { project_id, client_email, private_key };
};

const getAdminApp = () => {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;
  try {
    const account = readServiceAccount();
    return initializeApp({
      credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key,
      }),
    });
  } catch (error) {
    if (isFirebaseAdminConfigurationError(error)) throw error;
    throw new FirebaseAdminConfigurationError();
  }
};

export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp());

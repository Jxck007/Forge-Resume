import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type ServiceAccountShape = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const readServiceAccount = (): ServiceAccountShape => {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded) as Partial<ServiceAccountShape>;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return parsed as ServiceAccountShape;
      }
    } catch {
      // Fall through to individual server environment variables.
    }
  }

  const project_id = process.env.FIREBASE_PROJECT_ID?.trim();
  const client_email = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const private_key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!project_id || !client_email || !private_key) {
    throw new Error('Firebase Admin is not configured.');
  }
  return { project_id, client_email, private_key };
};

const getAdminApp = () => getApps()[0] || initializeApp({
  credential: cert((() => {
    const account = readServiceAccount();
    return {
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    };
  })()),
});

export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp());

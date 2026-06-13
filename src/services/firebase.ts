import {
  AuthCredential,
  AuthError,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  getDocFromServer,
  onSnapshot,
  deleteField,
} from 'firebase/firestore';
import { ResumeData, UserSettings, AtsReport, ProfileData, TemplateId } from '../types';
import { getAuthInstance, getDb, resetFirebaseConfiguration } from '../config/firebase';
import { DEFAULT_SECTION_ORDER, normalizeSectionOrder } from '../utils/sectionOrder';
import { normalizeEducationScore } from '../utils/educationScore';

// Firestore error handling with dedicated JSON payload as mandated by SKILL
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const auth = getAuthInstance();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Authentication Helpers
export class AuthActionError extends Error {
  code: string;
  email?: string;
  signInMethods?: string[];

  constructor(code: string, message: string, options?: { email?: string; signInMethods?: string[] }) {
    super(message);
    this.name = 'AuthActionError';
    this.code = code;
    this.email = options?.email;
    this.signInMethods = options?.signInMethods;
  }
}

let pendingGoogleCredential: AuthCredential | null = null;
let pendingGoogleEmail = '';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const providerLabel = (method: string) => {
  switch (method) {
    case 'password':
      return 'email and password';
    case 'google.com':
      return 'Google';
    case 'apple.com':
      return 'Apple';
    case 'github.com':
      return 'GitHub';
    case 'facebook.com':
      return 'Facebook';
    case 'microsoft.com':
      return 'Microsoft';
    default:
      return method.replace('.com', '');
  }
};

const getSignInMethods = async (email: string) => {
  if (!email) return [];
  try {
    return await fetchSignInMethodsForEmail(getAuthInstance(), normalizeEmail(email));
  } catch {
    return [];
  }
};

export function getAuthErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  switch (code) {
    case 'auth/wrong-password':
      return 'That password is incorrect. Try again or reset your password.';
    case 'auth/user-not-found':
      return 'No Forge Resume account was found for this email. Create an account to get started.';
    case 'auth/invalid-credential':
      return 'No account was found for this email, or the password is incorrect. Check your details or create an account.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Sign in instead, or continue with Google if that is how you registered.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.';
    case 'auth/too-many-requests':
      return 'Too many attempts were made. Wait a few minutes, then try again or reset your password.';
    case 'auth/network-request-failed':
      return 'Unable to reach the authentication service. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled before completion.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/cancelled-popup-request':
      return 'A Google sign-in request is already in progress.';
    case 'auth/unauthorized-domain':
      return 'Google sign-in is not enabled for this domain. Contact the site administrator.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Contact the site administrator.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists for this email with a different sign-in method.';
    case 'auth/credential-already-in-use':
      return 'This Google account is already linked to another Forge account.';
    case 'auth/provider-already-linked':
      return 'Google is already linked to this account.';
    case 'auth/requires-recent-login':
      return 'For security, sign in again before changing account methods.';
    case 'auth/api-key-not-valid':
      return 'Authentication is temporarily unavailable because the Firebase configuration is invalid.';
    default:
      return 'We could not complete authentication. Please try again.';
  }
}

const toAuthActionError = (
  error: unknown,
  options?: { email?: string; signInMethods?: string[] }
) => {
  if (error instanceof AuthActionError) return error;
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || 'auth/unknown')
    : 'auth/unknown';
  return new AuthActionError(code, getAuthErrorMessage(error), options);
};

const hasInvalidApiKey = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';
  return code === 'auth/api-key-not-valid' || message.includes('api-key-not-valid');
};

export function clearPendingGoogleLink() {
  pendingGoogleCredential = null;
  pendingGoogleEmail = '';
}

const syncUserProfileAfterAuth = async (user: FirebaseUser) => {
  try {
    await syncUserProfile(user);
  } catch (error) {
    console.warn('Authentication succeeded, but profile synchronization is pending:', error);
  }
};

export async function loginWithGoogle() {
  const finalAuth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(finalAuth, provider);
    clearPendingGoogleLink();
    await syncUserProfileAfterAuth(result.user);
    return result.user;
  } catch (error: unknown) {
    if (hasInvalidApiKey(error)) {
      resetFirebaseConfiguration();
    }

    const authError = error as AuthError;
    if (authError?.code === 'auth/account-exists-with-different-credential') {
      const email = normalizeEmail(String(authError.customData?.email || ''));
      const credential = GoogleAuthProvider.credentialFromError(authError);
      let signInMethods: string[] = [];

      if (email) {
        signInMethods = await getSignInMethods(email);
      }

      pendingGoogleCredential = credential;
      pendingGoogleEmail = email;

      const methodText = signInMethods.length > 0
        ? providerLabel(signInMethods[0])
        : 'your existing sign-in method';
      throw new AuthActionError(
        authError.code,
        `An account already exists for ${email || 'this email'} using ${methodText}. Sign in with that method first to securely link Google.`,
        { email, signInMethods }
      );
    }

    console.error('Google Sign-In Error:', error);
    throw toAuthActionError(error);
  }
}

export async function loginWithEmail(email: string, pass: string) {
  const normalizedEmail = normalizeEmail(email);

  try {
    const auth = getAuthInstance();
    if (pendingGoogleCredential && pendingGoogleEmail !== normalizedEmail) {
      clearPendingGoogleLink();
    }
    const result = await signInWithEmailAndPassword(auth, normalizedEmail, pass);

    if (pendingGoogleCredential && pendingGoogleEmail === normalizedEmail) {
      try {
        await linkWithCredential(result.user, pendingGoogleCredential);
        clearPendingGoogleLink();
      } catch (linkError: unknown) {
        const code = linkError && typeof linkError === 'object' && 'code' in linkError
          ? String((linkError as { code?: unknown }).code || '')
          : '';
        if (code !== 'auth/provider-already-linked') {
          await signOut(auth);
          throw toAuthActionError(linkError);
        }
        clearPendingGoogleLink();
      }
    }

    await syncUserProfileAfterAuth(result.user);
    return result.user;
  } catch (error: unknown) {
    if (hasInvalidApiKey(error)) {
      resetFirebaseConfiguration();
    }
    console.error('Email Sign-In Error:', error);
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) {
      const signInMethods = await getSignInMethods(normalizedEmail);
      if (signInMethods.includes('google.com') && !signInMethods.includes('password')) {
        throw new AuthActionError(
          'auth/use-google',
          'This email is registered with Google. Continue with Google to sign in.',
          { email: normalizedEmail, signInMethods }
        );
      }
      if (signInMethods.includes('password')) {
        throw new AuthActionError(
          'auth/wrong-password',
          'That password is incorrect. Try again or reset your password.',
          { email: normalizedEmail, signInMethods }
        );
      }
      throw new AuthActionError(
        'auth/account-not-found',
        'No account was found for this email, or the password is incorrect. Check the password or create an account.',
        { email: normalizedEmail, signInMethods }
      );
    }
    throw toAuthActionError(error, { email: normalizedEmail });
  }
}

export async function registerWithEmail(email: string, pass: string) {
  const normalizedEmail = normalizeEmail(email);
  try {
    clearPendingGoogleLink();
    const result = await createUserWithEmailAndPassword(getAuthInstance(), normalizedEmail, pass);
    await syncUserProfileAfterAuth(result.user);
    return result.user;
  } catch (error: unknown) {
    if (hasInvalidApiKey(error)) {
      resetFirebaseConfiguration();
    }
    console.error('Email Registration Error:', error);
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
    if (code === 'auth/email-already-in-use') {
      const signInMethods = await getSignInMethods(normalizedEmail);
      if (signInMethods.includes('google.com') && !signInMethods.includes('password')) {
        throw new AuthActionError(
          'auth/use-google',
          'An account already exists for this email with Google. Sign in with Google instead.',
          { email: normalizedEmail, signInMethods }
        );
      }
      throw new AuthActionError(
        code,
        'An account already exists for this email. Sign in instead.',
        { email: normalizedEmail, signInMethods }
      );
    }
    throw toAuthActionError(error, { email: normalizedEmail });
  }
}

export async function handleForgotPassword(email: string) {
  try {
    await sendPasswordResetEmail(getAuthInstance(), normalizeEmail(email));
  } catch (error: unknown) {
    console.error('Password Reset Error:', error);
    throw toAuthActionError(error);
  }
}

export async function logoutUser() {
  try {
    await signOut(getAuthInstance());
  } catch (err) {
    console.error('Sign-Out Error:', err);
    throw err;
  }
}

// Profile Sync Helper
export async function syncUserProfile(user: FirebaseUser) {
  const userRef = doc(getDb(), 'users', user.uid);
  try {
    const s = await getDoc(userRef);
    if (!s.exists()) {
      const uSettings: UserSettings = {
        uid: user.uid,
        email: user.email || '',
        aiProvider: 'Groq',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, uSettings);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

// User Settings Operations
export async function getUserSettings(uid: string): Promise<UserSettings | null> {
  const userRef = doc(getDb(), 'users', uid);
  try {
    const s = await getDoc(userRef);
    if (s.exists()) {
      return s.data() as UserSettings;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
  }
}

export async function saveUserSettings(uid: string, fields: Partial<UserSettings>): Promise<void> {
  const userRef = doc(getDb(), 'users', uid);
  try {
    await updateDoc(userRef, {
      ...fields,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function removeUserProviderKey(
  uid: string,
  keyField: 'groqApiKey' | 'geminiApiKey' | 'openaiApiKey' | 'openRouterApiKey'
): Promise<void> {
  const userRef = doc(getDb(), 'users', uid);
  try {
    await updateDoc(userRef, {
      [keyField]: deleteField(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

// Profile Operations
export async function getUserProfile(uid: string): Promise<ProfileData | null> {
  const pRef = doc(getDb(), 'profiles', uid);
  try {
    const s = await getDoc(pRef);
    if (!s.exists()) return null;
    const profile = s.data() as ProfileData;
    return {
      ...profile,
      education: (profile.education || []).map(entry => ({
        ...entry,
        ...normalizeEducationScore(entry as unknown as Record<string, unknown>),
      })),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `profiles/${uid}`);
  }
}

export async function saveUserProfile(uid: string, data: ProfileData): Promise<void> {
  const pRef = doc(getDb(), 'profiles', uid);
  try {
    await setDoc(pRef, {
      ...data,
      education: (data.education || []).map(entry => ({
        ...entry,
        ...normalizeEducationScore(entry as unknown as Record<string, unknown>),
      })),
      uid,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `profiles/${uid}`);
  }
}

// Resume Operations
export async function createNewResume(userId: string, title: string, templateId: TemplateId = 'modern', initialData?: Partial<ResumeData>): Promise<ResumeData> {
  const id = 'res_' + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();
  
  const defaultResume: ResumeData = {
    id,
    ownerId: userId,
    userId,
    title,
    templateId,
    useProfilePhoto: initialData?.useProfilePhoto ?? true,
    personalDetails: {
      fullName: '',
      professionalTitle: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: '',
      profilePhoto: '',
      ...initialData?.personalDetails
    },
    summary: initialData?.summary || '',
    education: (initialData?.education || []).map(entry => ({
      ...entry,
      ...normalizeEducationScore(entry as unknown as Record<string, unknown>),
    })),
    experience: initialData?.experience || [],
    projects: initialData?.projects || [],
    skills: initialData?.skills || {
      programmingLanguages: [],
      frameworks: [],
      tools: [],
      databases: [],
      softSkills: [],
    },
    certifications: initialData?.certifications || [],
    achievements: initialData?.achievements || [],
    volunteering: initialData?.volunteering || [],
    languages: initialData?.languages || [],
    customSections: initialData?.customSections || [],
    internships: initialData?.internships || [],
    sectionOrder: normalizeSectionOrder(
      initialData?.sectionOrder || DEFAULT_SECTION_ORDER,
      (initialData?.customSections || []).map(section => section.id)
    ),
    sectionOrderMode: initialData?.sectionOrderMode === 'template' ? 'template' : 'custom',
    hiddenSections: initialData?.hiddenSections || [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  // Cache locally first for instant offline readiness
  try {
    localStorage.setItem(`forge_resume_${id}`, JSON.stringify(defaultResume));
    const localListStr = localStorage.getItem(`forge_local_resumes_list`);
    const localList = localListStr ? JSON.parse(localListStr) : [];
    if (!localList.includes(id)) {
      localList.push(id);
      localStorage.setItem(`forge_local_resumes_list`, JSON.stringify(localList));
    }
  } catch (err) {
    console.warn('Failed writing resume cache locally:', err);
  }

  try {
    const rRef = doc(getDb(), 'resumes', id);
    await setDoc(rRef, defaultResume);
    return defaultResume;
  } catch (err) {
    console.warn('Firestore write failed. Falling back to local offline-only save:', err);
    return defaultResume; // DO NOT block creation. Fulfills issue 4 and 8.
  }
}

export async function getResume(resumeId: string): Promise<ResumeData | null> {
  try {
    const rRef = doc(getDb(), 'resumes', resumeId);
    const s = await getDoc(rRef);
    if (s.exists()) {
      const data = s.data() as ResumeData;
      // sync to local cache
      try {
        localStorage.setItem(`forge_resume_${resumeId}`, JSON.stringify(data));
      } catch {}
      return data;
    }
    return null;
  } catch (err) {
    // Try local backup
    try {
      const cached = localStorage.getItem(`forge_resume_${resumeId}`);
      if (cached) return JSON.parse(cached);
    } catch {}
    handleFirestoreError(err, OperationType.GET, `resumes/${resumeId}`);
  }
}

export async function updateResumeInDb(resumeId: string, updates: Partial<ResumeData>): Promise<void> {
  const { ownerId: _ownerId, userId: _userId, id: _id, ...safeUpdates } = updates;
  // Update local storage first
  try {
    const cached = localStorage.getItem(`forge_resume_${resumeId}`);
    if (cached) {
      const current = JSON.parse(cached);
      const merged = { ...current, ...safeUpdates, updatedAt: new Date().toISOString() };
      localStorage.setItem(`forge_resume_${resumeId}`, JSON.stringify(merged));
    }
  } catch (err) {
    console.warn('Failed updating local storage cache:', err);
  }

  try {
    const rRef = doc(getDb(), 'resumes', resumeId);
    await updateDoc(rRef, {
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore updateDoc failed, running in resilient offline status:', err);
  }
}

export async function deleteResumeFromDb(resumeId: string): Promise<void> {
  try {
    localStorage.removeItem(`forge_resume_${resumeId}`);
    const localListStr = localStorage.getItem(`forge_local_resumes_list`);
    if (localListStr) {
      const localList = JSON.parse(localListStr).filter((id: string) => id !== resumeId);
      localStorage.setItem(`forge_local_resumes_list`, JSON.stringify(localList));
    }
  } catch (err) {
    console.warn('Failed clearing deleted resume from local cache:', err);
  }

  try {
    const rRef = doc(getDb(), 'resumes', resumeId);
    await deleteDoc(rRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `resumes/${resumeId}`);
  }
}

export function syncLocalResumeCache(resumes: ResumeData[]): void {
  try {
    const ids = new Set(resumes.map(r => r.id));
    localStorage.setItem('forge_local_resumes_list', JSON.stringify([...ids]));

    resumes.forEach(r => {
      localStorage.setItem(`forge_resume_${r.id}`, JSON.stringify(r));
    });

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('forge_resume_')) {
        const id = key.replace('forge_resume_', '');
        if (!ids.has(id)) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (err) {
    console.warn('Failed syncing local resume cache:', err);
  }
}

export async function fetchUserResumes(userId: string): Promise<ResumeData[]> {
  const path = 'resumes';
  try {
    const q = query(collection(getDb(), path), where('ownerId', '==', userId));
    const qs = await getDocs(q);
    const results: ResumeData[] = [];
    qs.forEach(d => {
      results.push(d.data() as ResumeData);
    });
    return results;
  } catch (err) {
    // Return local cached lists instead of failing
    const results: ResumeData[] = [];
    try {
      const localListStr = localStorage.getItem(`forge_local_resumes_list`);
      const localIds = localListStr ? JSON.parse(localListStr) : [];
      localIds.forEach((id: string) => {
        const cached = localStorage.getItem(`forge_resume_${id}`);
        if (cached) {
          results.push(JSON.parse(cached));
        }
      });
    } catch {}
    return results;
  }
}

// Listen to User Resumes Real-time
export function subscribeToUserResumes(userId: string, callback: (resumes: ResumeData[]) => void) {
  const path = 'resumes';
  try {
    const q = query(collection(getDb(), path), where('ownerId', '==', userId));
    return onSnapshot(
      q,
      snapshot => {
        const results: ResumeData[] = [];
        snapshot.forEach(d => {
          results.push(d.data() as ResumeData);
        });
        callback(results);
      },
      error => {
        console.warn('onSnapshot error (likely offline). Falling back to local index:', error);
        try {
          const results: ResumeData[] = [];
          const localListStr = localStorage.getItem(`forge_local_resumes_list`);
          const localIds = localListStr ? JSON.parse(localListStr) : [];
          localIds.forEach((id: string) => {
            const cached = localStorage.getItem(`forge_resume_${id}`);
            if (cached) {
              results.push(JSON.parse(cached));
            }
          });
          callback(results);
        } catch {
          callback([]);
        }
      }
    );
  } catch {
    const results: ResumeData[] = [];
    const localListStr = localStorage.getItem(`forge_local_resumes_list`);
    const localIds = localListStr ? JSON.parse(localListStr) : [];
    localIds.forEach((id: string) => {
      const cached = localStorage.getItem(`forge_resume_${id}`);
      if (cached) {
        results.push(JSON.parse(cached));
      }
    });
    callback(results);
    return () => {};
  }
}

// ATS Diagnostics
export async function saveAtsReport(report: AtsReport): Promise<void> {
  const rPath = `atsReports/${report.id}`;
  try {
    await setDoc(doc(getDb(), 'atsReports', report.id), report);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, rPath);
  }
}

export async function fetchUserAtsReports(userId: string): Promise<AtsReport[]> {
  const path = 'atsReports';
  try {
    const q = query(collection(getDb(), path), where('userId', '==', userId));
    const qs = await getDocs(q);
    const results: AtsReport[] = [];
    qs.forEach(d => {
      results.push(d.data() as AtsReport);
    });
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

import {
  GoogleAuthProvider,
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
} from 'firebase/firestore';
import { ResumeData, UserSettings, AtsReport, ProfileData } from '../types';
import { getAuthInstance, getDb, resetFirebaseConfiguration } from '../config/firebase';

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
export async function loginWithGoogle() {
  const finalAuth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(finalAuth, provider);
    await syncUserProfile(result.user);
    return result.user;
  } catch (err: any) {
    if (err?.message?.includes('api-key-not-valid') || err?.code === 'auth/api-key-not-valid') {
      resetFirebaseConfiguration();
    }
    console.error('Google Sign-In Error:', err);
    throw err;
  }
}

export async function loginWithEmail(email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(getAuthInstance(), email, pass);
    await syncUserProfile(result.user);
    return result.user;
  } catch (err: any) {
    if (err?.message?.includes('api-key-not-valid') || err?.code === 'auth/api-key-not-valid') {
      resetFirebaseConfiguration();
    }
    console.error('Email Sign-In Error:', err);
    throw err;
  }
}

export async function registerWithEmail(email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(getAuthInstance(), email, pass);
    await syncUserProfile(result.user);
    return result.user;
  } catch (err: any) {
    if (err?.message?.includes('api-key-not-valid') || err?.code === 'auth/api-key-not-valid') {
      resetFirebaseConfiguration();
    }
    console.error('Email Registration Error:', err);
    throw err;
  }
}

export async function handleForgotPassword(email: string) {
  try {
    await sendPasswordResetEmail(getAuthInstance(), email);
  } catch (err) {
    console.error('Password Reset Error:', err);
    throw err;
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

// Profile Operations
export async function getUserProfile(uid: string): Promise<ProfileData | null> {
  const pRef = doc(getDb(), 'profiles', uid);
  try {
    const s = await getDoc(pRef);
    return s.exists() ? (s.data() as ProfileData) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `profiles/${uid}`);
  }
}

export async function saveUserProfile(uid: string, data: ProfileData): Promise<void> {
  const pRef = doc(getDb(), 'profiles', uid);
  try {
    await setDoc(pRef, {
      ...data,
      uid,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `profiles/${uid}`);
  }
}

// Resume Operations
export async function createNewResume(userId: string, title: string, templateId: string = 'modern', initialData?: Partial<ResumeData>): Promise<ResumeData> {
  const id = 'res_' + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();
  
  const defaultResume: ResumeData = {
    id,
    userId,
    title,
    templateId,
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
    education: initialData?.education || [],
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
    sectionOrder: initialData?.sectionOrder || ['summary', 'experience', 'internships', 'education', 'skills', 'projects', 'certifications', 'achievements', 'volunteering', 'languages'],
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
  // Update local storage first
  try {
    const cached = localStorage.getItem(`forge_resume_${resumeId}`);
    if (cached) {
      const current = JSON.parse(cached);
      const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem(`forge_resume_${resumeId}`, JSON.stringify(merged));
    }
  } catch (err) {
    console.warn('Failed updating local storage cache:', err);
  }

  try {
    const rRef = doc(getDb(), 'resumes', resumeId);
    await updateDoc(rRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore updateDoc failed, running in resilient offline status:', err);
  }
}

export async function deleteResumeFromDb(resumeId: string): Promise<void> {
  // Remove local storage references
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
    console.warn('Firestore delete failed:', err);
  }
}

export async function fetchUserResumes(userId: string): Promise<ResumeData[]> {
  const path = 'resumes';
  try {
    const q = query(collection(getDb(), path), where('userId', '==', userId));
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
    const q = query(collection(getDb(), path), where('userId', '==', userId));
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

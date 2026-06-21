const STORAGE_PREFIX = 'forgeResume';

const userPrefix = (uid: string) => `${STORAGE_PREFIX}:user:${uid}`;

export const storageKeys = {
  guest: {
    activeResume: `${STORAGE_PREFIX}:guest:activeResume`,
    editorState: `${STORAGE_PREFIX}:guest:editorState`,
    profileDraft: `${STORAGE_PREFIX}:guest:profileDraft`,
    atsCache: `${STORAGE_PREFIX}:guest:atsCache`,
    feedbackSubmissions: `${STORAGE_PREFIX}:guest:feedbackSubmissions`,
    tutorialCompleted: `${STORAGE_PREFIX}:guest:tutorialCompleted`,
  },
  user: {
    activeResume: (uid: string) => `${userPrefix(uid)}:activeResume`,
    profile: (uid: string) => `${userPrefix(uid)}:profile`,
    editorState: (uid: string) => `${userPrefix(uid)}:editorState`,
    atsCache: (uid: string) => `${userPrefix(uid)}:atsCache`,
    feedbackSubmissions: (uid: string) => `${userPrefix(uid)}:feedbackSubmissions`,
    tutorialCompleted: (uid: string) => `${userPrefix(uid)}:tutorialCompleted`,
    settingsTutorialCompleted: (uid: string) => `${userPrefix(uid)}:settingsTutorialCompleted`,
    resumeIndex: (uid: string) => `${userPrefix(uid)}:resumeIndex`,
    resume: (uid: string, resumeId: string) => `${userPrefix(uid)}:resume:${resumeId}`,
  },
  client: {
    deviceId: `${STORAGE_PREFIX}:client:deviceId`,
  },
  legacy: {
    // Legacy global keys are intentionally retained only as ignored markers.
    // Forge must never auto-load them into guest or account-scoped workspaces.
    profilePrefix: 'forge_profile_',
    settingsPrefix: 'forge_settings_',
    resumePrefix: 'forge_resume_',
    resumeIndex: 'forge_local_resumes_list',
  },
} as const;

export const forgeDeviceIdKey = storageKeys.client.deviceId;

export function getOrCreateForgeDeviceId(): string {
  try {
    let existing = readStorageValue(forgeDeviceIdKey);
    if (existing) return existing;
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const nextId = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    writeStorageValue(forgeDeviceIdKey, nextId);
    return nextId;
  } catch {
    return 'unknown-device';
  }
}

export function readStorageValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function removeStorageValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function readStorageJson<T>(key: string): T | null {
  const value = readStorageValue(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function writeStorageJson(key: string, value: unknown): void {
  writeStorageValue(key, JSON.stringify(value));
}

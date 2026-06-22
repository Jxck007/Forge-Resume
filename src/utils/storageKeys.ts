const STORAGE_PREFIX = 'forgeResume';

const userPrefix = (uid: string) => `${STORAGE_PREFIX}:user:${uid}`;

export const storageKeys = {
  guest: {
    activeResume: `${STORAGE_PREFIX}:guest:activeResume`,
    editorState: `${STORAGE_PREFIX}:guest:editorState`,
    profileDraft: `${STORAGE_PREFIX}:guest:profileDraft`,
    atsCache: `${STORAGE_PREFIX}:guest:atsCache`,
    feedbackSubmissions: `${STORAGE_PREFIX}:guest:feedbackSubmissions`,
    tutorialCompleted: `forge:onboarding:v2:guest`,
  },
  user: {
    activeResume: (uid: string) => `${userPrefix(uid)}:activeResume`,
    profile: (uid: string) => `${userPrefix(uid)}:profile`,
    editorState: (uid: string) => `${userPrefix(uid)}:editorState`,
    atsCache: (uid: string) => `${userPrefix(uid)}:atsCache`,
    feedbackSubmissions: (uid: string) => `${userPrefix(uid)}:feedbackSubmissions`,
    tutorialCompleted: (uid: string) => `forge:onboarding:v2:${uid}`,
    settingsTutorialCompleted: (uid: string) => `${userPrefix(uid)}:settingsTutorialCompleted`,
    resumeIndex: (uid: string) => `${userPrefix(uid)}:resumeIndex`,
    resume: (uid: string, resumeId: string) => `${userPrefix(uid)}:resume:${resumeId}`,
  },
  client: {
    deviceId: 'forge_device_id',
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
    const nextId = crypto.randomUUID();
    writeStorageValue(forgeDeviceIdKey, nextId);
    return nextId;
  } catch {
    return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

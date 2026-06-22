import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { isFirebaseConfigured, getAuthInstance, testFirebaseConnection } from './config/firebase';
import {
  subscribeToUserResumes,
  createNewResume,
  updateResumeInDb,
  deleteResumeFromDb,
  getUserSettings,
  getUserProfile,
  saveUserProfile,
  saveUserSettings,
  logoutUser,
  saveFeedbackSubmission,
  syncLocalResumeCache,
} from './services/firebase';
import { ResumeData, UserSettings, ProfileData, TemplateId } from './types';
import { normalizeResume } from './utils';
import { refreshResumeLanguageQuality } from './utils/languageQuality';
import { profileToResume } from './utils/profileToResume';
import {
  readStorageJson,
  readStorageValue,
  removeStorageValue,
  storageKeys,
  writeStorageJson,
  writeStorageValue,
} from './utils/storageKeys';
import Header from './components/Header';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ProfileSetup from './components/ProfileSetup';
import { ReviewedImport } from './utils/aiImportQuality';
import ErrorBoundary from './components/ErrorBoundary';
import FirebaseSetupWizard from './components/FirebaseSetupWizard';
import WorkspaceLoadingScreen from './components/WorkspaceLoadingScreen';
import NotFoundPage from './components/NotFoundPage';
import OnboardingTour from './components/OnboardingTour';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { AiSessionProvider, clearAiSessionMemory } from './contexts/AiSessionContext';

const ResumeBuilder = React.lazy(() => import('./components/ResumeBuilder'));
const ResumePreview = React.lazy(() => import('./components/ResumePreview'));
const MyProfile = React.lazy(() => import('./components/MyProfile'));
const Settings = React.lazy(() => import('./components/Settings'));

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

type AppTab = 'dashboard' | 'builder' | 'ats' | 'profile' | 'settings';
type FeedbackInput = { category: string; message: string; route: string };

const APP_PATHS = new Set(['/', '/dashboard', '/builder', '/ats', '/profile', '/settings']);

const getInitialPath = () => (typeof window === 'undefined' ? '/' : window.location.pathname || '/');
const getSafeStoredTab = (tab?: string | null): AppTab =>
  tab === 'builder' || tab === 'profile' || tab === 'settings' ? tab : 'dashboard';

const getTabFromPath = (pathname: string): AppTab =>
  pathname === '/builder' ? 'builder' :
  pathname === '/ats' ? 'ats' :
  pathname === '/profile' ? 'profile' :
  pathname === '/settings' ? 'settings' :
  'dashboard';

const getPathForTab = (tab: AppTab) =>
  tab === 'builder' ? '/builder' :
  tab === 'ats' ? '/ats' :
  tab === 'profile' ? '/profile' :
  tab === 'settings' ? '/settings' :
  '/dashboard';

export default function App() {
  const [firebaseReady, setFirebaseReady] = useState(isFirebaseConfigured());
  const [dbConnected, setDbConnected] = useState(false);
  const [routePath, setRoutePath] = useState(getInitialPath());
  const [user, setUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>(() => getTabFromPath(getInitialPath()));
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [guestImportNoticePending, setGuestImportNoticePending] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialContext, setTutorialContext] = useState<'dashboard' | 'builder' | 'profile'>('dashboard');
  const [settingsTourRequestId, setSettingsTourRequestId] = useState(0);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'resume' | 'ai'>('resume');
  const [builderMobileView, setBuilderMobileView] = useState<'editor' | 'preview'>('editor');
  
  // Toaster alerts state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Saving states
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeActionInProgressRef = useRef<Set<string>>(new Set());
  const resumeSelectionHydratedUserIdRef = useRef<string | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const navigateTo = (path: string, tab?: AppTab) => {
    window.history.pushState({}, '', path);
    setRoutePath(path);
    if (tab) setActiveTab(tab);
  };

  const navigateToTab = (tab: AppTab) => {
    if (tab === 'settings') setSettingsInitialTab('resume');
    navigateTo(getPathForTab(tab), tab);
  };

  const openAiAssist = () => {
    if (!user) return;
    setSettingsInitialTab('ai');
    navigateTo('/settings', 'settings');
  };

  const hasGuestDraft = () => Boolean(readStorageJson<ResumeData>(storageKeys.guest.activeResume));

  const buildGuestProfileDraft = (resume: ResumeData): ProfileData => ({
    uid: 'guest',
    personalDetails: { ...resume.personalDetails },
    summary: resume.summary || '',
    careerObjective: '',
    education: resume.education || [],
    experience: resume.experience || [],
    internships: resume.internships || [],
    projects: resume.projects || [],
    skills: resume.skills,
    certifications: resume.certifications || [],
    achievements: resume.achievements || [],
    volunteering: resume.volunteering || [],
    languages: resume.languages || [],
    customSections: resume.customSections || [],
    linkDisplayMode: resume.linkDisplayMode,
    updatedAt: new Date().toISOString(),
  });

  const persistGuestWorkspace = (resumeList: ResumeData[], nextActiveResumeId: string | null, nextActiveTab: 'dashboard' | 'builder') => {
    const activeResume = nextActiveResumeId
      ? resumeList.find(resume => resume.id === nextActiveResumeId) || null
      : null;

    if (activeResume) {
      writeStorageJson(storageKeys.guest.activeResume, activeResume);
      writeStorageJson(storageKeys.guest.profileDraft, buildGuestProfileDraft(activeResume));
    } else {
      removeStorageValue(storageKeys.guest.activeResume);
      removeStorageValue(storageKeys.guest.profileDraft);
    }

    writeStorageJson(storageKeys.guest.editorState, {
      activeResumeId: nextActiveResumeId,
      activeTab: nextActiveTab,
      updatedAt: new Date().toISOString(),
    });
  };

  const createGuestResume = (title: string, templateId: TemplateId, initialData?: Partial<ResumeData>): ResumeData => {
    const now = new Date().toISOString();
    return normalizeResume({
      id: initialData?.id || `guest_res_${Math.random().toString(36).substring(2, 11)}`,
      ownerId: 'guest',
      userId: 'guest',
      title,
      templateId,
      linkDisplayMode: initialData?.linkDisplayMode || 'embedded',
      useProfilePhoto: initialData?.useProfilePhoto ?? true,
      personalDetails: initialData?.personalDetails || {},
      summary: initialData?.summary || '',
      education: initialData?.education || [],
      experience: initialData?.experience || [],
      internships: initialData?.internships || [],
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
      sectionConfig: initialData?.sectionConfig,
      sectionOrder: initialData?.sectionOrder,
      sectionOrderMode: initialData?.sectionOrderMode,
      hiddenSections: initialData?.hiddenSections || [],
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      isArchived: false,
    });
  };

  const resetWorkspaceState = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setSaving(false);
    setWorkspaceHydrated(false);
    setResumes([]);
    setActiveResumeId(null);
    setUserSettings(null);
    setUserProfile(null);
    setShowProfileSetup(false);
    setActiveTab('dashboard');
  };

  const returnToAuth = () => {
    clearAiSessionMemory();
    setIsGuestMode(false);
    resetWorkspaceState();
    navigateTo('/', 'dashboard');
  };

  // Initialize theme and auth listener
  useEffect(() => {
    // Theme sync - enforce pure dark theme
    document.documentElement.classList.add('dark');

    if (!firebaseReady) {
      setAuthReady(true);
      return;
    }

    testFirebaseConnection()
      .then(() => {
        setDbConnected(true);
      })
      .catch((err) => {
        setDbConnected(false);
        console.error('Firebase Config Error', err);
      });

    const auth = getAuthInstance();
    const unsubAuth = onAuthStateChanged(auth, async curUser => {
      const hadGuestDraft = hasGuestDraft();
      clearAiSessionMemory();
      resetWorkspaceState();
      setUser(curUser);
      resumeSelectionHydratedUserIdRef.current = null;

      if (curUser) {
        setIsGuestMode(false);
        if (hadGuestDraft) setGuestImportNoticePending(true);
        try {
          const cachedProfile = readStorageJson<ProfileData>(storageKeys.user.profile(curUser.uid));
          if (cachedProfile?.uid === curUser.uid) setUserProfile(cachedProfile);

          const cachedEditorState = readStorageJson<{ activeTab?: typeof activeTab }>(
            storageKeys.user.editorState(curUser.uid)
          );
          if (cachedEditorState?.activeTab && cachedEditorState.activeTab !== 'builder') {
            setActiveTab(getSafeStoredTab(cachedEditorState.activeTab));
          }
        } catch (err) {
          console.warn('Failed restoring local cache on boot:', err);
        }

        // Fetch user settings and profile
        try {
          const [settings, profile] = await Promise.all([
            getUserSettings(curUser.uid).catch(() => null),
            getUserProfile(curUser.uid).catch(() => null),
          ]);

          if (settings) {
            setUserSettings(settings);
          }
          if (profile) {
            setUserProfile(profile);
            writeStorageJson(storageKeys.user.profile(curUser.uid), profile);
          }
          
          setShowProfileSetup(Boolean(settings && !settings.hasCompletedProfile));
        } catch (err) {
          console.warn('Sync connection warning (offline mode active):', err);
        }
      } else {
        setIsGuestMode(false);
      }
      setAuthReady(true);
    });

    return () => {
      unsubAuth();
    };
  }, [firebaseReady]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname || '/';
      setRoutePath(nextPath);
      setActiveTab(getTabFromPath(nextPath));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!authReady || user || !isGuestMode) return;

    const cachedResume = readStorageJson<ResumeData>(storageKeys.guest.activeResume);
    const cachedEditorState = readStorageJson<{ activeResumeId?: string | null; activeTab?: 'dashboard' | 'builder' }>(
      storageKeys.guest.editorState
    );

    if (cachedResume) {
      const normalizedResume = normalizeResume(cachedResume);
      setResumes([normalizedResume]);
      setActiveResumeId(cachedEditorState?.activeResumeId === normalizedResume.id ? normalizedResume.id : normalizedResume.id);
      setActiveTab(cachedEditorState?.activeTab === 'builder' ? 'builder' : 'dashboard');
    } else {
      setResumes([]);
      setActiveResumeId(null);
      setActiveTab('dashboard');
    }
  }, [authReady, isGuestMode, user]);

  useEffect(() => {
    if (!authReady || showProfileSetup || (!user && !isGuestMode) || (user && !workspaceHydrated)) return;
    const key = user ? storageKeys.user.tutorialCompleted(user.uid) : storageKeys.guest.tutorialCompleted;
    const legacyKey = user ? `forgeResume:user:${user.uid}:tutorialCompleted` : 'forgeResume:guest:tutorialCompleted';
    if (readStorageValue(legacyKey) === 'true' && readStorageValue(key) !== 'true') {
      writeStorageValue(key, 'true');
    }
    if (readStorageValue(key) !== 'true') {
      navigateTo('/dashboard', 'dashboard');
      setTutorialContext('dashboard');
      setTutorialOpen(true);
    }
  }, [authReady, isGuestMode, showProfileSetup, user, workspaceHydrated]);

  const completeTutorial = React.useCallback(() => {
    const key = user ? storageKeys.user.tutorialCompleted(user.uid) : storageKeys.guest.tutorialCompleted;
    writeStorageValue(key, 'true');
    setTutorialOpen(false);
  }, [user]);

  const restartTutorial = React.useCallback(() => {
    const key = user ? storageKeys.user.tutorialCompleted(user.uid) : storageKeys.guest.tutorialCompleted;
    removeStorageValue(key);
    setTutorialContext(activeTab === 'builder' ? 'builder' : activeTab === 'profile' ? 'profile' : 'dashboard');
    setTutorialOpen(true);
  }, [activeTab, user]);

  useEffect(() => {
    if (!user || !guestImportNoticePending) return;
    triggerToast(
      'Guest draft kept local only. Future options: import as new resume, keep local only, or discard guest draft.',
      'info'
    );
    setGuestImportNoticePending(false);
  }, [guestImportNoticePending, user]);

  useEffect(() => {
    if (!authReady || user || !isGuestMode) return;
    persistGuestWorkspace(resumes, activeResumeId, activeTab === 'builder' ? 'builder' : 'dashboard');
  }, [activeResumeId, activeTab, authReady, isGuestMode, resumes, user]);

  // Listen to user resumes real-time when authenticated
  useEffect(() => {
    if (!user) return;

    const unsubResumes = subscribeToUserResumes(user.uid, list => {
      const normalizedList = list.map(r => normalizeResume(r));
      syncLocalResumeCache(user.uid, normalizedList);
      setResumes(normalizedList);
      setWorkspaceHydrated(true);
    });

    return () => {
      unsubResumes();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (resumeSelectionHydratedUserIdRef.current === user.uid) return;

    if (resumes.length === 0) {
      resumeSelectionHydratedUserIdRef.current = user.uid;
      return;
    }

    const storedActiveResumeId = readStorageValue(storageKeys.user.activeResume(user.uid));
    const nextActiveResumeId = storedActiveResumeId && resumes.some(resume => resume.id === storedActiveResumeId)
      ? storedActiveResumeId
      : null;

    resumeSelectionHydratedUserIdRef.current = user.uid;
    if (nextActiveResumeId) {
      setActiveResumeId(nextActiveResumeId);
      setActiveTab('builder');
    }
  }, [resumes, user]);

  useEffect(() => {
    if (!user) return;
    if (resumeSelectionHydratedUserIdRef.current !== user.uid) return;

    if (activeResumeId) {
      writeStorageValue(storageKeys.user.activeResume(user.uid), activeResumeId);
      return;
    }

    removeStorageValue(storageKeys.user.activeResume(user.uid));
  }, [activeResumeId, user]);

  useEffect(() => {
    if (!user) return;
    writeStorageJson(storageKeys.user.editorState(user.uid), {
      activeTab: activeTab === 'ats' ? 'dashboard' : activeTab,
      updatedAt: new Date().toISOString(),
    });
  }, [activeTab, user]);

  // Toast notifier helper uses the one declared at top of file

  // Auth onSuccess trigger
  const handleAuthSuccess = async () => {
    if (hasGuestDraft()) {
      setGuestImportNoticePending(true);
    }
  };

  const handleLogout = async () => {
    clearAiSessionMemory();
    await logoutUser();
  };

  const handleContinueAsGuest = () => {
    clearAiSessionMemory();
    resetWorkspaceState();
    setIsGuestMode(true);
    setWorkspaceHydrated(true);
    setAuthReady(true);
  };

  const handleFeedbackSubmit = async ({ category, message, route }: FeedbackInput) => {
    const payload = {
      category,
      message: message.trim(),
      route,
      timestamp: new Date().toISOString(),
      appVersion: import.meta.env.VITE_APP_VERSION || 'beta',
    };

    if (!payload.message || payload.message.length > 2000) {
      triggerToast('Please add a short feedback message first.', 'info');
      return 'failed' as const;
    }

    setFeedbackSubmitting(true);
    try {
      if (user && dbConnected) {
        await saveFeedbackSubmission(user.uid, payload);
        triggerToast('Feedback sent. Thanks for helping improve Forge.', 'success');
        return 'sent' as const;
      } else {
        const feedbackKey = user ? storageKeys.user.feedbackSubmissions(user.uid) : storageKeys.guest.feedbackSubmissions;
        const existing = readStorageJson<Array<typeof payload>>(feedbackKey) || [];
        writeStorageJson(feedbackKey, [payload, ...existing].slice(0, 20));
        triggerToast(
          user
            ? 'Feedback stored locally while offline.'
            : 'Feedback saved locally in guest mode.',
          'success'
        );
        return 'stored_local' as const;
      }
    } catch {
      const feedbackKey = storageKeys.user.feedbackSubmissions(user!.uid);
      const existing = readStorageJson<Array<typeof payload>>(feedbackKey) || [];
      writeStorageJson(feedbackKey, [payload, ...existing].slice(0, 20));
      triggerToast('Cloud feedback was unavailable, so this submission was saved locally.', 'info');
      return 'stored_local' as const;
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Resume modifications (CRUD)
  const handleCreateNewResume = async (
    title: string,
    templateId: TemplateId,
    source: 'profile' | 'blank' = 'profile'
  ) => {
    if (!user && !isGuestMode) return;
    if (user && !dbConnected) { triggerToast('Cannot verify database connection. Please check your configuration.', 'error'); return; }
    try {
      const sourceData: Partial<ResumeData> =
        source === 'profile' && userProfile
          ? profileToResume(userProfile)
          : {};
      const initialData: Partial<ResumeData> = {
        ...sourceData,
        linkDisplayMode: sourceData.linkDisplayMode || userSettings?.defaultLinkDisplayMode || 'embedded',
        useProfilePhoto: sourceData.useProfilePhoto ?? userSettings?.defaultUseProfilePhoto ?? true,
        sectionOrderMode: sourceData.sectionOrderMode || userSettings?.defaultSectionOrderMode || 'template',
      };

      const newResume = user
        ? await createNewResume(user.uid, title, templateId, initialData)
        : createGuestResume(title, templateId, initialData);
      const nextResumes = [newResume];
      setResumes(nextResumes);
      setActiveResumeId(newResume.id);
      navigateTo('/builder', 'builder');
      if (!user) {
        persistGuestWorkspace(nextResumes, newResume.id, 'builder');
      }
      triggerToast(`Resume "${title}" established!`, 'success');
    } catch {
      triggerToast('Unable to formulate resume', 'error');
    }
  };

  const handleDuplicateResume = async (src: ResumeData) => {
    if (!user) {
      triggerToast('Guest mode supports one local draft. Create a new resume to replace it.', 'info');
      return;
    }
    if (!dbConnected) { triggerToast('Cannot duplicate while offline.', 'error'); return; }

    const actionKey = `duplicate:${src.id}`;
    if (resumeActionInProgressRef.current.has(actionKey)) return;

    resumeActionInProgressRef.current.add(actionKey);
    try {
      const duplicatedResume = await createNewResume(
        user.uid,
        `${src.title} (Copy)`,
        src.templateId,
        src
      );
      setResumes(prev => {
        if (prev.some(r => r.id === duplicatedResume.id)) return prev;
        return [duplicatedResume, ...prev];
      });
      triggerToast(`Duplicated into "${duplicatedResume.title}"`, 'success');
    } catch {
      triggerToast('Duplication request failed.', 'error');
      throw new Error('Duplication failed');
    } finally {
      resumeActionInProgressRef.current.delete(actionKey);
    }
  };

  const handleDeleteResume = async (id: string) => {
    if (!user && !isGuestMode) return;
    if (!user) {
      setResumes([]);
      setActiveResumeId(null);
      navigateTo('/dashboard', 'dashboard');
      persistGuestWorkspace([], null, 'dashboard');
      removeStorageValue(storageKeys.guest.profileDraft);
      triggerToast('Guest resume deleted.', 'success');
      return;
    }
    if (!dbConnected) { triggerToast('Cannot delete while offline.', 'error'); return; }

    const previousResumes = resumes;
    const previousActiveResumeId = activeResumeId;
    const previousTab = activeTab;

    setResumes(prev => prev.filter(r => r.id !== id));
    if (activeResumeId === id) {
      setActiveResumeId(null);
      navigateTo('/dashboard', 'dashboard');
    }

    try {
      await deleteResumeFromDb(user.uid, id);
      triggerToast('Resume deleted successfully', 'success');
    } catch {
      setResumes(previousResumes);
      setActiveResumeId(previousActiveResumeId);
      setActiveTab(previousTab);
      triggerToast('Delete failed.', 'error');
      throw new Error('Delete failed');
    }
  };

  const handleToggleArchive = async (id: string, state: boolean) => {
    if (!user) return;
    if (!dbConnected) { triggerToast('Cannot archive while offline.', 'error'); return; }

    const previousResumes = resumes;
    setResumes(prev => prev.map(r => r.id === id ? { ...r, isArchived: state } : r));

    try {
      await updateResumeInDb(user.uid, id, { isArchived: state });
      triggerToast(state ? 'Resume archived.' : 'Resume restored.', 'success');
    } catch {
      setResumes(previousResumes);
      triggerToast('Failed to change archive state.', 'error');
    }
  };

  // Auto-save logic
  const handleResumeChange = (updated: ResumeData) => {
    if (!user && !isGuestMode) return;
    if (!user) {
      const nextResume = refreshResumeLanguageQuality(updated);
      setResumes([nextResume]);
      persistGuestWorkspace([nextResume], nextResume.id, 'builder');
      return;
    }
    if (!dbConnected) {
      triggerToast('Cannot save while offline.', 'error');
      return;
    }
    const nextResume = refreshResumeLanguageQuality(updated);
    // Update local resumes state instantly to update live preview instantly
    setResumes(prev => prev.map(r => (r.id === nextResume.id ? nextResume : r)));

    // Clear previous save debouncer ref
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateResumeInDb(user.uid, nextResume.id, nextResume);
      } catch {
        triggerToast('Auto save synchronization failed.', 'error');
      } finally {
        setSaving(false);
      }
    }, 1000); // 1-second debounce for stellar performance
  };

  const handleParseResumeImport = async (rawText: string): Promise<ReviewedImport<ResumeData>> => {
    if (!user) throw new Error('You must be signed in to import a resume.');
    void rawText;
    throw new Error('Assisted import is being upgraded. You can create a resume manually for now.');
  };

  const handleSaveResumeImport = async (importedData: Partial<ResumeData>) => {
    if (!user && !isGuestMode) throw new Error('You must be signed in to import a resume.');
    if (user && !dbConnected) throw new Error('Cannot save the imported resume while offline.');

    const title = importedData.title || 'Imported Resume';
    const newResume = user
      ? await createNewResume(user.uid, title, importedData.templateId || 'modern', importedData)
      : createGuestResume(title, importedData.templateId || 'modern', importedData);

    setResumes([newResume]);
    setActiveResumeId(newResume.id);
    navigateTo('/builder', 'builder');
    if (!user) {
      persistGuestWorkspace([newResume], newResume.id, 'builder');
    }
  };

  const handleSettingsKeyConfigured = async () => {
    if (user) {
      const updatedSettings = await getUserSettings(user.uid);
      setUserSettings(updatedSettings);
    }
  };

  const handleProfileComplete = async (profile: ProfileData) => {
    if (!user) return;
    if (!dbConnected) { triggerToast('Cannot save profile while offline.', 'error'); return; }
    try {
      const profileToSave = { ...profile, uid: user.uid };
      await saveUserProfile(user.uid, profileToSave);
      await saveUserSettings(user.uid, { hasCompletedProfile: true });
      
      setUserProfile(profileToSave);
      writeStorageJson(storageKeys.user.profile(user.uid), profileToSave);
      setUserSettings(prev => prev ? { ...prev, hasCompletedProfile: true } : null);
      setShowProfileSetup(false);
      triggerToast('Profile completed successfully!', 'success');
    } catch {
      triggerToast('Profile save failed.', 'error');
    }
  };


  const activeResume = resumes.find(r => r.id === activeResumeId);
  const routeIsKnown = APP_PATHS.has(routePath);
  const atsPausedRoute = activeTab === 'ats';
  const isGuestRestrictedTab = isGuestMode && (activeTab === 'profile' || activeTab === 'settings');
  const guestRestrictedTitle = activeTab === 'profile' ? 'Profile is available after sign in.' : 'Settings are available after sign in.';

  // AI access is strictly BYOK. Vite client environment variables must never contain provider secrets.
  const effectiveSettings = React.useMemo(() => {
    return { ...(userSettings || {}) } as UserSettings;
  }, [userSettings]);

  if (!routeIsKnown) {
    return (
      <NotFoundPage
        onOpenDashboard={() => navigateTo('/dashboard', 'dashboard')}
      />
    );
  }

  if (!authReady) {
    return (
      <WorkspaceLoadingScreen
        kind="auth"
        title="Preparing your workspace..."
        description="Forge is resolving your login state and loading your secure workspace."
        onRetry={() => window.location.reload()}
        onGoHome={() => navigateTo('/', 'dashboard')}
        onOpenDashboard={() => navigateTo('/dashboard', 'dashboard')}
      />
    );
  }

  if (!firebaseReady) {
    return <FirebaseSetupWizard />;
  }

  if (user && !workspaceHydrated && !showProfileSetup) {
    return (
      <WorkspaceLoadingScreen
        kind={activeTab === 'builder' ? 'editor' : 'dashboard'}
        title={activeTab === 'builder'
          ? 'Preparing your editor...'
          : 'Preparing your dashboard...'}
        description={activeTab === 'builder'
          ? 'Forge is loading your active resume, layout, and preview.'
          : 'Forge is loading your saved resumes and workspace state.'}
        onRetry={() => window.location.reload()}
        onGoHome={() => navigateTo('/', 'dashboard')}
        onOpenDashboard={() => navigateTo('/dashboard', 'dashboard')}
      />
    );
  }

  return (
    <ErrorBoundary>
      <AiSessionProvider>
      <div className="app-shell min-h-screen bg-[#0B0F14] text-zinc-100 font-sans antialiased selection:bg-emerald-300/25 selection:text-emerald-100">
      {/* HEADER BAR */}
      {(user || isGuestMode) && !showProfileSetup && (
        <Header
          user={user}
          profilePhoto={userProfile?.personalDetails.profilePhoto}
          isGuestMode={isGuestMode}
          activeTab={activeTab}
          onNavigate={navigateToTab}
          hasActiveResume={!!activeResumeId}
          onFeedbackSubmit={handleFeedbackSubmit}
          feedbackBusy={feedbackSubmitting}
          onRestartTutorial={() => {
            if (activeTab === 'settings') {
              setSettingsTourRequestId(Date.now());
            } else {
              restartTutorial();
            }
          }}
          onLogout={user ? handleLogout : returnToAuth}
        />
      )}

      {/* RENDER BODY PANEL */}
      <main className={user || isGuestMode ? 'min-h-[calc(100vh-4rem)] pb-24 lg:pb-0' : 'min-h-screen'}>
        {user || isGuestMode ? (
          showProfileSetup ? (
            <ProfileSetup onComplete={handleProfileComplete} userEmail={user?.email || ''} dbConnected={dbConnected} />
          ) : (
            <React.Suspense fallback={<WorkspaceLoadingScreen kind={activeTab === 'builder' ? 'editor' : 'workspace'} />}>
            <AnimatePresence mode="popLayout">
            {activeTab === 'dashboard' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Dashboard
                  resumes={resumes}
                  settings={effectiveSettings}
                  isGuestMode={!user}
                  hasProfileData={Boolean(
                    userProfile && (
                      userProfile.personalDetails?.fullName?.trim() ||
                      userProfile.personalDetails?.email?.trim() ||
                      userProfile.personalDetails?.phone?.trim() ||
                      userProfile.personalDetails?.location?.trim() ||
                      userProfile.personalDetails?.linkedin?.trim() ||
                      userProfile.personalDetails?.github?.trim() ||
                      userProfile.personalDetails?.website?.trim() ||
                      userProfile.summary?.trim() ||
                      userProfile.careerObjective?.trim() ||
                      userProfile.education?.length ||
                      userProfile.experience?.length ||
                      userProfile.projects?.length ||
                      userProfile.certifications?.length ||
                      userProfile.achievements?.length ||
                      Object.values(userProfile.skills || {}).some(
                        values => Array.isArray(values) && values.length > 0
                      )
                    )
                  )}
                  onCreateNew={handleCreateNewResume}
                  onDuplicate={handleDuplicateResume}
                  onDelete={handleDeleteResume}
                  onToggleArchive={handleToggleArchive}
                  onSelectResume={id => {
                    setActiveResumeId(id);
                  }}
                  onParseImport={handleParseResumeImport}
                  onSaveImport={handleSaveResumeImport}
                  onNavigate={tab => navigateTo(getPathForTab(tab), tab)}
                  onOpenAiAssist={openAiAssist}
                  onRequestSignIn={returnToAuth}
                  showToasts={triggerToast}
                />
              </motion.div>
            )}


            {activeTab === 'builder' && activeResume && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="forge-builder-page forge-product-page mx-auto px-4 py-6 sm:px-6 lg:px-8"
              >
                <div className="mb-4 grid grid-cols-2 rounded-xl border border-[#2A3644] bg-[#11151B] p-1 xl:hidden" role="tablist" aria-label="Builder view">
                  <button type="button" role="tab" aria-selected={builderMobileView === 'editor'} onClick={() => setBuilderMobileView('editor')} className={builderMobileView === 'editor' ? 'forge-builder-view-tab is-active' : 'forge-builder-view-tab'}>Editor</button>
                  <button type="button" role="tab" aria-selected={builderMobileView === 'preview'} onClick={() => setBuilderMobileView('preview')} className={builderMobileView === 'preview' ? 'forge-builder-view-tab is-active' : 'forge-builder-view-tab'}>Preview</button>
                </div>
                {/* SPLIT LAYOUT GRID */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  
                  {/* Left: Form Builder Column */}
                  <div className={`${builderMobileView === 'editor' ? 'block' : 'hidden'} xl:col-span-5 xl:block space-y-4 min-w-0`}>
                    {isGuestMode && (
                      <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] px-4 py-3 text-sm text-zinc-300">
                        <strong className="text-white">You&apos;re using Forge as Guest.</strong> Your work is saved locally on this device.
                      </div>
                    )}
                    <div className="no-print forge-builder-heading">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <h2 className="text-2xl font-bold text-white truncate max-w-[280px]">
                              {activeResume.title}
                            </h2>
                            {saving && (
                              <span className="forge-saving-badge">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>SAVING</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 mt-1">Edit sections and review the document as you work.</p>
                        </div>
                      <button
                        onClick={() => {
                          setActiveResumeId(null);
                          navigateTo('/dashboard', 'dashboard');
                        }}
                        className="forge-secondary-button"
                      >
                        Back to dashboard
                      </button>
                    </div>

                    <ResumeBuilder
                      resume={activeResume}
                      onChange={handleResumeChange}
                      settings={effectiveSettings}
                      saving={saving}
                      aiEnabled={Boolean(user)}
                      onOpenAiAssist={user ? openAiAssist : undefined}
                      showToasts={triggerToast}
                    />
                  </div>

                  {/* Right: Live Frame Preview Column */}
                  <div className={`${builderMobileView === 'preview' ? 'block' : 'hidden'} xl:col-span-7 xl:block min-w-0 xl:sticky xl:top-24`}>
                    <ResumePreview
                      resume={activeResume}
                      selectedTemplate={activeResume.templateId}
                      profilePhoto={userProfile?.personalDetails.profilePhoto}
                      onTemplateChange={async nextId => {
                        handleResumeChange({
                          ...activeResume,
                          templateId: nextId,
                        });
                      }}
                      onProfilePhotoUsageChange={useProfilePhoto => {
                        handleResumeChange({
                          ...activeResume,
                          useProfilePhoto,
                        });
                      }}
                      showToasts={triggerToast}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'builder' && !activeResume && workspaceHydrated && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="forge-product-page mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 text-center shadow-2xl shadow-black/20 sm:p-8">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2A2E37] bg-[#0F1115] text-emerald-300">
                    <Loader2 className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">No resume selected yet.</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                    Create a resume from your profile or start blank, then open it here.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => navigateTo('/dashboard', 'dashboard')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#08110F] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                    >
                    Back to Dashboard
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {atsPausedRoute && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="forge-product-page mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 text-center shadow-2xl shadow-black/20 sm:p-8">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2A2E37] bg-[#0F1115] text-emerald-300">
                    <Info className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Feature temporarily paused</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                    We’re rebuilding this feature to make it better. You can continue building and exporting resumes.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => navigateTo('/dashboard', 'dashboard')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#08110F] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                    >
                      Open Dashboard
                    </button>
                    {activeResume && (
                      <button
                        type="button"
                        onClick={() => navigateTo('/builder', 'builder')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                      >
                        Open Resume Builder
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              user ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <MyProfile
                    user={user}
                    showToasts={triggerToast}
                    profile={userProfile}
                    onProfileUpdate={setUserProfile}
                    dbConnected={dbConnected}
                    onLogout={handleLogout}
                  />
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="forge-product-page mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                  <div className="rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 text-center shadow-2xl shadow-black/20 sm:p-8">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2A2E37] bg-[#0F1115] text-emerald-300">
                      <Info className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">{guestRestrictedTitle}</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                      Guest mode keeps your resume local. Sign in to sync profile details and account settings.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <button type="button" onClick={returnToAuth} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                        Sign In
                      </button>
                      <button type="button" onClick={() => navigateTo('/dashboard', 'dashboard')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#08110F] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                        Open Dashboard
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            )}

            {activeTab === 'settings' && (
              user ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Settings
                    user={user}
                    showToasts={triggerToast}
                    onKeyConfigured={handleSettingsKeyConfigured}
                    onNavigate={tab => navigateTo(getPathForTab(tab), tab)}
                    initialTab={settingsInitialTab}
                    tourRequestId={settingsTourRequestId}
                  />
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="forge-product-page mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                  <div className="rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 text-center shadow-2xl shadow-black/20 sm:p-8">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2A2E37] bg-[#0F1115] text-emerald-300">
                      <Info className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">{guestRestrictedTitle}</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                      Guest mode keeps your resume local. Sign in to sync profile details and account settings.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <button type="button" onClick={returnToAuth} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                        Sign In
                      </button>
                      <button type="button" onClick={() => navigateTo('/dashboard', 'dashboard')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#08110F] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                        Open Dashboard
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>
          </React.Suspense>
        )
      ) : (
        <Auth onSuccess={handleAuthSuccess} onContinueAsGuest={handleContinueAsGuest} />
      )}
      </main>

      {tutorialOpen && (user || isGuestMode) && <OnboardingTour context={tutorialContext} onComplete={completeTutorial} />}

      {/* TOASTER ALERTS DRAWER */}
      <div className="no-print fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto flex items-start gap-4 rounded-xl border p-4 shadow-2xl backdrop-blur-md ${
                t.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-900/50 text-emerald-200'
                  : t.type === 'error'
                  ? 'bg-rose-950/90 border-rose-900/50 text-rose-200'
                  : 'bg-[#171A21]/95 border-zinc-800 text-zinc-200'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
              {t.type === 'error' && <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />}
              {t.type === 'info' && <Info className="h-5 w-5 text-indigo-400 shrink-0" />}
              <div className="flex-1 mt-0.5">
                <p className="text-sm font-medium leading-relaxed">{t.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
    </AiSessionProvider>
  </ErrorBoundary>
);
}

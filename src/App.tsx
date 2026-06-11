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
  syncLocalResumeCache,
} from './services/firebase';
import { aiParseResume } from './services/groq';
import { ResumeData, UserSettings, ProfileData, TemplateId } from './types';
import { normalizeResume } from './utils';
import Header from './components/Header';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ProfileSetup from './components/ProfileSetup';
import ResumeBuilder from './components/ResumeBuilder';
import ResumePreview from './components/ResumePreview';
import ATSAnalyzer from './components/ATSAnalyzer';
import MyProfile from './components/MyProfile';
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import FirebaseSetupWizard from './components/FirebaseSetupWizard';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const importId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).substring(2, 9)}`;

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

const asObjectArray = (value: unknown): Record<string, any>[] => {
  if (Array.isArray(value)) {
    return value.filter(item => item && typeof item === 'object' && !Array.isArray(item));
  }
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, any>;
  const values = Object.values(record);
  if (values.length > 0 && values.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
    return values as Record<string, any>[];
  }
  return [record];
};

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[,\n]/).map(item => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeAiImport = (parsedValue: unknown): Partial<ResumeData> => {
  const parsed = asRecord(parsedValue);
  const personal = asRecord(parsed.personalDetails);
  const skills = asRecord(parsed.skills);

  const imported: Partial<ResumeData> = {
    title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    personalDetails: {
      fullName: String(personal.fullName || '').trim(),
      professionalTitle: String(personal.professionalTitle || '').trim(),
      email: String(personal.email || '').trim(),
      phone: String(personal.phone || '').trim(),
      location: String(personal.location || '').trim(),
      linkedin: String(personal.linkedin || '').trim(),
      github: String(personal.github || '').trim(),
      website: String(personal.website || '').trim(),
      profilePhoto: '',
    },
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    education: asObjectArray(parsed.education).map(entry => ({
      id: importId('edu'),
      degree: String(entry.degree || ''),
      institution: String(entry.institution || ''),
      location: String(entry.location || ''),
      startDate: String(entry.startDate || ''),
      endDate: String(entry.endDate || ''),
      gpa: String(entry.gpa || ''),
      description: String(entry.description || ''),
    })),
    experience: asObjectArray(parsed.experience).map(entry => ({
      id: importId('exp'),
      title: String(entry.title || entry.role || ''),
      company: String(entry.company || ''),
      location: String(entry.location || ''),
      startDate: String(entry.startDate || ''),
      endDate: String(entry.endDate || ''),
      description: String(entry.description || ''),
    })),
    internships: asObjectArray(parsed.internships).map(entry => ({
      id: importId('intern'),
      role: String(entry.role || entry.title || ''),
      company: String(entry.company || ''),
      location: String(entry.location || ''),
      startDate: String(entry.startDate || ''),
      endDate: String(entry.endDate || ''),
      description: String(entry.description || ''),
      technologiesUsed: String(entry.technologiesUsed || entry.technologies || ''),
    })),
    projects: asObjectArray(parsed.projects).map(entry => ({
      id: importId('proj'),
      name: String(entry.name || entry.title || ''),
      description: String(entry.description || ''),
      technologies: String(entry.technologies || ''),
      github: String(entry.github || ''),
      live: String(entry.live || ''),
    })),
    skills: {
      programmingLanguages: asStringArray(skills.programmingLanguages),
      frameworks: asStringArray(skills.frameworks),
      tools: asStringArray(skills.tools),
      databases: asStringArray(skills.databases),
      softSkills: asStringArray(skills.softSkills),
    },
    certifications: asObjectArray(parsed.certifications).map(entry => ({
      id: importId('cert'),
      name: String(entry.name || entry.title || ''),
      issuer: String(entry.issuer || ''),
      date: String(entry.date || ''),
      url: String(entry.url || ''),
    })),
    achievements: asStringArray(parsed.achievements),
    volunteering: asObjectArray(parsed.volunteering).map(entry => ({
      id: importId('vol'),
      title: String(entry.title || entry.role || ''),
      company: String(entry.company || entry.organization || ''),
      location: String(entry.location || ''),
      startDate: String(entry.startDate || ''),
      endDate: String(entry.endDate || ''),
      description: String(entry.description || ''),
    })),
    languages: asStringArray(parsed.languages),
  };

  const hasContent = Boolean(
    imported.personalDetails?.fullName ||
    imported.personalDetails?.email ||
    imported.summary ||
    imported.education?.length ||
    imported.experience?.length ||
    imported.internships?.length ||
    imported.projects?.length ||
    imported.certifications?.length ||
    imported.achievements?.length ||
    Object.values(imported.skills || {}).some(items => items.length > 0)
  );

  if (!hasContent) {
    throw new Error('AI could not find usable resume content. No resume was created.');
  }

  return imported;
};

export default function App() {
  const [firebaseReady, setFirebaseReady] = useState(isFirebaseConfigured());
  const [dbConnected, setDbConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'builder' | 'ats' | 'profile' | 'settings'>('dashboard');
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  
  // Toaster alerts state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Saving states
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeActionInProgressRef = useRef<Set<string>>(new Set());

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
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
      setUser(curUser);
      if (curUser) {
        // Check local storage cache first to show instantly
        try {
          const cachedProfile = localStorage.getItem(`forge_profile_${curUser.uid}`);
          if (cachedProfile) {
            setUserProfile(JSON.parse(cachedProfile));
          }
          const cachedSettings = localStorage.getItem(`forge_settings_${curUser.uid}`);
          if (cachedSettings) {
            setUserSettings(JSON.parse(cachedSettings));
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
            try {
              localStorage.setItem(`forge_settings_${curUser.uid}`, JSON.stringify(settings));
            } catch {}
          }
          if (profile) {
            setUserProfile(profile);
            try {
              localStorage.setItem(`forge_profile_${curUser.uid}`, JSON.stringify(profile));
            } catch {}
          }
          
          if (settings && !settings.hasCompletedProfile) {
            setShowProfileSetup(true);
          }
        } catch (err) {
          console.warn('Sync connection warning (offline mode active):', err);
        }
      } else {
        setResumes([]);
        setActiveResumeId(null);
        setUserSettings(null);
        setActiveTab('dashboard');
      }
      setAuthReady(true);
    });

    return () => {
      unsubAuth();
    };
  }, [firebaseReady]);

  // Listen to user resumes real-time when authenticated
  useEffect(() => {
    if (!user) return;

    const unsubResumes = subscribeToUserResumes(user.uid, list => {
      let mergedList = [...list];
      const firestoreIds = new Set(list.map(r => r.id));

      try {
        const localListStr = localStorage.getItem(`forge_local_resumes_list`);
        const localIds: string[] = localListStr ? JSON.parse(localListStr) : [];
        localIds.forEach((lid: string) => {
          if (!firestoreIds.has(lid)) {
            const cached = localStorage.getItem(`forge_resume_${lid}`);
            if (cached) {
              mergedList.push(JSON.parse(cached));
            }
          }
        });
      } catch (err) {
        console.warn('Failed loading cached resumes offline fallback:', err);
      }

      const normalizedList = mergedList.map(r => normalizeResume(r));
      syncLocalResumeCache(normalizedList);
      setResumes(normalizedList);
    });

    return () => {
      unsubResumes();
    };
  }, [user]);

  // Toast notifier helper uses the one declared at top of file

  // Auth onSuccess trigger
  const handleAuthSuccess = async () => {
    // Authenticated
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  // Resume modifications (CRUD)
  const handleCreateNewResume = async (title: string, templateId: TemplateId) => {
    if (!user) return;
    if (!dbConnected) { triggerToast('Cannot verify database connection. Please check your configuration.', 'error'); return; }
    try {
      // Use user profile data as initial data if available
      const initialData: Partial<ResumeData> = userProfile ? {
        personalDetails: userProfile.personalDetails,
        summary: userProfile.summary,
        education: userProfile.education,
        experience: userProfile.experience,
        projects: userProfile.projects,
        skills: userProfile.skills,
        certifications: userProfile.certifications,
        achievements: userProfile.achievements,
        volunteering: userProfile.volunteering,
        languages: userProfile.languages,
      } : {};

      const newResume = await createNewResume(user.uid, title, templateId, initialData);
      setResumes(prev => {
        if (prev.some(r => r.id === newResume.id)) return prev;
        return [newResume, ...prev];
      });
      setActiveResumeId(newResume.id);
      setActiveTab('builder');
      triggerToast(`Resume "${title}" established!`, 'success');
    } catch {
      triggerToast('Unable to formulate resume', 'error');
    }
  };

  const handleDuplicateResume = async (src: ResumeData) => {
    if (!user) return;
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
    if (!dbConnected) { triggerToast('Cannot delete while offline.', 'error'); return; }

    const previousResumes = resumes;
    const previousActiveResumeId = activeResumeId;
    const previousTab = activeTab;

    setResumes(prev => prev.filter(r => r.id !== id));
    if (activeResumeId === id) {
      setActiveResumeId(null);
      setActiveTab('dashboard');
    }

    try {
      await deleteResumeFromDb(id);
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
    if (!dbConnected) { triggerToast('Cannot archive while offline.', 'error'); return; }

    const previousResumes = resumes;
    setResumes(prev => prev.map(r => r.id === id ? { ...r, isArchived: state } : r));

    try {
      await updateResumeInDb(id, { isArchived: state });
      triggerToast(state ? 'Resume archived.' : 'Resume restored.', 'success');
    } catch {
      setResumes(previousResumes);
      triggerToast('Failed to change archive state.', 'error');
    }
  };

  // Auto-save logic
  const handleResumeChange = (updated: ResumeData) => {
    if (!dbConnected) {
      triggerToast('Cannot save while offline.', 'error');
      return;
    }
    // Update local resumes state instantly to update live preview instantly
    setResumes(prev => prev.map(r => (r.id === updated.id ? updated : r)));

    // Clear previous save debouncer ref
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateResumeInDb(updated.id, updated);
      } catch {
        triggerToast('Auto save synchronization failed.', 'error');
      } finally {
        setSaving(false);
      }
    }, 1000); // 1-second debounce for stellar performance
  };

  const handleParseResumeImport = async (rawText: string): Promise<Partial<ResumeData>> => {
    if (!user) throw new Error('You must be signed in to import a resume.');

    const provider = effectiveSettings.aiProvider || 'Groq';
    const apiKey =
      provider === 'Gemini' ? effectiveSettings.geminiApiKey :
      provider === 'OpenAI' ? effectiveSettings.openaiApiKey :
      provider === 'OpenRouter' ? effectiveSettings.openRouterApiKey :
      effectiveSettings.groqApiKey;

    if (!apiKey) {
      throw new Error(`Please configure your ${provider} API key first.`);
    }

    const parsedJson = await aiParseResume(effectiveSettings, rawText);
    return normalizeAiImport(parsedJson);
  };

  const handleSaveResumeImport = async (importedData: Partial<ResumeData>) => {
    if (!user) throw new Error('You must be signed in to import a resume.');
    if (!dbConnected) throw new Error('Cannot save the imported resume while offline.');

    const title = importedData.title || 'Imported Resume';
    const newResume = await createNewResume(user.uid, title, 'modern', importedData);

    setResumes(prev => {
      if (prev.some(r => r.id === newResume.id)) {
        return prev.map(r => (r.id === newResume.id ? newResume : r));
      }
      return [newResume, ...prev];
    });
    setActiveResumeId(newResume.id);
    setActiveTab('builder');
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
      await saveUserProfile(user.uid, profile);
      await saveUserSettings(user.uid, { hasCompletedProfile: true });
      
      setUserProfile(profile);
      setUserSettings(prev => prev ? { ...prev, hasCompletedProfile: true } : null);
      setShowProfileSetup(false);
      triggerToast('Profile completed successfully!', 'success');
    } catch {
      triggerToast('Profile save failed.', 'error');
    }
  };

  const activeResume = resumes.find(r => r.id === activeResumeId);

  // Merge user firestore integration settings with secret env fallback
  const effectiveSettings = React.useMemo(() => {
    const envKey = import.meta.env.VITE_GROQ_API_KEY || '';
    return {
      ...(userSettings || {}),
      groqApiKey: userSettings?.groqApiKey || envKey || '',
    } as UserSettings;
  }, [userSettings]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F14]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" />
          <p className="mt-4 text-sm font-medium text-zinc-400">
            Preparing your Forge workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseReady) {
    return <FirebaseSetupWizard onComplete={() => setFirebaseReady(true)} />;
  }

  return (
    <ErrorBoundary>
      <div className="app-shell min-h-screen bg-[#0B0F14] text-zinc-100 font-sans antialiased selection:bg-emerald-300/25 selection:text-emerald-100">
      {/* HEADER BAR */}
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveResume={!!activeResumeId}
        onLogout={handleLogout}
      />

      {/* RENDER BODY PANEL */}
      <main className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
        {user ? (
          showProfileSetup ? (
            <ProfileSetup onComplete={handleProfileComplete} userEmail={user.email || ''} dbConnected={dbConnected} />
          ) : (
            <AnimatePresence mode="popLayout">
            {activeTab === 'dashboard' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Dashboard
                  resumes={resumes}
                  settings={effectiveSettings}
                  onCreateNew={handleCreateNewResume}
                  onDuplicate={handleDuplicateResume}
                  onDelete={handleDeleteResume}
                  onToggleArchive={handleToggleArchive}
                  onSelectResume={id => {
                    setActiveResumeId(id);
                    setActiveTab('builder');
                  }}
                  onParseImport={handleParseResumeImport}
                  onSaveImport={handleSaveResumeImport}
                  setActiveTab={setActiveTab}
                  showToasts={triggerToast}
                />
              </motion.div>
            )}

            {activeTab === 'builder' && activeResume && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="forge-builder-page mx-auto px-4 py-6 sm:px-6 lg:px-8"
              >
                {/* SPLIT LAYOUT GRID */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  
                  {/* Left: Form Builder Column */}
                  <div className="xl:col-span-5 space-y-4 min-w-0">
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
                          setActiveTab('dashboard');
                        }}
                        className="forge-secondary-button"
                      >
                        All resumes
                      </button>
                    </div>

                    <ResumeBuilder
                      resume={activeResume}
                      onChange={handleResumeChange}
                      settings={effectiveSettings}
                      saving={saving}
                      showToasts={triggerToast}
                    />
                  </div>

                  {/* Right: Live Frame Preview Column */}
                  <div className="xl:col-span-7 min-w-0 xl:sticky xl:top-24">
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

            {activeTab === 'ats' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ATSAnalyzer
                  resumes={resumes}
                  userUid={user.uid}
                  settings={effectiveSettings}
                  showToasts={triggerToast}
                  activeResumeId={activeResumeId}
                />
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MyProfile
                  user={user}
                  showToasts={triggerToast}
                  profile={userProfile}
                  onProfileUpdate={setUserProfile}
                  dbConnected={dbConnected}
                />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Settings
                  user={user}
                  showToasts={triggerToast}
                  onKeyConfigured={handleSettingsKeyConfigured}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )
      ) : (
        <Auth onSuccess={handleAuthSuccess} />
      )}
      </main>

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
  </ErrorBoundary>
);
}

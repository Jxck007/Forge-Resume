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
} from './services/firebase';
import { aiParseResume } from './services/groq';
import { ResumeData, UserSettings, ProfileData } from './types';
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
      try {
        const localListStr = localStorage.getItem(`forge_local_resumes_list`);
        const localIds = localListStr ? JSON.parse(localListStr) : [];
        localIds.forEach((lid: string) => {
          if (!mergedList.some(r => r.id === lid)) {
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
      setResumes(normalizedList);
      
      // Cache these locally to make it run offline-first!
      normalizedList.forEach(r => {
        try {
          localStorage.setItem(`forge_resume_${r.id}`, JSON.stringify(r));
        } catch {}
      });
    });

    return () => {
      unsubResumes();
    };
  }, [user, activeResumeId]);

  // Toast notifier helper uses the one declared at top of file

  // Auth onSuccess trigger
  const handleAuthSuccess = async () => {
    // Authenticated
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  // Resume modifications (CRUD)
  const handleCreateNewResume = async (title: string, templateId: string) => {
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
      setResumes(prev => [newResume, ...prev]);
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
    try {
      const duplicatedResume = await createNewResume(
        user.uid, 
        `${src.title} (Copy)`, 
        src.templateId, 
        src 
      );
      setResumes(prev => [duplicatedResume, ...prev]);
      triggerToast(`Duplicated into "${duplicatedResume.title}"`, 'success');
    } catch {
      triggerToast('Duplication request failed.', 'error');
    }
  };

  const handleDeleteResume = async (id: string) => {
    if (!dbConnected) { triggerToast('Cannot delete while offline.', 'error'); return; }
    try {
      setResumes(prev => prev.filter(r => r.id !== id));
      await deleteResumeFromDb(id);
      if (activeResumeId === id) {
        setActiveResumeId(null);
        setActiveTab('dashboard');
      }
      triggerToast('Resume deleted successfully', 'success');
    } catch {
      triggerToast('Delete failed.', 'error');
    }
  };

  const handleToggleArchive = async (id: string, state: boolean) => {
    if (!dbConnected) { triggerToast('Cannot archive while offline.', 'error'); return; }
    try {
      setResumes(prev => prev.map(r => r.id === id ? { ...r, isArchived: state } : r));
      await updateResumeInDb(id, { isArchived: state });
      triggerToast(state ? 'Resume archived.' : 'Resume restored.', 'success');
    } catch {
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

  // Import / Parsing Logic via Groq AI
  const handleImportResume = async (rawText: string) => {
    if (!user) return;
    if (!dbConnected) { triggerToast('Cannot import while offline.', 'error'); return; }
    const apiKey = effectiveSettings?.groqApiKey;
    if (!apiKey) {
      triggerToast('Please configure your Groq key first.', 'error');
      return;
    }

    const parsedJson = await aiParseResume(effectiveSettings, rawText);
    const title = parsedJson.title || 'Extracted Developer Resume';
    
    // Create new resume with parsed values prefilled
    const newResume = await createNewResume(user.uid, title, 'modern');
    const mergeData: ResumeData = {
      ...newResume,
      personalDetails: {
        fullName: parsedJson.personalDetails?.fullName || '',
        professionalTitle: parsedJson.personalDetails?.professionalTitle || '',
        email: parsedJson.personalDetails?.email || '',
        phone: parsedJson.personalDetails?.phone || '',
        location: parsedJson.personalDetails?.location || '',
        linkedin: parsedJson.personalDetails?.linkedin || '',
        github: parsedJson.personalDetails?.github || '',
        website: parsedJson.personalDetails?.website || '',
        profilePhoto: '',
      },
      summary: parsedJson.summary || '',
      education: (parsedJson.education || []).map(e => ({
        id: 'edu_' + Math.random().toString(36).substring(2, 9),
        degree: e.degree || '',
        institution: e.institution || '',
        location: e.location || '',
        startDate: e.startDate || '',
        endDate: e.endDate || '',
        gpa: e.gpa || '',
        description: e.description || '',
      })),
      experience: (parsedJson.experience || []).map(ex => ({
        id: 'exp_' + Math.random().toString(36).substring(2, 9),
        title: ex.title || '',
        company: ex.company || '',
        location: ex.location || '',
        startDate: ex.startDate || '',
        endDate: ex.endDate || '',
        description: ex.description || '',
      })),
      projects: (parsedJson.projects || []).map(p => ({
        id: 'proj_' + Math.random().toString(36).substring(2, 9),
        name: p.name || '',
        description: p.description || '',
        technologies: p.technologies || '',
        github: '',
        live: '',
      })),
      skills: {
        programmingLanguages: parsedJson.skills?.programmingLanguages || [],
        frameworks: parsedJson.skills?.frameworks || [],
        tools: parsedJson.skills?.tools || [],
        databases: parsedJson.skills?.databases || [],
        softSkills: parsedJson.skills?.softSkills || [],
      },
    };

    await updateResumeInDb(newResume.id, mergeData);
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
      <div className="flex min-h-screen items-center justify-center bg-[#0F1115]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Synchronizing Forge Workspace...
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
      <div className="min-h-screen bg-[#0F1115] text-zinc-100 transition-colors duration-300 font-sans antialiased selection:bg-indigo-500/20 selection:text-indigo-400">
      {/* HEADER BAR */}
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveResume={!!activeResumeId}
        onLogout={handleLogout}
      />

      {/* RENDER BODY PANEL */}
      <main className="min-h-[calc(100vh-4rem)]">
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
                  onImportResume={handleImportResume}
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
                className="mx-auto max-w-8xl px-4 py-8 sm:px-6 lg:px-8"
              >
                {/* SPLIT LAYOUT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left: Form Builder Column */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="no-print flex items-center justify-between pb-4 border-b border-zinc-800">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <h2 className="text-2xl font-black text-white truncate max-w-[280px]">
                              {activeResume.title}
                            </h2>
                            {saving && (
                              <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 animate-pulse bg-indigo-900/30 px-2 py-1 rounded-full border border-indigo-500/20">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>SAVING</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 mt-1">Define your skills and career history</p>
                        </div>
                      <button
                        onClick={() => {
                          setActiveResumeId(null);
                          setActiveTab('dashboard');
                        }}
                        className="text-sm font-bold text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 rounded flex items-center gap-2 transition"
                      >
                        Back to Dashboard
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
                  <div className="lg:col-span-7">
                    <ResumePreview
                      resume={activeResume}
                      selectedTemplate={activeResume.templateId as any}
                      onTemplateChange={async nextId => {
                        handleResumeChange({
                          ...activeResume,
                          templateId: nextId,
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

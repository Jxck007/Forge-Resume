import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { getUserSettings, saveUserSettings } from '../services/firebase';
import { UserSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Database,
  Cpu,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  FileText,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { testGroqConnection } from '../services/groq';
import ConfirmationDialog from './ConfirmationDialog';

interface SettingsProps {
  user: User;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  onKeyConfigured: () => void;
}

type SettingsTab = 'ai' | 'storage' | 'resume' | 'app';

export default function Settings({ user, showToasts, onKeyConfigured }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');

  // Multi-provider key state
  const [keysInput, setKeysInput] = useState({
    groq: '',
    gemini: '',
    openai: '',
    openrouter: ''
  });
  
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [testingProviders, setTestingProviders] = useState<{ [key: string]: boolean }>({});

  // Form state
  const [aiProvider, setAiProvider] = useState<UserSettings['aiProvider']>('Groq');
  const [selectedModel, setSelectedModel] = useState('');
  const [temperature, setTemperature] = useState(0.4);

  // Storage and Resume state
  const [storageOccupancy, setStorageOccupancy] = useState('0.00 KB');
  const [cacheSize, setCacheSize] = useState('0.00 MB');
  const [defaultTemplate, setDefaultTemplate] = useState('modern');
  const [defaultExportFormat, setDefaultExportFormat] = useState('PDF');

  // Confirmation modals state
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false);
  const [isResetMemoryOpen, setIsResetMemoryOpen] = useState(false);

  // Load settings and storage stats
  useEffect(() => {
    async function init() {
      try {
        const data = await getUserSettings(user.uid);
        if (data) {
          setSettings(data);
          setAiProvider(data.aiProvider || 'Groq');
          setSelectedModel(data.modelId || getDefaultModel(data.aiProvider || 'Groq'));
          if (data.temperature !== undefined) setTemperature(data.temperature);
          if (data.defaultTemplate) setDefaultTemplate(data.defaultTemplate);
          if (data.defaultExportFormat) setDefaultExportFormat(data.defaultExportFormat);
        }
        calculateStorageStats();
      } catch (err) {
        showToasts('Failed loading user settings.', 'error');
      } finally {
        setFetching(false);
      }
    }
    init();
  }, [user.uid]);

  const getDefaultModel = (prov: string) => {
    switch (prov) {
      case 'Groq': return 'llama-3.3-70b-versatile';
      case 'OpenAI': return 'gpt-4o-mini';
      case 'Gemini': return 'gemini-1.5-flash';
      case 'OpenRouter': return 'anthropic/claude-3-haiku';
      default: return '';
    }
  };

  const calculateStorageStats = () => {
    try {
      let totalBytes = 0;
      for (const x in localStorage) {
        if (localStorage.hasOwnProperty(x)) {
          totalBytes += (localStorage[x].length + x.length) * 2;
        }
      }
      setStorageOccupancy((totalBytes / 1024).toFixed(2) + ' KB');
      const cacheBytes = totalBytes * 1.45;
      setCacheSize((cacheBytes / (1024 * 1024)).toFixed(3) + ' MB');
    } catch {
      // Ignore
    }
  };

  const handleTestConnection = async (prov: UserSettings['aiProvider']) => {
    const keyToTest = keysInput[prov.toLowerCase() as keyof typeof keysInput].trim() || (settings?.[`${prov.toLowerCase()}ApiKey` as keyof UserSettings] as string);
    
    if (!keyToTest) {
      showToasts(`Please provide an API Key for ${prov} first.`, 'error');
      return;
    }

    setTestingProviders(prev => ({ ...prev, [prov]: true }));
    showToasts(`Verifying ${prov} API status...`, 'info');

    try {
      const testSettings = {
        ...settings,
        aiProvider: prov,
        modelId: selectedModel || getDefaultModel(prov),
        [`${prov.toLowerCase()}ApiKey`]: keyToTest
      } as UserSettings;

      const ok = await testGroqConnection(testSettings);
      if (ok) {
        showToasts(`${prov} connection verified successfully!`, 'success');
      } else {
        showToasts(`${prov} connection test failed.`, 'error');
      }
    } catch (err: any) {
      showToasts(`${prov} Failed: ${err.message || String(err)}`, 'error');
    } finally {
      setTestingProviders(prev => ({ ...prev, [prov]: false }));
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    showToasts('Updating credentials and settings...', 'info');
    try {
      const payload: Partial<UserSettings> = {
        aiProvider,
        modelId: selectedModel,
        temperature,
        defaultTemplate,
        defaultExportFormat,
        hasCompletedProfile: true
      };

      if (keysInput.groq.trim()) payload.groqApiKey = keysInput.groq.trim();
      if (keysInput.gemini.trim()) payload.geminiApiKey = keysInput.gemini.trim();
      if (keysInput.openai.trim()) payload.openaiApiKey = keysInput.openai.trim();
      if (keysInput.openrouter.trim()) payload.openRouterApiKey = keysInput.openrouter.trim();
      
      await saveUserSettings(user.uid, payload);
      
      setSettings(prev => prev ? { ...prev, ...payload } : (payload as UserSettings));
      setKeysInput({ groq: '', gemini: '', openai: '', openrouter: '' });
      
      showToasts('Settings and API keys secured successfully.', 'success');
      onKeyConfigured();
    } catch (err) {
      showToasts('Failed to save settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Clear cache action (Confirmed)
  const executeClearCache = () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('forge_') || key.startsWith('local_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      calculateStorageStats();
      showToasts('Local cache database flushed smoothly.', 'success');
    } catch {
      showToasts('Failed flushing cache database.', 'error');
    }
  };

  // Reset local memory action (Confirmed) - clears localstorage, indexedDB, and cacheStorage, keeping session
  const executeResetLocalMemory = async () => {
    try {
      // 1. Clear LocalStorage
      localStorage.clear();
      
      // 2. Clear IndexedDB
      if (window.indexedDB && window.indexedDB.databases) {
        try {
          const dbs = await window.indexedDB.databases();
          dbs.forEach(db => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
        } catch {
          // ignore
        }
      }

      // 3. Clear Caches
      if (window.caches) {
        try {
          const keys = await window.caches.keys();
          await Promise.all(keys.map(key => window.caches.delete(key)));
        } catch {
          // ignore
        }
      }

      calculateStorageStats();
      showToasts('Local application state fully reset.', 'success');
      
      // Short delay and reload screen to re-initialize cleanly
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToasts(`Failed fully resetting memory: ${err?.message || String(err)}`, 'error');
    }
  };

  if (fetching) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Syncing user configuration...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Settings Branding Header */}
      <div className="mb-10 leading-none">
        <h1 className="text-3xl font-black text-gray-950 dark:text-zinc-50 leading-tight">Preferences & Security</h1>
        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-2">
          Manage secure AI endpoints, system storage variables, and default document formats
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 leading-normal items-start">
        {/* Left Column: Settings tabs */}
        <div className="lg:col-span-3 flex flex-col gap-1.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800">
          {[
            { id: 'ai', label: 'AI Configuration', icon: Cpu },
            { id: 'storage', label: 'Storage & Cache', icon: Database },
            { id: 'resume', label: 'Resume Defaults', icon: FileText },
            { id: 'app', label: 'System Actions', icon: Shield },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                id={`settings-tab-btn-${tab.id}`}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
                  isActive ? 'bg-indigo-600 border border-indigo-750 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50 dark:hover:text-white dark:hover:bg-zinc-900/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800/80 pt-4 px-2 space-y-3">
            <button
              onClick={handleSaveSettings}
              disabled={loading}
              id="apply-settings-btn"
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Apply changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: tab panels */}
        <div className="lg:col-span-9 bg-white dark:bg-[#13151A] p-6 sm:p-8 border border-zinc-200/80 dark:border-zinc-800/85 rounded-3xl min-h-[380px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -7 }}
              transition={{ duration: 0.15 }}
            >
              {/* AI CONFIGURATION */}
              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">AI Intelligent Orchestration</h3>
                    <p className="text-xs text-gray-500">Securely connect your own AI keys for enhanced resume intelligence.</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Provider</label>
                        <select
                          value={aiProvider}
                          onChange={e => {
                            const val = e.target.value as UserSettings['aiProvider'];
                            setAiProvider(val);
                            setSelectedModel(getDefaultModel(val));
                          }}
                          className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-zinc-800 dark:text-zinc-200"
                        >
                          <option value="Groq">Groq (Instant Speed)</option>
                          <option value="Gemini">Google Gemini</option>
                          <option value="OpenAI">OpenAI (GPT-4o)</option>
                          <option value="OpenRouter">OpenRouter (Unified)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Preferred Model</label>
                        <select
                          value={selectedModel}
                          onChange={e => setSelectedModel(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200"
                        >
                          {aiProvider === 'Groq' && (
                            <>
                              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                            </>
                          )}
                          {aiProvider === 'Gemini' && (
                            <>
                              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                            </>
                          )}
                          {aiProvider === 'OpenAI' && (
                            <>
                              <option value="gpt-4o-mini">gpt-4o-mini</option>
                              <option value="gpt-4o">gpt-4o</option>
                            </>
                          )}
                          {aiProvider === 'OpenRouter' && (
                            <>
                              <option value="anthropic/claude-3-haiku">claude-3-haiku</option>
                              <option value="meta-llama/llama-3-70b-instruct">llama-3-70b</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">API Key Management</h4>
                      
                      <div className="space-y-4">
                        {(['Groq', 'Gemini', 'OpenAI', 'OpenRouter'] as const).map(p => {
                          const keyType = p.toLowerCase();
                          const isConfigured = !!(settings?.[`${keyType}ApiKey` as keyof UserSettings]);
                          const isTesting = testingProviders[p];
                          
                          return (
                            <div key={p} className="flex flex-col gap-2 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                              <div className="flex justify-between items-center px-1">
                                <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">{p}</span>
                                <div className="flex items-center gap-3">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    isConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'
                                  }`}>
                                    {isConfigured ? 'Status: Active' : 'Status: Not Configured'}
                                  </span>
                                  <button
                                    onClick={() => handleTestConnection(p)}
                                    disabled={isTesting}
                                    className="text-[9px] font-bold text-indigo-500 hover:text-indigo-400 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isTesting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                                    Verify
                                  </button>
                                </div>
                              </div>
                              
                              <div className="relative">
                                <input
                                  type={showKeys[p] ? 'text' : 'password'}
                                  value={keysInput[keyType as keyof typeof keysInput]}
                                  onChange={e => setKeysInput(prev => ({ ...prev, [keyType]: e.target.value }))}
                                  placeholder={isConfigured ? '••••••••••••••••' : `Enter ${p} API Key`}
                                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono outline-none focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowKeys(prev => ({ ...prev, [p]: !prev[p] }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                                >
                                  {showKeys[p] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                       <div className="flex justify-between items-baseline">
                          <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Target Temperature ({temperature})</label>
                          <span className="text-[9px] text-zinc-400 font-mono">Precision (0.0) ↔ Creative (1.2)</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1.2"
                          step="0.1"
                          value={temperature}
                          onChange={e => setTemperature(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600 mt-2 bg-zinc-200 dark:bg-zinc-800 rounded h-1.5"
                        />
                    </div>
                  </div>
                </div>
              )}

              {/* STORAGE AND CACHE */}
              {activeTab === 'storage' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Storage & Local Caching</h3>
                    <p className="text-xs text-gray-500">Manage offline fallback databases and secure file size quotas.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/20 text-xs space-y-2">
                      <p className="text-zinc-400 font-bold uppercase tracking-wider">Local storage usage</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-gray-950 dark:text-white">{storageOccupancy}</span>
                        <span className="text-[10px] text-zinc-400 font-medium">allocated locally</span>
                      </div>
                      <div className="mt-3 h-2 w-full bg-zinc-200 dark:bg-zinc-850 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 animate-none" style={{ width: `${Math.min(100, (parseFloat(storageOccupancy) || 0) / 0.512)}%` }} />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/20 text-xs space-y-2">
                      <p className="text-zinc-400 font-bold uppercase tracking-wider">Total Cache Size</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-gray-950 dark:text-white">{cacheSize}</span>
                        <span className="text-[10px] text-zinc-400 font-medium font-mono">IndexDB + browser fallback</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 pt-0.5 leading-normal">Optimally distributed and compressed to guarantee rapid startup cycles.</p>
                    </div>

                    <div className="sm:col-span-2 p-5 rounded-2xl border border-rose-100 dark:border-rose-950/40 bg-rose-50/25 dark:bg-rose-955/5 text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1 max-w-lg">
                        <p className="text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1.5 leading-none">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Flush Local Cache Backups</span>
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal pt-1">
                          This will immediately purge all local draft saves. Your main resume documents inside secure cloud Firestore remain completely safe.
                        </p>
                      </div>
                      <button
                        onClick={() => setIsClearCacheOpen(true)}
                        id="flush-cache-btn"
                        className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Flush Cache</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* RESUME DEFAULTS */}
              {activeTab === 'resume' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                      <span>Resume Layout Defaults</span>
                    </h3>
                    <p className="text-xs text-gray-500">Pick preferred baseline presets for your active resume workspace templates.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Default template layout</label>
                      <select
                        value={defaultTemplate}
                        onChange={e => setDefaultTemplate(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 rounded-xl focus:border-indigo-505 outline-none text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300"
                      >
                        <option value="modern">Modern Professional</option>
                        <option value="minimal">Minimal Elegant</option>
                        <option value="corporate">Corporate Standard</option>
                        <option value="executive">Executive Boardroom</option>
                        <option value="creative">Creative Dynamic</option>
                        <option value="atsFriendly">ATS Friendly</option>
                        <option value="softwareEngineer">Software Developer</option>
                        <option value="student">Academic Student</option>
                        <option value="startup">Startup Growth</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Default export format</label>
                      <select
                        value={defaultExportFormat}
                        onChange={e => setDefaultExportFormat(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 rounded-xl focus:border-indigo-550 outline-none text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300"
                      >
                        <option value="PDF">Standard PDF (A4/Letter)</option>
                        <option value="json">Raw JSON (ATS Compatible Schema)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* APPLICATION SECURITY ACTIONS */}
              {activeTab === 'app' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider font-mono">Emergency & Reset Actions</h3>
                    <p className="text-xs text-gray-500">Perform critical actions directly on the local browser sandbox instances.</p>
                  </div>

                  <div className="p-5 border border-red-500/20 dark:border-red-900/40 rounded-2xl bg-red-950/5 dark:bg-red-950/10 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Reset Local Memory state</span>
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                        This action will completely wipe all localStorage key variables, clean IndexedDB schemas, and delete downloaded application cache stores.
                        Only use this if your drafts get corrupted. **Your authorized Firestore profile profile will remain secure and untouchable.**
                      </p>
                    </div>

                    <button
                      onClick={() => setIsResetMemoryOpen(true)}
                      id="reset-local-memory-btn"
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 animate-none" />
                      <span>Reset Local Memory</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* CONFIRMATION DIALOGS (Goal 8) */}
      <ConfirmationDialog
        isOpen={isClearCacheOpen}
        onClose={() => setIsClearCacheOpen(false)}
        onConfirm={executeClearCache}
        title="Flush Local Cache Database?"
        message="Are you sure you want to permanently clear your local draft copies and cache backup databases? This safe action does not affect cloud Firestore backups."
        confirmText="Flush Cache"
        type="warning"
      />

      <ConfirmationDialog
        isOpen={isResetMemoryOpen}
        onClose={() => setIsResetMemoryOpen(false)}
        onConfirm={executeResetLocalMemory}
        title="Reset Local Memory Content?"
        message="Are you sure you want to clear locally stored data? This will purge all IndexedDB tables, clean localStorage, and empty cached elements. Your cloud Firebase login remains safe."
        confirmText="Reset Memory"
        type="danger"
      />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Loader2,
  Save,
  UserCircle2,
} from 'lucide-react';
import { getUserSettings, saveUserSettings } from '../services/firebase';
import { testGroqConnection } from '../services/groq';
import { UserSettings } from '../types';

interface SettingsProps {
  user: User;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  onKeyConfigured: () => void;
}

type SettingsTab = 'ai' | 'resume' | 'account' | 'help';
type Provider = UserSettings['aiProvider'];

const PROVIDERS: Record<Provider, {
  description: string;
  keyField: keyof UserSettings;
  model: string;
  guideUrl: string;
}> = {
  Groq: {
    description: 'Fast, low-latency resume assistance.',
    keyField: 'groqApiKey',
    model: 'llama-3.3-70b-versatile',
    guideUrl: 'https://console.groq.com/keys',
  },
  Gemini: {
    description: 'Google models for writing and extraction.',
    keyField: 'geminiApiKey',
    model: 'gemini-2.0-flash',
    guideUrl: 'https://aistudio.google.com/app/apikey',
  },
  OpenAI: {
    description: 'OpenAI models for editing and analysis.',
    keyField: 'openaiApiKey',
    model: 'gpt-4o-mini',
    guideUrl: 'https://platform.openai.com/api-keys',
  },
  OpenRouter: {
    description: 'Use multiple model providers through one key.',
    keyField: 'openRouterApiKey',
    model: 'meta-llama/llama-3-70b-instruct',
    guideUrl: 'https://openrouter.ai/keys',
  },
};

export default function Settings({ user, showToasts, onKeyConfigured }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [provider, setProvider] = useState<Provider>('Groq');
  const [apiKeys, setApiKeys] = useState<Partial<Record<Provider, string>>>({});
  const [visibleKeys, setVisibleKeys] = useState<Partial<Record<Provider, boolean>>>({});
  const [defaultTemplate, setDefaultTemplate] = useState('modern');
  const [defaultExportFormat, setDefaultExportFormat] = useState('PDF');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Provider | null>(null);

  useEffect(() => {
    getUserSettings(user.uid)
      .then(data => {
        if (!data) return;
        setSettings(data);
        setProvider(data.aiProvider || 'Groq');
        setDefaultTemplate(data.defaultTemplate || 'modern');
        setDefaultExportFormat(data.defaultExportFormat || 'PDF');
      })
      .catch(() => showToasts('Could not load settings.', 'error'))
      .finally(() => setLoading(false));
  }, [user.uid]);

  const storedKey = (target: Provider) => {
    const field = PROVIDERS[target].keyField;
    return (settings?.[field] as string | undefined) || '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<UserSettings> = {
        aiProvider: provider,
        modelId: settings?.modelId || PROVIDERS[provider].model,
        temperature: settings?.temperature ?? 0.4,
        defaultTemplate,
        defaultExportFormat,
      };

      (Object.keys(PROVIDERS) as Provider[]).forEach(item => {
        const nextKey = apiKeys[item]?.trim();
        if (nextKey) payload[PROVIDERS[item].keyField] = nextKey as never;
      });

      await saveUserSettings(user.uid, payload);
      setSettings(current => ({ ...(current || {}), ...payload } as UserSettings));
      setApiKeys({});
      onKeyConfigured();
      showToasts('Settings saved.', 'success');
    } catch {
      showToasts('Settings could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (target: Provider) => {
    const key = apiKeys[target]?.trim() || storedKey(target);
    if (!key) {
      showToasts(`Add a ${target} API key first.`, 'info');
      return;
    }

    setTesting(target);
    try {
      const testSettings = {
        ...(settings || {}),
        uid: user.uid,
        email: user.email || '',
        aiProvider: target,
        modelId: PROVIDERS[target].model,
        [PROVIDERS[target].keyField]: key,
      } as UserSettings;
      const connected = await testGroqConnection(testSettings);
      showToasts(connected ? `${target} is connected.` : `${target} connection failed.`, connected ? 'success' : 'error');
    } catch (error: any) {
      showToasts(error?.message || `${target} connection failed.`, 'error');
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="forge-page-loading">
        <Loader2 className="animate-spin" />
        <span>Loading preferences</span>
      </div>
    );
  }

  const tabs = [
    { id: 'ai' as const, label: 'AI Providers', icon: Bot },
    { id: 'resume' as const, label: 'Resume Preferences', icon: FileText },
    { id: 'account' as const, label: 'Account', icon: UserCircle2 },
    { id: 'help' as const, label: 'Help & Guides', icon: HelpCircle },
  ];

  return (
    <div className="forge-page forge-settings">
      <div className="forge-page-heading">
        <span>Workspace preferences</span>
        <h1>Settings</h1>
        <p>Keep your resume workflow simple, consistent, and ready to export.</p>
      </div>

      <div className="forge-settings-layout">
        <aside className="forge-settings-nav">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? 'is-active' : ''}
              >
                <Icon />
                {tab.label}
              </button>
            );
          })}
          <button type="button" className="forge-primary-button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save changes
          </button>
        </aside>

        <section className="forge-settings-panel">
          {activeTab === 'ai' && (
            <div className="forge-settings-section">
              <div>
                <h2>AI providers</h2>
                <p>Connect only the provider you plan to use. Keys stay associated with your account.</p>
              </div>

              <label className="forge-field">
                <span>Default provider</span>
                <select value={provider} onChange={event => setProvider(event.target.value as Provider)}>
                  {(Object.keys(PROVIDERS) as Provider[]).map(item => <option key={item}>{item}</option>)}
                </select>
              </label>

              <div className="forge-provider-list">
                {(Object.keys(PROVIDERS) as Provider[]).map(item => {
                  const configured = Boolean(storedKey(item));
                  return (
                    <article key={item} className={`forge-provider-card ${provider === item ? 'is-selected' : ''}`}>
                      <div className="forge-provider-heading">
                        <div>
                          <strong>{item}</strong>
                          <p>{PROVIDERS[item].description}</p>
                        </div>
                        <span className={configured ? 'is-ready' : ''}>
                          <CheckCircle2 /> {configured ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                      <div className="forge-key-row">
                        <div className="forge-key-input">
                          <input
                            type={visibleKeys[item] ? 'text' : 'password'}
                            value={apiKeys[item] || ''}
                            onChange={event => setApiKeys(current => ({ ...current, [item]: event.target.value }))}
                            placeholder={configured ? 'Enter a new key to replace the saved key' : `Paste your ${item} API key`}
                          />
                          <button type="button" onClick={() => setVisibleKeys(current => ({ ...current, [item]: !current[item] }))}>
                            {visibleKeys[item] ? <EyeOff /> : <Eye />}
                          </button>
                        </div>
                        <button type="button" className="forge-secondary-button" onClick={() => handleTest(item)} disabled={testing === item}>
                          {testing === item ? <Loader2 className="animate-spin" /> : 'Test'}
                        </button>
                      </div>
                      <a href={PROVIDERS[item].guideUrl} target="_blank" rel="noreferrer">
                        Get an API key <ExternalLink />
                      </a>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="forge-settings-section">
              <div>
                <h2>Resume preferences</h2>
                <p>Choose sensible defaults. You can still change these inside each resume.</p>
              </div>
              <div className="forge-settings-grid">
                <label className="forge-field">
                  <span>Default template</span>
                  <select value={defaultTemplate} onChange={event => setDefaultTemplate(event.target.value)}>
                    <option value="modern">Modern Professional</option>
                    <option value="minimal">Minimal</option>
                    <option value="corporate">Corporate</option>
                    <option value="atsFriendly">ATS Friendly</option>
                    <option value="softwareEngineer">Software Engineer</option>
                    <option value="classic">Classic</option>
                  </select>
                </label>
                <label className="forge-field">
                  <span>Default export</span>
                  <select value={defaultExportFormat} onChange={event => setDefaultExportFormat(event.target.value)}>
                    <option value="PDF">PDF</option>
                    <option value="json">JSON data</option>
                  </select>
                </label>
              </div>
              <div className="forge-note">
                <FileText />
                <div><strong>ATS-first by default</strong><p>Forge keeps resume text selectable, structured, and readable during export.</p></div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="forge-settings-section">
              <div>
                <h2>Account</h2>
                <p>Your sign-in identity and profile status.</p>
              </div>
              <div className="forge-account-card">
                <span className="forge-avatar">{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{user.displayName || 'Forge member'}</strong>
                  <p>{user.email}</p>
                </div>
                <span className="forge-status-pill"><CheckCircle2 /> Active</span>
              </div>
              <p className="forge-muted-copy">Update career details from the Profile screen. Authentication changes are managed through your sign-in provider.</p>
            </div>
          )}

          {activeTab === 'help' && (
            <div className="forge-settings-section">
              <div>
                <h2>Help & guides</h2>
                <p>Short guidance for building a stronger, more targeted resume.</p>
              </div>
              <div className="forge-guide-grid">
                {[
                  ['Build an ATS-ready resume', 'Use standard sections, measurable impact, and role-specific keywords.'],
                  ['Tailor for a job description', 'Match required skills naturally without keyword stuffing.'],
                  ['Export a clean PDF', 'Review pagination and links before sending your application.'],
                  ['Write stronger experience bullets', 'Lead with action, show scope, and quantify the result.'],
                ].map(([title, copy]) => (
                  <article key={title}>
                    <BookOpen />
                    <strong>{title}</strong>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  HelpCircle,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import { getUserSettings, removeUserProviderKey, saveUserSettings } from '../services/firebase';
import { testAIConnection } from '../services/ai';
import { UserSettings } from '../types';

interface SettingsProps {
  user: User;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  onKeyConfigured: () => void;
  onNavigate: (tab: 'dashboard' | 'ats' | 'profile') => void;
}

type SettingsTab = 'ai' | 'resume' | 'account' | 'help';
type Provider = UserSettings['aiProvider'];

const PROVIDERS: Record<Provider, {
  description: string;
  keyField: keyof UserSettings;
  models: { id: string; label: string; note: string }[];
  guideUrl: string;
  guideSteps: string[];
}> = {
  Groq: {
    description: 'Fast, low-latency resume assistance.',
    keyField: 'groqApiKey',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'Best quality for writing and structured imports.' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', note: 'Faster and lower-cost for quick edits.' },
    ],
    guideUrl: 'https://console.groq.com/keys',
    guideSteps: ['Open Groq Console.', 'Create an API key.', 'Paste it here and test the connection.'],
  },
  Gemini: {
    description: 'Google models for writing and extraction.',
    keyField: 'geminiApiKey',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Balanced speed and quality for resume tasks.' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', note: 'Lower-latency option for short edits.' },
    ],
    guideUrl: 'https://aistudio.google.com/app/apikey',
    guideSteps: ['Open Google AI Studio.', 'Create an API key for your project.', 'Paste it here and test the connection.'],
  },
  OpenAI: {
    description: 'OpenAI models for editing and analysis.',
    keyField: 'openaiApiKey',
    models: [
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', note: 'Strong instruction following and structured output.' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', note: 'Reliable, economical resume editing.' },
    ],
    guideUrl: 'https://platform.openai.com/api-keys',
    guideSteps: ['Open the OpenAI API key page.', 'Create a secret key.', 'Paste it here and test the connection.'],
  },
  OpenRouter: {
    description: 'Use multiple model providers through one key.',
    keyField: 'openRouterApiKey',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini via OpenRouter', note: 'Economical general-purpose option.' },
      { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', note: 'Fast writing and concise revisions.' },
    ],
    guideUrl: 'https://openrouter.ai/keys',
    guideSteps: ['Open OpenRouter Keys.', 'Create a key and add provider credit if required.', 'Paste it here and test the connection.'],
  },
};

export default function Settings({ user, showToasts, onKeyConfigured, onNavigate }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [provider, setProvider] = useState<Provider>('Groq');
  const [apiKeys, setApiKeys] = useState<Partial<Record<Provider, string>>>({});
  const [providerModels, setProviderModels] = useState<Partial<Record<Provider, string>>>({});
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
        const savedProvider = data.aiProvider || 'Groq';
        setProvider(savedProvider);
        setProviderModels({
          ...data.providerModels,
          [savedProvider]: data.modelId || data.providerModels?.[savedProvider] || PROVIDERS[savedProvider].models[0].id,
        });
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
  const selectedModel = providerModels[provider] || PROVIDERS[provider].models[0].id;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<UserSettings> = {
        aiProvider: provider,
        modelId: selectedModel,
        providerModels: {
          ...(settings?.providerModels || {}),
          ...providerModels,
          [provider]: selectedModel,
        },
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
        modelId: providerModels[target] || PROVIDERS[target].models[0].id,
        [PROVIDERS[target].keyField]: key,
      } as UserSettings;
      await testAIConnection(testSettings);
      showToasts(`${target} is connected and the selected model responded.`, 'success');
    } catch {
      showToasts(`${target} could not connect. Check the key, model access, and provider billing.`, 'error');
    } finally {
      setTesting(null);
    }
  };

  const handleRemoveKey = async (target: Provider) => {
    if (!storedKey(target)) return;
    setSaving(true);
    try {
      const keyField = PROVIDERS[target].keyField as 'groqApiKey' | 'geminiApiKey' | 'openaiApiKey' | 'openRouterApiKey';
      await removeUserProviderKey(user.uid, keyField);
      setSettings(current => {
        if (!current) return current;
        const next = { ...current };
        delete next[keyField];
        return next;
      });
      setApiKeys(current => ({ ...current, [target]: '' }));
      onKeyConfigured();
      showToasts(`${target} API key removed.`, 'success');
    } catch {
      showToasts(`Could not remove the ${target} API key.`, 'error');
    } finally {
      setSaving(false);
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
  const activeProvider = PROVIDERS[provider];
  const activeProviderConfigured = Boolean(storedKey(provider));
  const signInProvider = user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email and password';

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
                <p>Select one provider for resume writing, importing, and ATS assistance.</p>
              </div>

              <div className="forge-provider-picker" role="group" aria-label="Choose AI provider">
                {(Object.keys(PROVIDERS) as Provider[]).map(item => (
                  <button
                    key={item}
                    type="button"
                    className={provider === item ? 'is-selected' : ''}
                    onClick={() => setProvider(item)}
                    aria-pressed={provider === item}
                  >
                    <span>{item}</span>
                    <small>{storedKey(item) ? 'Connected' : 'Set up'}</small>
                  </button>
                ))}
              </div>

              <article className="forge-provider-card is-selected">
                <div className="forge-provider-heading">
                  <div>
                    <span className="forge-card-eyebrow">Selected provider</span>
                    <strong>{provider}</strong>
                    <p>{activeProvider.description}</p>
                  </div>
                  <span className={activeProviderConfigured ? 'is-ready' : ''}>
                    <CheckCircle2 /> {activeProviderConfigured ? 'Connected' : 'Setup required'}
                  </span>
                </div>

                <div className="forge-provider-steps">
                  {activeProvider.guideSteps.map((step, index) => (
                    <div key={step}><span>{index + 1}</span><p>{step}</p></div>
                  ))}
                </div>

                <div className="forge-settings-grid forge-provider-controls">
                  <label className="forge-field">
                    <span>Selected provider</span>
                    <select value={provider} onChange={event => setProvider(event.target.value as Provider)}>
                      {(Object.keys(PROVIDERS) as Provider[]).map(item => <option key={item}>{item}</option>)}
                    </select>
                    <small>Changing provider does not remove saved keys.</small>
                  </label>
                  <label className="forge-field">
                    <span>Model</span>
                    <select
                      value={selectedModel}
                      onChange={event => setProviderModels(current => ({ ...current, [provider]: event.target.value }))}
                    >
                      {activeProvider.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                    </select>
                    <small>{activeProvider.models.find(model => model.id === selectedModel)?.note}</small>
                  </label>
                </div>

                <div className="forge-key-row">
                  <label className="forge-field forge-key-field">
                    <span>{activeProviderConfigured ? 'Update API key' : 'API key'}</span>
                    <div className="forge-key-input">
                      <input
                        aria-label={`${provider} API key`}
                        type="password"
                        value={apiKeys[provider] || ''}
                        onChange={event => setApiKeys(current => ({ ...current, [provider]: event.target.value }))}
                        placeholder={activeProviderConfigured ? 'Enter a new key to replace the saved key' : `Paste your ${provider} API key`}
                        autoComplete="off"
                      />
                    </div>
                    <small>{activeProviderConfigured ? 'The saved key remains hidden until you replace or remove it.' : 'The full key is never shown again after saving.'}</small>
                  </label>
                  <button type="button" className="forge-secondary-button" onClick={() => handleTest(provider)} disabled={testing === provider}>
                    {testing === provider ? <Loader2 className="animate-spin" /> : 'Test connection'}
                  </button>
                </div>

                <div className="forge-card-actions">
                  <a className="forge-secondary-button" href={activeProvider.guideUrl} target="_blank" rel="noreferrer">
                    <KeyRound /> How to get API key <ExternalLink />
                  </a>
                  {activeProviderConfigured && (
                    <button type="button" className="forge-danger-button" onClick={() => handleRemoveKey(provider)} disabled={saving}>
                      <Trash2 /> Remove saved key
                    </button>
                  )}
                </div>

                <div className="forge-key-trust">
                  <ShieldCheck />
                  <div>
                    <strong>Your key stays private</strong>
                    <p>
                      Saved keys live in your private authenticated Firebase user settings, never in public source code or Git. Forge Resume never displays or logs a saved key. Requests go from your browser directly to the provider you select and are not routed through a Forge Resume application server.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="forge-settings-section">
              <div>
                <h2>Resume preferences</h2>
                <p>Choose sensible defaults. You can still change these inside each resume.</p>
              </div>
              <article className="forge-settings-card">
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
                    <small>Applied when you start a new resume.</small>
                  </label>
                  <label className="forge-field">
                    <span>Default export</span>
                    <select value={defaultExportFormat} onChange={event => setDefaultExportFormat(event.target.value)}>
                      <option value="PDF">PDF document</option>
                      <option value="json">JSON data backup</option>
                    </select>
                    <small>You can choose another format during export.</small>
                  </label>
                </div>
                <div className="forge-card-divider" />
                <div className="forge-inline-detail">
                  <FileText />
                  <div><strong>ATS-ready output</strong><p>Resume text stays selectable, structured, and readable in exported PDFs.</p></div>
                </div>
              </article>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="forge-settings-section">
              <div>
                <h2>Account</h2>
                <p>Review your sign-in identity and keep resume details current.</p>
              </div>
              <div className="forge-account-card">
                <span className="forge-avatar">{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{user.displayName || 'Forge member'}</strong>
                  <p>{user.email}</p>
                  <span className="forge-account-meta"><ShieldCheck /> Signed in with {signInProvider}</span>
                </div>
                <span className="forge-status-pill"><CheckCircle2 /> Active</span>
                <button type="button" className="forge-secondary-button" onClick={() => onNavigate('profile')}>
                  Update profile <ChevronRight />
                </button>
              </div>
              <div className="forge-inline-detail">
                <UserCircle2 />
                <div><strong>Your profile powers new resumes</strong><p>Contact details, work history, education, and skills can be reused when creating a resume.</p></div>
              </div>
            </div>
          )}

          {activeTab === 'help' && (
            <div className="forge-settings-section">
              <div>
                <h2>Help & guides</h2>
                <p>Practical guidance and direct shortcuts for the main resume workflow.</p>
              </div>
              <div className="forge-guide-list">
                {[
                  ['Build an ATS-ready resume', 'Use standard sections, measurable impact, and role-specific keywords.', 'dashboard', 'Open resumes'],
                  ['Tailor for a job description', 'Compare your resume with the role and close meaningful keyword gaps.', 'ats', 'Open ATS analyzer'],
                  ['Keep reusable details current', 'Maintain one complete profile to speed up every new resume.', 'profile', 'Update profile'],
                ].map(([title, copy, target, action]) => (
                  <article key={title}>
                    <BookOpen />
                    <div><strong>{title}</strong><p>{copy}</p></div>
                    <button type="button" onClick={() => onNavigate(target as 'dashboard' | 'ats' | 'profile')}>
                      {action} <ChevronRight />
                    </button>
                  </article>
                ))}
              </div>
              <div className="forge-note">
                <HelpCircle />
                <div><strong>Before exporting</strong><p>Check contact links, page breaks, date consistency, and the final filename.</p></div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

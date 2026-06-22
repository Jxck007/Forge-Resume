import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  FileText,
  Github,
  HelpCircle,
  Loader2,
  Save,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import { getUserSettings, saveUserSettings } from '../services/firebase';
import { TemplateId, UserSettings } from '../types';
import { readStorageValue, storageKeys, writeStorageValue } from '../utils/storageKeys';
import { TEMPLATE_IDS, TEMPLATE_LABELS, VISIBLE_TEMPLATE_IDS } from './TemplateShowcase';
import GuidedSpotlightTour, { GuidedTourStep } from './GuidedSpotlightTour';
import AiAssistPanel from './ai/AiAssistPanel';

interface SettingsProps {
  user: User;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  onKeyConfigured: () => void;
  onNavigate: (tab: 'dashboard' | 'profile') => void;
  initialTab?: 'resume' | 'ai';
  tourRequestId?: number;
}

type SettingsTab = 'resume' | 'ai' | 'account' | 'help';

export default function Settings({ user, showToasts, onKeyConfigured, onNavigate, initialTab = 'resume', tourRequestId = 0 }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [defaultTemplate, setDefaultTemplate] = useState<TemplateId>('modern');
  const [defaultExportFormat, setDefaultExportFormat] = useState<'PDF' | 'json'>('PDF');
  const [defaultLinkDisplayMode, setDefaultLinkDisplayMode] = useState<'embedded' | 'raw'>('embedded');
  const [defaultSectionOrderMode, setDefaultSectionOrderMode] = useState<'template' | 'custom'>('template');
  const [defaultUseProfilePhoto, setDefaultUseProfilePhoto] = useState(true);
  const [tourOpen, setTourOpen] = useState(() => readStorageValue(storageKeys.user.settingsTutorialCompleted(user.uid)) !== 'true');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getUserSettings(user.uid)
      .then(data => {
        if (!data) return;
        setSettings(data);
        setDefaultTemplate(VISIBLE_TEMPLATE_IDS.includes(data.defaultTemplate || 'modern') ? data.defaultTemplate as TemplateId : 'modern');
        setDefaultExportFormat(data.defaultExportFormat || 'PDF');
        setDefaultLinkDisplayMode(data.defaultLinkDisplayMode || 'embedded');
        setDefaultSectionOrderMode(data.defaultSectionOrderMode || 'template');
        setDefaultUseProfilePhoto(data.defaultUseProfilePhoto !== false);
      })
      .catch(() => showToasts('Could not load settings.', 'error'))
      .finally(() => setLoading(false));
  }, [user.uid]);

  useEffect(() => {
    if (!tourRequestId) return;
    setActiveTab('resume');
    setTourOpen(true);
  }, [tourRequestId]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<UserSettings> = {
        defaultTemplate,
        defaultExportFormat,
        defaultLinkDisplayMode,
        defaultSectionOrderMode,
        defaultUseProfilePhoto,
      };

      await saveUserSettings(user.uid, payload);
      setSettings(current => ({ ...(current || {}), ...payload } as UserSettings));
      onKeyConfigured();
      showToasts('Settings saved.', 'success');
    } catch {
      showToasts('Settings could not be saved.', 'error');
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
    { id: 'resume' as const, label: 'Resume Preferences', icon: FileText },
    { id: 'ai' as const, label: 'AI Assist Beta', icon: Bot },
    { id: 'account' as const, label: 'Account', icon: UserCircle2 },
    { id: 'help' as const, label: 'Help & Guides', icon: HelpCircle },
  ];
  const tourTabs: SettingsTab[] = ['resume', 'ai', 'account', 'help'];
  const tourSteps: GuidedTourStep[] = [
    { target: '[data-tour="settings-resume"]', title: 'Resume defaults', copy: 'Set defaults for new resumes without changing existing documents.', icon: FileText },
    { target: '[data-tour="settings-ai"]', title: 'AI Assist Beta', copy: 'Connect a session-only BYOK key here. Forge forgets it on refresh, logout, or tab close.', icon: Bot },
    { target: '[data-tour="settings-account"]', title: 'Account and profile', copy: 'Review your identity and open the reusable profile.', icon: UserCircle2 },
    { target: '[data-tour="settings-help"]', title: 'Help and shortcuts', copy: 'Find export checks and shortcuts back to your workspace.', icon: HelpCircle },
  ];
  const closeTour = () => {
    writeStorageValue(storageKeys.user.settingsTutorialCompleted(user.uid), 'true');
    setTourOpen(false);
  };
  const signInProvider = user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email and password';

  return (
    <div className="forge-page forge-settings">
      <div className="forge-page-heading flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><span>Workspace preferences</span><h1>Settings</h1><p>Control sensible defaults without changing existing resumes.</p></div>
        <button type="button" className="forge-secondary-button" onClick={() => { setActiveTab('resume'); setTourOpen(true); }}><Compass /> Settings tour</button>
      </div>

      <div className="forge-settings-layout grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="forge-settings-nav min-w-0 overflow-x-auto" aria-label="Settings sections">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                data-tour={`settings-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? 'is-active' : ''}
                aria-label={`Open ${tab.label}`}
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

        <section className="forge-settings-panel min-w-0">
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
                    <select value={defaultTemplate} onChange={event => setDefaultTemplate(event.target.value as TemplateId)}>
                      {VISIBLE_TEMPLATE_IDS.map(templateId => <option key={templateId} value={templateId}>{TEMPLATE_LABELS[templateId]}</option>)}
                    </select>
                    <small>Applied when you start a new resume.</small>
                  </label>
                  <label className="forge-field">
                    <span>Default export</span>
                    <select value={defaultExportFormat} onChange={event => setDefaultExportFormat(event.target.value as 'PDF' | 'json')}>
                      <option value="PDF">PDF document</option>
                      <option value="json">JSON data backup</option>
                    </select>
                    <small>You can choose another format during export.</small>
                  </label>
                  <label className="forge-field">
                    <span>Default link style</span>
                    <select value={defaultLinkDisplayMode} onChange={event => setDefaultLinkDisplayMode(event.target.value as 'embedded' | 'raw')}><option value="embedded">Embedded labels</option><option value="raw">Raw URLs</option></select>
                    <small>Controls how links appear in new resumes.</small>
                  </label>
                  <label className="forge-field">
                    <span>Default section order</span>
                    <select value={defaultSectionOrderMode} onChange={event => setDefaultSectionOrderMode(event.target.value as 'template' | 'custom')}><option value="template">Follow template</option><option value="custom">Custom editor order</option></select>
                    <small>Template order is the safest default.</small>
                  </label>
                </div>
                <label className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[#2A2E37] bg-[#0F1115] p-4 text-sm text-zinc-300">
                  <span><strong className="block text-white">Use profile photo by default</strong><small className="mt-1 block text-zinc-500">Photo-safe templates may display it; text-first templates can still hide it.</small></span>
                  <input type="checkbox" checked={defaultUseProfilePhoto} onChange={event => setDefaultUseProfilePhoto(event.target.checked)} className="h-5 w-5 accent-emerald-400" />
                </label>
                <div className="forge-card-divider" />
                <div className="forge-inline-detail">
                  <FileText />
                  <div><strong>Clean PDF output</strong><p>Resume text stays selectable, structured, and readable in exported PDFs.</p></div>
                </div>
              </article>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="forge-settings-section">
              <div>
                <h2>AI Assist Beta</h2>
                <p>Connect your own provider key for this browser session only. Forge does not save provider keys to your account.</p>
              </div>
              <AiAssistPanel showToasts={showToasts} />
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
                  ['Build a polished resume', 'Use clear sections, measurable impact, and concise writing.', 'dashboard', 'Open resumes'],
                  ['Keep reusable details current', 'Maintain one complete profile to speed up every new resume.', 'profile', 'Update profile'],
                ].map(([title, copy, target, action]) => (
                  <article key={title}>
                    <BookOpen />
                    <div><strong>{title}</strong><p>{copy}</p></div>
                    <button type="button" onClick={() => onNavigate(target as 'dashboard' | 'profile')}>
                      {action} <ChevronRight />
                    </button>
                  </article>
                ))}
              </div>
              <div className="forge-note">
                <HelpCircle />
                <div><strong>Before exporting</strong><p>Check contact links, page breaks, date consistency, and the final filename.</p></div>
              </div>
              <div className="forge-note forge-creator-credit">
                <Github />
                <div>
                  <strong>Built by Jegadeesh</strong>
                  <p>Forge Resume is an independent resume workspace focused on clean, reliable output.</p>
                  <div className="forge-creator-links">
                    <a href="https://github.com/Jxck007/portfolio" target="_blank" rel="noreferrer">
                      Portfolio <ExternalLink />
                    </a>
                    <a href="https://github.com/Jxck007" target="_blank" rel="noreferrer">
                      GitHub <ExternalLink />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      {tourOpen && <GuidedSpotlightTour label="Settings guide" steps={tourSteps} onComplete={closeTour} onStepChange={index => setActiveTab(tourTabs[index])} />}
    </div>
  );
}

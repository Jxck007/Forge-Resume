import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  CircleHelp,
  User as UserIcon,
  MessageSquareMore,
} from 'lucide-react';
import { User } from 'firebase/auth';
import BrandLogo from './BrandLogo';
import ActionMenu from './ActionMenu';

type AppTab = 'dashboard' | 'builder' | 'ats' | 'profile' | 'settings';

interface HeaderProps {
  user: User | null;
  profilePhoto?: string;
  isGuestMode?: boolean;
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  hasActiveResume: boolean;
  onLogout: () => void;
  onFeedbackSubmit: (payload: { category: string; message: string; route: string }) => Promise<'sent' | 'stored_local' | 'failed'>;
  feedbackBusy?: boolean;
  onRestartTutorial: () => void;
}

export default function Header({
  user,
  profilePhoto,
  isGuestMode = false,
  activeTab,
  onNavigate,
  hasActiveResume,
  onLogout,
  onFeedbackSubmit,
  feedbackBusy = false,
  onRestartTutorial,
}: HeaderProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('Bug');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackOutcome, setFeedbackOutcome] = useState<'sent' | 'stored_local' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const switchTab = (tab: AppTab) => {
    onNavigate(tab);
    setProfileMenuOpen(false);
  };

  const handleFeedbackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = feedbackMessage.trim();
    if (!message) return;

    setFeedbackError('');
    const submitted = await onFeedbackSubmit({
      category: feedbackCategory,
      message,
      route: typeof window === 'undefined' ? '/dashboard' : window.location.pathname || '/dashboard',
    });

    if (submitted === 'failed') {
      setFeedbackError('Feedback could not be saved. Please try again.');
      return;
    }
    setFeedbackOutcome(submitted);
  };

  const navItems: Array<{
    id: AppTab;
    label: string;
    mobileLabel?: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'builder', label: 'Builder', icon: FileText, disabled: !hasActiveResume },
    ...(!isGuestMode ? [{ id: 'profile' as const, label: 'Profile', icon: UserIcon }] : []),
  ];

  return (
    <>
      <header className="forge-header no-print">
        <div className="forge-header-inner">
          <button type="button" onClick={() => switchTab('dashboard')} className="forge-logo-button">
            <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <BrandLogo />
              <span className="inline-flex shrink-0 rounded-full border border-[#3A4C53] bg-[#101619] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#72DFCA] sm:px-2 sm:text-[9px] sm:tracking-[0.16em]">
                Beta
              </span>
            </span>
          </button>

          {(user || true) && (
            <nav className="forge-desktop-nav" aria-label="Primary navigation">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => switchTab(item.id)}
                    className={`forge-nav-item ${activeTab === item.id ? 'is-active' : ''}`}
                    aria-label={`Open ${item.label}`}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <div className="forge-header-actions">
            <div className="mr-1 sm:mr-2" data-tour="help">
              <ActionMenu
                triggerLabel="Open help menu"
                triggerClassName="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#2A3644] bg-[#111827] px-3 py-2 text-[11px] font-bold text-zinc-300 transition hover:border-[#4A5B6E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA]"
                triggerContent={
                  <>
                    <CircleHelp className="h-4 w-4" />
                    <span className="hidden md:inline">Help</span>
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                  </>
                }
                items={[
                  {
                    label: 'Open guide',
                    icon: <CircleHelp className="h-4 w-4" />,
                    onSelect: onRestartTutorial,
                  },
                  {
                    label: 'Send feedback',
                    icon: <MessageSquareMore className="h-4 w-4" />,
                    onSelect: () => {
                      setFeedbackOpen(true);
                      setFeedbackOutcome(null);
                      setFeedbackError('');
                    },
                  },
                ]}
              />
            </div>
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="forge-profile-trigger"
                  onClick={() => setProfileMenuOpen(open => !open)}
                  aria-expanded={profileMenuOpen}
                >
                  {profilePhoto || user.photoURL ? (
                    <img src={profilePhoto || user.photoURL || ''} alt="" className="forge-avatar forge-avatar-image" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="forge-avatar">{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                  )}
                  <span className="forge-profile-copy">
                    <strong>{user.displayName || user.email?.split('@')[0]}</strong>
                    <small>Career workspace</small>
                  </span>
                  <ChevronDown />
                </button>

                {profileMenuOpen && (
                  <div className="forge-profile-menu">
                    <div className="forge-profile-menu-header">
                      <strong>{user.displayName || 'Forge member'}</strong>
                      <span>{user.email}</span>
                    </div>
                    <button type="button" onClick={() => switchTab('settings')}>
                      <Settings />
                      Settings
                    </button>
                    <button type="button" onClick={onLogout} className="is-danger">
                      <LogOut />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : isGuestMode ? (
              <div className="flex items-center gap-2">
                <span className="forge-header-status">Guest mode · saved locally</span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex min-h-9 items-center rounded-lg border border-[#2A3644] bg-[#111827] px-3 py-2 text-[11px] font-bold text-zinc-300 transition hover:border-[#4A5B6E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA]"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <span className="forge-header-status">Professional resume workspace</span>
            )}
          </div>
        </div>
      </header>

      {(user || true) && (
        <nav className="forge-mobile-nav no-print" aria-label="Mobile navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => switchTab(item.id)}
                className={activeTab === item.id ? 'is-active' : ''}
                aria-label={`Open ${item.mobileLabel || item.label}`}
              >
                <Icon />
                <span>{item.mobileLabel || item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="w-full max-w-lg rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-dialog-title" className="text-lg font-black text-white">Send feedback</h2>
                <p className="mt-1 text-sm text-zinc-400">Share a bug, idea, or workflow issue without leaving Forge.</p>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="rounded-lg border border-[#2A3644] px-3 py-2 text-xs font-bold text-zinc-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA]"
                aria-label="Close feedback dialog"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleFeedbackSubmit}>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Category
                </label>
                <select
                  value={feedbackCategory}
                  onChange={event => {
                    setFeedbackCategory(event.target.value);
                    setFeedbackOutcome(null);
                  }}
                  className="w-full rounded-xl border border-[#2A3644] bg-[#0F1115] px-3 py-2.5 text-sm text-white focus:border-[#72DFCA] focus:outline-none"
                >
                  <option>Bug</option>
                  <option>Layout issue</option>
                  <option>PDF issue</option>
                  <option>UI/UX</option>
                  <option>Feature request</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Message
                </label>
                <textarea
                  value={feedbackMessage}
                  onChange={event => {
                    setFeedbackMessage(event.target.value);
                    setFeedbackOutcome(null);
                  }}
                  placeholder="Tell us what happened, what you expected, and which screen you were on."
                  rows={5}
                  required
                  maxLength={2000}
                  className="w-full rounded-2xl border border-[#2A3644] bg-[#0F1115] px-3 py-3 text-sm text-white focus:border-[#72DFCA] focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                  <span>Route and timestamp are attached automatically.</span>
                  <span>{feedbackMessage.length}/2000</span>
                </div>
                {feedbackError && <p role="alert" className="mt-2 text-xs text-rose-300">{feedbackError}</p>}
                {feedbackOutcome && (
                  <p role="status" className={`mt-2 text-xs ${feedbackOutcome === 'sent' ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {feedbackOutcome === 'sent'
                      ? 'Thanks — your feedback was saved.'
                      : 'Could not reach cloud feedback, so your note was saved locally on this device.'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-[#2A2E37] pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="submit"
                  disabled={feedbackBusy || !feedbackMessage.trim() || feedbackOutcome !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-[#72DFCA] px-4 py-2.5 text-sm font-semibold text-[#08110F] transition hover:bg-[#91E8D7] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5F5E8]"
                >
                  {feedbackBusy ? 'Sending…' : feedbackOutcome ? 'Saved' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

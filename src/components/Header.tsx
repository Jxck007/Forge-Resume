import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { User } from 'firebase/auth';
import BrandLogo from './BrandLogo';

type AppTab = 'dashboard' | 'builder' | 'ats' | 'profile' | 'settings';

interface HeaderProps {
  user: User | null;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  hasActiveResume: boolean;
  onLogout: () => void;
}

export default function Header({
  user,
  activeTab,
  setActiveTab,
  hasActiveResume,
  onLogout,
}: HeaderProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const switchTab = (tab: AppTab) => {
    setActiveTab(tab);
    setProfileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'builder' as const, label: 'Resumes', icon: FileText, disabled: !hasActiveResume },
    { id: 'ats' as const, label: 'ATS Analyzer', mobileLabel: 'ATS', icon: BarChart3 },
    { id: 'profile' as const, label: 'Profile', icon: UserIcon },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <header className="forge-header no-print">
        <div className="forge-header-inner">
          <button type="button" onClick={() => switchTab('dashboard')} className="forge-logo-button">
            <BrandLogo />
          </button>

          {user && (
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
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <div className="forge-header-actions">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="forge-profile-trigger"
                  onClick={() => setProfileMenuOpen(open => !open)}
                  aria-expanded={profileMenuOpen}
                >
                  <span className="forge-avatar">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
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
            ) : (
              <span className="forge-header-status">ATS-first resume platform</span>
            )}
          </div>
        </div>
      </header>

      {user && (
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
              >
                <Icon />
                <span>{item.mobileLabel || item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

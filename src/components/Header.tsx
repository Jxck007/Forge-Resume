import React, { useState } from 'react';
import { Sparkles, LogOut, Sun, Moon, LayoutDashboard, Sliders, BarChart, FileText, User as UserIcon, Settings as SettingsIcon, Menu, X } from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  user: User | null;
  activeTab: 'dashboard' | 'builder' | 'ats' | 'profile' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'builder' | 'ats' | 'profile' | 'settings') => void;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const switchTab = (tab: any) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="no-[print] sticky top-0 z-40 w-full border-b border-[#2A2E37] bg-[#0F1115]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo */}
        <div 
          onClick={() => switchTab('dashboard')} 
          className="flex cursor-pointer items-center space-x-2.5 transition-all hover:opacity-80"
          id="header-logo-container"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none flex items-center">
              Forge
            </h1>
          </div>
        </div>

        {/* Center: Navigation Tabs - Desktop */}
        {user && (
          <nav className="hidden md:flex items-center space-x-1" id="main-navigation-bar">
            <button
              onClick={() => switchTab('dashboard')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium tracking-wide transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#171A21] text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-[#171A21]/50'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            {hasActiveResume && (
              <button
                onClick={() => switchTab('builder')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'builder'
                    ? 'bg-[#171A21] text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-[#171A21]/50'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Builder</span>
              </button>
            )}

            <button
              onClick={() => switchTab('ats')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium tracking-wide transition-all cursor-pointer ${
                activeTab === 'ats'
                  ? 'bg-[#171A21] text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-[#171A21]/50'
              }`}
            >
              <BarChart className="h-4 w-4" />
              <span>Analyzer</span>
            </button>
            
            <button
              onClick={() => switchTab('profile')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium tracking-wide transition-all cursor-pointer flex-shrink-0 ${
                activeTab === 'profile'
                  ? 'bg-[#171A21] text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-[#171A21]/50'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              <span>Profile</span>
            </button>

             <button
              onClick={() => switchTab('settings')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium tracking-wide transition-all cursor-pointer flex-shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-[#171A21] text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-[#171A21]/50'
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>
        )}

        {/* Right: Global Controls & Avatar */}
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              <div className="hidden lg:flex items-center space-x-3 border-l border-[#2A2E37] pl-4 ml-1">
                <div className="text-right">
                  <p className="text-sm font-medium text-white max-w-[120px] truncate leading-none mb-1">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171A21] text-indigo-400 font-bold border border-[#2A2E37] shadow-sm text-sm">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg hover:bg-rose-950/30 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-[#171A21] border border-transparent hover:border-[#2A2E37] transition cursor-pointer"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-widest text-[#2A2E37]">
              FORGE
            </span>
          )}
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && user && (
        <nav className="md:hidden border-t border-[#2A2E37] bg-[#0c0d10] px-4 py-4 absolute w-full left-0 z-50 flex flex-col space-y-1.5 shadow-2xl">
          <button
            onClick={() => switchTab('dashboard')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-[#171A21] text-white border border-[#2A2E37]' : 'text-zinc-400 hover:bg-[#171A21]/50'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </button>
          
          {hasActiveResume && (
            <button
              onClick={() => switchTab('builder')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'builder' ? 'bg-[#171A21] text-white border border-[#2A2E37]' : 'text-zinc-400 hover:bg-[#171A21]/50'
              }`}
            >
              <FileText className="h-5 w-5" />
              <span>Resume Builder</span>
            </button>
          )}

          <button
            onClick={() => switchTab('ats')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'ats' ? 'bg-[#171A21] text-white border border-[#2A2E37]' : 'text-zinc-400 hover:bg-[#171A21]/50'
            }`}
          >
            <BarChart className="h-5 w-5" />
            <span>ATS Analyzer</span>
          </button>

          <button
            onClick={() => switchTab('profile')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'profile' ? 'bg-[#171A21] text-white border border-[#2A2E37]' : 'text-zinc-400 hover:bg-[#171A21]/50'
            }`}
          >
            <UserIcon className="h-5 w-5" />
            <span>My Profile</span>
          </button>

          <button
            onClick={() => switchTab('settings')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'settings' ? 'bg-[#171A21] text-white border border-[#2A2E37]' : 'text-zinc-400 hover:bg-[#171A21]/50'
            }`}
          >
            <SettingsIcon className="h-5 w-5" />
            <span>Settings</span>
          </button>

          <div className="pt-4 mt-2 border-t border-[#2A2E37]">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171A21] text-indigo-400 font-bold border border-[#2A2E37] text-sm">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                   <p className="text-sm font-medium text-white truncate max-w-[150px]">{user.displayName || user.email?.split('@')[0]}</p>
                   <p className="text-xs text-zinc-500 truncate max-w-[150px]">{user.email}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center justify-center p-2 rounded-xl text-rose-400 hover:bg-rose-950/30 transition border border-transparent hover:border-rose-900/50"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

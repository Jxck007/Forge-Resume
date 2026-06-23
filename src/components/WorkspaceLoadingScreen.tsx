import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, ArrowRight, Home, Sparkles } from 'lucide-react';
import BrandLogo from './BrandLogo';

type LoadingKind = 'auth' | 'workspace' | 'dashboard' | 'editor' | 'preview' | 'ats' | 'parser';

interface WorkspaceLoadingScreenProps {
  kind: LoadingKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  onOpenDashboard?: () => void;
}

const MICROCOPY: Record<LoadingKind, string> = {
  auth: 'Checking your session...',
  workspace: 'Loading your career workspace...',
  dashboard: 'Preparing your dashboard...',
  editor: 'Preparing your resume workspace...',
  preview: 'Manifesting your resume layout...',
  ats: 'Preparing your dashboard...',
  parser: 'Preparing the local parser...',
};

const LOADING_MESSAGES: Record<string, string[]> = {
  auth: ['Verifying credentials', 'Syncing workspace', 'Almost ready'],
  workspace: ['Organizing your data', 'Loading preferences', 'Warming up the editor'],
  editor: ['Loading resume data', 'Preparing sections', 'Setting up preview'],
  dashboard: ['Fetching your resumes', 'Loading templates', 'Preparing dashboard'],
  preview: ['Rendering layout', 'Applying template', 'Generating preview'],
};

export default function WorkspaceLoadingScreen({
  kind,
  title,
  description,
  onRetry,
  onGoHome,
  onOpenDashboard,
}: WorkspaceLoadingScreenProps) {
  const [showFallback, setShowFallback] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => setShowFallback(true), 8000);
    return () => window.clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    const messages = LOADING_MESSAGES[kind] || ['Loading...'];
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [kind]);

  const messages = LOADING_MESSAGES[kind] || ['Loading...'];

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#0B0F14] px-4 py-10">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="forge-orb forge-animate-orb-drift absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10" />
        <div className="forge-orb forge-animate-orb-drift-2 absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-indigo-500/10" />
        <div className="forge-orb forge-animate-orb-drift absolute left-1/3 top-1/3 h-48 w-48 rounded-full bg-cyan-500/8" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Animated gradient border card */}
        <div className="forge-gradient-border rounded-3xl">
          <div className="rounded-3xl border border-[#2A2E37] bg-[#171A21]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div className="flex items-center gap-3 text-zinc-200">
              <BrandLogo />
              <span className="rounded-full border border-[#3A4C53] bg-[#101619] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#72DFCA]">Beta</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title || 'Preparing your workspace...'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              {description || 'Forge is setting up your resume workspace.'}
            </p>

            {/* Animated loading card */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-[#2A2E37] bg-[#0F1115]" role="status" aria-live="polite">
              {/* Animated gradient bar */}
              <div className="forge-animate-gradient h-1 w-full" />

              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="forge-animate-pulse-glow flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-emerald-500/20 bg-[#121720]">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-300" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-200">{MICROCOPY[kind]}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-emerald-400/70" />
                      <span className="text-xs text-emerald-400/70 font-medium animate-pulse">
                        {messages[loadingStep]}
                      </span>
                      <span className="flex gap-0.5">
                        <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-400/50" style={{ animationDelay: '0ms' }} />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-400/50" style={{ animationDelay: '150ms' }} />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-400/50" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Animated loading skeleton */}
                <div className="mt-5 space-y-2.5">
                  <div className="forge-shimmer-text h-3 w-3/4 rounded" />
                  <div className="forge-shimmer-text h-3 w-1/2 rounded" />
                  <div className="forge-shimmer-text h-3 w-5/6 rounded" />
                </div>
              </div>
            </div>

            {showFallback && (
              <div className="mt-6 animate-[forge-slide-up_0.4s_ease-out] rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-100">
                  Still loading. You can retry or go back.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Retry
                    </button>
                  )}
                  {onGoHome && (
                    <button
                      type="button"
                      onClick={onGoHome}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      <Home className="h-4 w-4" />
                      Go Home
                    </button>
                  )}
                  {onOpenDashboard && (
                    <button
                      type="button"
                      onClick={onOpenDashboard}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Open Dashboard
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom decorative sparkle */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-600">
          <Sparkles className="h-3 w-3" />
          <span>Forge is working its magic</span>
          <Sparkles className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, ArrowRight, Home } from 'lucide-react';
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

export default function WorkspaceLoadingScreen({
  kind,
  title,
  description,
  onRetry,
  onGoHome,
  onOpenDashboard,
}: WorkspaceLoadingScreenProps) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => setShowFallback(true), 8000);
    return () => window.clearTimeout(fallbackTimer);
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0B0F14] px-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-2xl shadow-black/30 sm:p-8">
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

        <div className="mt-6 rounded-2xl border border-[#2A2E37] bg-[#0F1115] p-6" role="status" aria-live="polite">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-emerald-500/20 bg-[#121720]">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-200">{MICROCOPY[kind]}</p>
              <p className="mt-1 text-xs text-zinc-500">This usually takes only a moment.</p>
            </div>
          </div>
        </div>

        {showFallback && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">
              Still loading. You can retry or go back.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
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
  );
}

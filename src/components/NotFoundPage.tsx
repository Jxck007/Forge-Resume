import { ArrowRight, FileText, Compass, Sparkles } from 'lucide-react';

interface NotFoundPageProps {
  onOpenDashboard: () => void;
}

export default function NotFoundPage({ onOpenDashboard }: NotFoundPageProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F14] px-4 py-10">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="forge-orb forge-animate-orb-drift absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/8" />
        <div className="forge-orb forge-animate-orb-drift-2 absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full bg-indigo-500/8" />
        <div className="forge-orb forge-animate-orb-drift absolute left-1/4 top-1/2 h-40 w-40 rounded-full bg-amber-500/6" style={{ animationDelay: '3s' }} />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Gradient border card */}
        <div className="forge-gradient-border rounded-3xl">
          <div className="rounded-3xl border border-[#2A2E37] bg-[#171A21]/95 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
            {/* Animated icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 ring-1 ring-emerald-500/20 forge-animate-pulse-glow">
              <div className="forge-animate-float">
                <FileText className="h-9 w-9 text-emerald-300" />
              </div>
            </div>

            <div className="forge-animate-gradient mx-auto mb-3 h-1 w-24 rounded-full" />

            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Lost in the void
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              This page isn&apos;t part of your resume workspace. The link may be outdated, moved,
              or unavailable. Let&apos;s get you back to building.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={onOpenDashboard}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-3 text-sm font-semibold text-[#08110F] shadow-lg shadow-emerald-900/30 transition hover:from-emerald-300 hover:to-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
              >
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                Return to Dashboard
              </button>

              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Compass className="h-3.5 w-3.5" />
                <span>Let Forge guide you back</span>
                <Sparkles className="h-3.5 w-3.5 text-emerald-400/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

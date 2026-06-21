import { ArrowRight, FileText } from 'lucide-react';

interface NotFoundPageProps {
  onOpenDashboard: () => void;
}

export default function NotFoundPage({ onOpenDashboard }: NotFoundPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2A2E37] bg-[#0F1115] text-emerald-300">
          <FileText className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          This page is not part of your resume workspace.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          The link may be outdated, moved, or unavailable.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#08110F] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
          >
            <ArrowRight className="h-4 w-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-10 text-center">
          <div className="w-full max-w-2xl rounded-3xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
              <AlertCircle className="h-8 w-8 text-rose-300" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Something went wrong while preparing your workspace.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              Forge could not load this screen safely. You can retry or return to your dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-8 rounded-2xl border border-[#2A2E37] bg-[#0B0F14] p-4 text-left">
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Technical details
                </summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-zinc-300">
                  {this.state.error.stack || this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

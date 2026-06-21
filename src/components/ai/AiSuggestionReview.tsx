import React from 'react';
import { Copy, Sparkles, X } from 'lucide-react';
import { AiSuggestion } from '../../ai/types';

interface AiSuggestionReviewProps {
  suggestion: AiSuggestion | null;
  onApply: () => void;
  onClose: () => void;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function AiSuggestionReview({ suggestion, onApply, onClose, showToasts }: AiSuggestionReviewProps) {
  if (!suggestion) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.suggestedText);
      showToasts('AI suggestion copied.', 'success');
    } catch {
      showToasts('Copy failed. Select and copy the text manually.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="ai-suggestion-title" className="w-full max-w-3xl rounded-3xl border border-[#2A2E37] bg-[#171A21] shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4 border-b border-[#2A2E37] p-6">
          <div>
            <h2 id="ai-suggestion-title" className="flex items-center gap-2 text-lg font-black text-white">
              <Sparkles className="h-5 w-5 text-emerald-300" />
              Review AI suggestion
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {suggestion.targetLabel ? `${suggestion.targetLabel} suggestion` : 'Review before applying to your resume.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#2A2E37] px-3 py-2 text-xs font-bold text-zinc-300 transition hover:text-white" aria-label="Close AI suggestion review">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#2A2E37] bg-[#0F1115] p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Current</p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-300">{suggestion.originalText || 'No source text.'}</pre>
          </section>
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Suggested</p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-100">{suggestion.suggestedText}</pre>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#2A2E37] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">AI output is plain text and is only applied when you confirm.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-[#2A2E37] hover:text-white">
              Discard
            </button>
            <button type="button" onClick={handleCopy} className="inline-flex items-center gap-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722]">
              <Copy className="h-4 w-4" />
              Copy
            </button>
            <button type="button" onClick={onApply} className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
              Apply suggestion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

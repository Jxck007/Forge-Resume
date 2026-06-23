import React, { memo } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { AiRewriteStyle } from '../../ai/types';

interface AiRewriteControlsProps {
  loadingKey: string;
  rewriteStyle: AiRewriteStyle;
  onStyleChange: (style: AiRewriteStyle) => void;
  onTrigger: () => void;
  isBusy: boolean;
  isLoading: boolean;
  disabled?: boolean;
  label?: string;
}

const REWRITE_OPTIONS: { value: AiRewriteStyle; label: string }[] = [
  { value: 'star_format', label: 'STAR format' },
  { value: 'stronger_verbs', label: 'Stronger action verbs' },
  { value: 'shorter', label: 'Shorter' },
  { value: 'professional', label: 'More professional' },
  { value: 'grammar_fix', label: 'Grammar fix' },
  { value: 'explain_impact', label: 'Explain impact clearly' },
];

function AiRewriteControls({
  rewriteStyle,
  onStyleChange,
  onTrigger,
  isBusy,
  isLoading,
  disabled,
  label = 'Rewrite',
}: AiRewriteControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <select
        value={rewriteStyle}
        onChange={event => onStyleChange(event.target.value as AiRewriteStyle)}
        disabled={isBusy || disabled}
        aria-label={`${label} rewrite style`}
        className="min-h-7 rounded-lg border border-[#2A2E37] bg-[#0F1115] px-2 text-[10px] font-semibold text-zinc-300 outline-none"
      >
        {REWRITE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onTrigger}
        disabled={isBusy || disabled}
        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        <span>{label}</span>
      </button>
    </div>
  );
}

export default memo(AiRewriteControls);

import { CSSProperties, ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

export interface GuidedTourStep {
  target: string;
  title: string;
  copy: string;
  icon?: ComponentType<{ className?: string }>;
}

interface Props {
  label: string;
  steps: readonly GuidedTourStep[];
  onComplete: () => void;
  onStepChange?: (index: number) => void;
}

type Highlight = { top: number; left: number; width: number; height: number };

export default function GuidedSpotlightTour({ label, steps, onComplete, onStepChange }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const step = steps[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === steps.length - 1;

  const locateTarget = useCallback(() => {
    const target = document.querySelector<HTMLElement>(step.target);
    if (!target || target.offsetParent === null) return setHighlight(null);
    const rect = target.getBoundingClientRect();
    setHighlight({ top: Math.max(8, rect.top - 6), left: Math.max(8, rect.left - 6), width: rect.width + 12, height: rect.height + 12 });
  }, [step.target]);

  useEffect(() => {
    onStepChange?.(stepIndex);
    document.querySelector<HTMLElement>(step.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(locateTarget, 220);
    window.addEventListener('resize', locateTarget);
    window.addEventListener('scroll', locateTarget, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', locateTarget);
      window.removeEventListener('scroll', locateTarget, true);
    };
  }, [locateTarget, onStepChange, step.target, stepIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onComplete();
      if (event.key === 'ArrowRight' && !isLast) setStepIndex(index => index + 1);
      if (event.key === 'ArrowLeft' && stepIndex > 0) setStepIndex(index => index - 1);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLast, onComplete, stepIndex]);

  useEffect(() => {
    const appShell = document.querySelector<HTMLElement>('.app-shell');
    const previousOverflow = document.body.style.overflow;
    if (appShell) appShell.inert = true;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      if (appShell) appShell.inert = false;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const panelStyle: CSSProperties = highlight && window.innerWidth >= 640 ? {
    top: highlight.top + highlight.height + 300 < window.innerHeight ? highlight.top + highlight.height + 16 : Math.max(16, highlight.top - 286),
    left: Math.min(window.innerWidth - 420, Math.max(16, highlight.left)),
  } : {};

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[90]" aria-live="polite" onPointerDown={event => event.stopPropagation()}>
      {highlight
        ? <div className="fixed rounded-xl border-2 border-emerald-300 transition-all duration-200" style={{ ...highlight, boxShadow: '0 0 0 9999px rgba(0,0,0,.68)' }} aria-hidden="true" />
        : <div className="fixed inset-0 bg-black/65" aria-hidden="true" />}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="guided-tour-title" tabIndex={-1} style={panelStyle} className="pointer-events-auto fixed bottom-3 left-3 right-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-[#344354] bg-[#11151B] p-4 shadow-2xl outline-none sm:bottom-auto sm:right-auto sm:w-[400px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Icon className="h-5 w-5" /></span>}
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">{label} · {stepIndex + 1} of {steps.length}</p><h2 id="guided-tour-title" className="mt-1 text-lg font-bold text-white">{step.title}</h2></div>
          </div>
          <button type="button" onClick={onComplete} className="forge-ghost-button">Skip</button>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-300">{step.copy}</p>
        <p className="mt-2 text-[11px] text-zinc-500">Use the guide controls below to continue. Background actions are paused.</p>
        <div className="mt-4 flex gap-1.5" aria-label="Tutorial progress">{steps.map((item, index) => <span key={item.title} className={`h-1 flex-1 rounded-full ${index <= stepIndex ? 'bg-emerald-400' : 'bg-zinc-700'}`} />)}</div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setStepIndex(index => Math.max(0, index - 1))} disabled={stepIndex === 0} className="forge-secondary-button"><ChevronLeft /> Back</button>
          <button type="button" onClick={() => isLast ? onComplete() : setStepIndex(index => index + 1)} className="forge-primary-button">{isLast ? <><Check /> Finish</> : <>Next <ChevronRight /></>}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

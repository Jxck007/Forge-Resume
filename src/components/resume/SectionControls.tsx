import React, { memo } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, ChevronDown } from 'lucide-react';

interface SectionControlsProps {
  sectionId: string;
  idx: number;
  isHidden: boolean;
  isOpen: boolean;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onToggleVisibility: (sectionId: string) => void;
  onToggleOpen: (sectionId: string) => void;
}

const btnCls = 'rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer';

function SectionControls({
  sectionId,
  idx,
  isHidden,
  isOpen,
  onMove,
  onToggleVisibility,
  onToggleOpen,
}: SectionControlsProps) {
  return (
    <div className="flex items-center gap-1.5 self-start sm:self-auto">
      <button type="button" onClick={() => onMove(idx, 'up')} aria-label={`Move ${sectionId} section up`} className={btnCls}>
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onMove(idx, 'down')} aria-label={`Move ${sectionId} section down`} className={btnCls}>
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onToggleVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className={btnCls}>
        {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button type="button" onClick={() => onToggleOpen(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className={btnCls}>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
      </button>
    </div>
  );
}

export default memo(SectionControls);

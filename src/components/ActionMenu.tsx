import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  triggerLabel: string;
  triggerContent?: ReactNode;
  triggerClassName?: string;
}

export default function ActionMenu({
  items,
  align = 'right',
  triggerLabel,
  triggerContent,
  triggerClassName,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const floatingMenuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 200;
    const estimatedHeight = Math.min(320, items.length * 44 + 16);
    const roomBelow = window.innerHeight - rect.bottom;
    const top = roomBelow >= estimatedHeight + 16
      ? rect.bottom + 8
      : Math.max(8, rect.top - estimatedHeight - 8);
    const preferredLeft = align === 'left' ? rect.left : rect.right - menuWidth;
    setPosition({
      top,
      left: Math.min(Math.max(8, preferredLeft), window.innerWidth - menuWidth - 8),
    });
  }, [align, items.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !floatingMenuRef.current?.contains(target)) setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen(current => !current)}
        className={triggerClassName || 'inline-flex items-center justify-center rounded-lg border border-[#2A3644] bg-[#111827] p-2 text-zinc-300 transition hover:border-[#4A5B6E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA]'}
      >
        {triggerContent || <MoreHorizontal className="h-4 w-4" />}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={floatingMenuRef}
          role="menu"
          style={{ top: position.top, left: position.left }}
          className="fixed z-[100] w-[200px] max-w-[calc(100vw-16px)] rounded-2xl border border-[#2A2E37] bg-[#171A21] p-2 shadow-2xl shadow-black/40"
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA] disabled:cursor-not-allowed disabled:opacity-50 ${
                item.tone === 'danger'
                  ? 'text-rose-300 hover:bg-rose-950/40 hover:text-rose-200'
                  : 'text-zinc-200 hover:bg-[#0F1115] hover:text-white'
              }`}
            >
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

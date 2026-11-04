import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface SearchScopeTab {
  id: string;
  label: string;
}

interface SearchScopeTabsProps {
  tabs: SearchScopeTab[];
  value: string;
  onValueChange: (id: string) => void;
  controlsId?: string;
}

function revealTab(element: HTMLButtonElement | undefined) {
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
}

export function SearchScopeTabs({ tabs, value, onValueChange, controlsId }: SearchScopeTabsProps) {
  const generatedId = useId();
  const validControlsId = controlsId && !/\s/.test(controlsId) ? controlsId : undefined;
  const tabIdPrefix = validControlsId ?? `search-categories-${generatedId}`;
  const selectedId = tabs.find(tab => tab.id === value)?.id ?? tabs[0]?.id;
  const [focusedId, setFocusedId] = useState(selectedId);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const rovingId = tabs.some(tab => tab.id === focusedId) ? focusedId : selectedId;

  useEffect(() => {
    setFocusedId(selectedId);
    revealTab(buttons.current.get(selectedId));
  }, [selectedId]);

  const activate = (id: string) => {
    setFocusedId(id);
    if (id !== value) onValueChange(id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const index = tabs.findIndex(tab => tab.id === id);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    event.stopPropagation();
    if (nextIndex !== undefined) {
      const nextId = tabs[nextIndex].id;
      setFocusedId(nextId);
      buttons.current.get(nextId)?.focus({ preventScroll: true });
    } else activate(id);
  };

  if (!tabs.length) return null;
  return <div className="min-w-0 max-w-full shrink-0 border-t bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
    <div role="tablist" aria-label="Search categories" aria-orientation="horizontal" className="flex min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-lg p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map(tab => <button key={tab.id} ref={element => { if (element) buttons.current.set(tab.id, element); else buttons.current.delete(tab.id); }}
        type="button" role="tab" id={`${tabIdPrefix}-tab-${encodeURIComponent(tab.id)}`} aria-controls={validControlsId} aria-selected={tab.id === value}
        tabIndex={tab.id === rovingId ? 0 : -1} onClick={() => activate(tab.id)} onKeyDown={event => onKeyDown(event, tab.id)}
        onPointerDown={event => {
          // Keep the search keyboard open when switching categories by touch or mouse.
          const active = document.activeElement;
          if (active instanceof HTMLElement && (active.matches('input, textarea') || active.isContentEditable)) event.preventDefault();
        }}
        onFocus={() => { setFocusedId(tab.id); revealTab(buttons.current.get(tab.id)); }}
        className={cn('min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 motion-reduce:transition-none',
          tab.id === value ? 'bg-accent font-medium text-accent-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
        {tab.label}
      </button>)}
    </div>
  </div>;
}

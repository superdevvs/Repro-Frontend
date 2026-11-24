import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CrmRobbieContext, type RobbieWhere } from './useCrmRobbie';


const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export function CrmRobbieProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [where, setWhere] = useState<RobbieWhere>({ page: 'home' });
  const [pending, setPending] = useState<string | null>(null);

  const ask = useCallback((prompt: string) => {
    setPending(prompt);
    setOpen(true);
  }, []);
  const clearPending = useCallback(() => setPending(null), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // "R" opens and closes the panel, as in the designs; Escape closes it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === 'r' || event.key === 'R') { event.preventDefault(); setOpen((o) => !o); }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ open, setOpen, toggle, where, setWhere, pending, ask, clearPending }), [open, toggle, where, pending, ask, clearPending]);
  return <CrmRobbieContext.Provider value={value}>{children}</CrmRobbieContext.Provider>;
}


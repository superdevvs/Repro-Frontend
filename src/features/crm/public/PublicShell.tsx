import React from 'react';

/** Plain branded page for people outside the Dashboard: careers, quotes, unsubscribe. */
export function PublicShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="crm-root min-h-dvh bg-secondary text-foreground">
      <header className="border-b bg-card">
        <div className={`mx-auto flex h-14 items-center gap-2.5 px-5 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
          <img src="/REPRO-HQ-icon.png" alt="" className="h-7 w-7" />
          <a href="https://reprophotos.com" className="text-[15px] font-semibold tracking-tight">R/E Pro Photos</a>
        </div>
      </header>
      <main className={`mx-auto px-5 py-8 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>{children}</main>
      <footer className="pb-10 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} R/E Pro Photos · <a href="/privacy-policy" className="hover:text-foreground">Privacy</a></footer>
    </div>
  );
}

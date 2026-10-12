import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useDashboardInstall } from '@/hooks/useDashboardInstall';
import { DashboardInstallButton } from './DashboardInstallButton';

const DISMISSED_KEY = 'repro.home-screen-prompt.dismissed-at';
function recentlyDismissed() {
  try { return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) || 0) < 24 * 60 * 60 * 1000; }
  catch { return false; }
}

export function DashboardInstallBanner() {
  const install = useDashboardInstall();
  const [dismissed, setDismissed] = useState(recentlyDismissed);
  if (install.installed || !install.mobile || dismissed) return null;
  return <aside aria-label="Add dashboard to Home Screen" className="grid shrink-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b bg-card px-4 py-2">
    <div className="flex min-w-0 items-center gap-2"><Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" /><p className="text-sm font-medium">Open REPro like an app</p></div>
    <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Dismiss Home Screen suggestion" onClick={() => {
      setDismissed(true);
      try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* The suggestion can still be dismissed for this visit. */ }
    }}><X className="h-4 w-4" /></button>
    <div className="col-span-2"><DashboardInstallButton /></div>
  </aside>;
}

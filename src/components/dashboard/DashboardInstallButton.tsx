import { useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDashboardInstall } from '@/hooks/useDashboardInstall';

export function DashboardInstallButton({ forCalls = false }: { forCalls?: boolean }) {
  const install = useDashboardInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (install.installed) return null;

  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (install.ios || await install.prompt() === 'unavailable') setOpen(true);
    } finally { setBusy(false); }
  };

  return <>
    <Button variant="outline" className="h-10 shrink-0 gap-2" disabled={busy} onClick={() => void add()}>
      <Download className="h-4 w-4" />Add to Home Screen
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-5"><Smartphone className="h-5 w-5" />Add REPro to Home Screen</DialogTitle>
          <DialogDescription>{install.ios ? 'Add the dashboard from Safari, then open it from its new icon.' : 'Install the dashboard from your browser’s menu.'}</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          {install.ios ? <>
            <li>Open <strong>reprodashboard.com</strong> in <strong>Safari</strong>.</li>
            <li>Tap <strong>Share</strong> <Share className="inline h-4 w-4" aria-hidden="true" /> in the browser toolbar or menu.</li>
            <li>Choose <strong>Add to Home Screen</strong>. If it is missing, choose <strong>Edit Actions</strong> to add it.</li>
            <li>Keep <strong>Open as Web App</strong> enabled if shown, then tap <strong>Add</strong>.</li>
          </> : <>
            <li>Open the browser’s menu.</li>
            <li>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>, then confirm.</li>
            <li>If this browser has no install option, open the dashboard in Chrome or Edge.</li>
          </>}
          <li>Open <strong>REPro</strong> from your Home Screen and sign in if asked.</li>
          {forCalls && <li>Go to <strong>Calls → Audio &amp; alerts</strong>, choose <strong>Enable this device</strong>, and allow notifications.</li>}
        </ol>
        {forCalls && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Incoming calls show a notification. Tap it to open the dashboard, then choose Answer. On iPhone, alerts require iOS 16.4 or later.</p>}
        <Button className="h-10" onClick={() => setOpen(false)}>Got it</Button>
      </DialogContent>
    </Dialog>
  </>;
}

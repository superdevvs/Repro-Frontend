import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Check, Truck } from 'lucide-react';
import { useAuth } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
import { updateShootAutoDelivery } from '@/services/shootAutoDelivery';
import type { ShootAutoDelivery, ShootData } from '@/types/shoots';

interface ShootAutoDeliverySettingsProps {
  shoot: Pick<ShootData, 'id' | 'autoDelivery' | 'auto_delivery'>;
  onUpdate?: (updated: { autoDelivery: ShootAutoDelivery; auto_delivery: ShootAutoDelivery }) => void;
}

export function ShootAutoDeliverySettings({ shoot, onUpdate }: ShootAutoDeliverySettingsProps) {
  const { user, role: authRole } = useAuth();
  const role = String(authRole || user?.role || '').toLowerCase();
  const staff = ['admin', 'superadmin', 'super_admin', 'editing_manager'].includes(role);
  const supplied = shoot.autoDelivery ?? shoot.auto_delivery;
  const [policy, setPolicy] = useState(supplied);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [retryValue, setRetryValue] = useState<boolean | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const scope = `${shoot.id}:${user?.id ?? ''}:${role}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const refresh = useShootMutationRefresh();
  const labelId = useId();
  const helpId = useId();

  useEffect(() => { setPolicy(supplied); }, [supplied, scope]);
  useEffect(() => {
    mounted.current = true;
    setPending(false); setError(''); setSaved(false); setRetryValue(null);
    return () => { mounted.current = false; request.current?.abort(); request.current = null; };
  }, [scope]);

  const save = async (enabled: boolean) => {
    if (!staff || !policy?.available || !policy.can_manage || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const requestScope = scope;
    const stillCurrent = () => mounted.current && currentScope.current === requestScope;
    setPending(true); setError(''); setSaved(false); setRetryValue(enabled);
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const updated = await updateShootAutoDelivery(shoot.id, enabled, controller.signal);
      if (!stillCurrent()) return;
      setPolicy(updated); setSaved(true); setRetryValue(null);
      onUpdate?.({ autoDelivery: updated, auto_delivery: updated });
      refresh(shoot.id);
    } catch (cause) {
      if (stillCurrent()) setError(controller.signal.aborted
        ? 'The update could not be confirmed. Your last confirmed setting is shown.'
        : cause instanceof Error ? cause.message : 'The update could not be confirmed. Please try again.');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
      if (stillCurrent()) setPending(false);
    }
  };

  if (!staff || !policy?.available || !policy.can_manage) return null;

  return <section className="rounded-lg border bg-card p-3.5" aria-labelledby={labelId} aria-busy={pending}>
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1">
      <span className="row-span-2 mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Truck className="h-4 w-4" aria-hidden="true" /></span>
      <label id={labelId} htmlFor={`${labelId}-switch`} className="min-w-0 text-sm font-medium leading-6">Auto delivery</label>
      <Switch id={`${labelId}-switch`} checked={policy.enabled} onCheckedChange={value => void save(value)} disabled={pending} aria-labelledby={labelId} aria-describedby={helpId} className="mt-0.5 shrink-0" />
      <p id={helpId} className="col-span-2 col-start-2 max-w-xl text-xs leading-relaxed text-muted-foreground">Automatically deliver verified iGuide and CubiCasa provider work when all required work is complete. Normal delivery notifications apply. Photo and video work still needs approval.</p>
    </div>
    <div aria-live="polite" className="ml-[42px] mt-2 text-xs">
      {pending && <p role="status" className="flex items-center gap-1.5 text-muted-foreground"><InlineSpinner aria-hidden="true" className="h-3.5 w-3.5" />Saving…</p>}
      {!pending && saved && !error && <p role="status" className="flex items-center gap-1.5 text-muted-foreground"><Check className="h-3.5 w-3.5" />Auto delivery is {policy.enabled ? 'on' : 'off'}.</p>}
      {!pending && error && <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-destructive"><p className="flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { if (retryValue !== null) void save(retryValue); }}>Try again</Button></div>}
    </div>
  </section>;
}

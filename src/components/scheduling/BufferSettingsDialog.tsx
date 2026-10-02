import { useEffect, useState } from 'react';
import { Clock3, MapPin, Route, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { bufferValidation, requestBufferSettings, type BufferMode, type BufferPolicy, type BufferSettingsResponse } from './bufferSettings';

const modes = [
  { value: 'google' as const, icon: Route, title: 'Google travel', text: 'Traffic-aware driving time + arrival allowance.' },
  { value: 'mileage' as const, icon: MapPin, title: 'Mileage estimate', text: 'Distance bands, without Google Routes calls.' },
  { value: 'fixed' as const, icon: Clock3, title: 'Fixed gap', text: 'One gap between bookings at different buildings.' },
];

function MinuteField({ label, value, onChange, min = 15, max = 120 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number;
}) {
  const id = `buffer-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input id={id} type="number" min={min} max={max} step={5} value={Number.isNaN(value) ? '' : value}
        onChange={event => onChange(event.target.value === '' ? NaN : Number(event.target.value))} className="pr-14" />
      <span className="pointer-events-none absolute right-8 top-2.5 text-sm text-muted-foreground">min</span>
    </div>
  </div>;
}

export function BufferSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = useState<BufferSettingsResponse | null>(null);
  const [draft, setDraft] = useState<BufferPolicy | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { toast } = useToast();
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null); setDraft(null);
    requestBufferSettings(controller.signal).then(result => {
      if (!controller.signal.aborted) { setData(result); setDraft(result.settings); }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load buffer settings.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, attempt]);
  const change = <K extends keyof BufferPolicy>(key: K, value: BufferPolicy[K]) => {
    setDraft(current => current ? { ...current, [key]: value } : current); setError('');
  };
  const invalid = draft ? bufferValidation(draft) : null;
  const changed = draft && data && JSON.stringify(draft) !== JSON.stringify(data.settings);
  const save = async () => {
    if (!draft || !data || invalid || saving) return;
    setSaving(true); setError('');
    try {
      await requestBufferSettings(undefined, { ...draft, version: data.version });
      toast({ title: 'Buffer settings saved', description: 'New scheduling checks will use this policy.' });
      onOpenChange(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save buffer settings.'); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto p-0 sm:rounded-2xl"
      onInteractOutside={event => { if (saving) event.preventDefault(); }} onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}>
      <DialogHeader className="border-b p-5 pr-12 text-left sm:px-7">
        <DialogTitle className="flex items-center gap-2 text-xl"><Route className="h-5 w-5 text-primary" />Buffer time</DialogTitle>
        <DialogDescription>Choose how much travel time to leave between shoots. Capture durations stay separate.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 px-5 sm:px-7">
        {loading && <p role="status" className="py-12 text-center text-muted-foreground">Loading buffer settings…</p>}
        {draft && data && <>
          <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Buffer calculation mode">
            {modes.map(({ value, icon: Icon, title, text }) => <button type="button" key={value} aria-pressed={draft.mode === value} disabled={saving}
              onClick={() => change('mode', value as BufferMode)} className={cn('rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                draft.mode === value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60')}>
              <Icon className={cn('mb-2 h-5 w-5', draft.mode === value ? 'text-primary' : 'text-muted-foreground')} />
              <span className="block font-semibold">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{text}</span>
            </button>)}
          </div>
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <fieldset disabled={saving} className="min-w-0 space-y-4">
              <legend className="mb-3 text-sm font-semibold">{draft.mode === 'fixed' ? 'Fixed travel gap' : draft.mode === 'google' ? 'Driving time settings' : 'Distance bands'}</legend>
              {draft.mode === 'fixed' && <MinuteField label="Gap between shoots" value={draft.fixed_minutes} onChange={value => change('fixed_minutes', value)} />}
              {draft.mode === 'google' && <>
                <div className="grid grid-cols-2 gap-3">
                  <MinuteField label="Minimum gap" value={draft.minimum_minutes} onChange={value => change('minimum_minutes', value)} />
                  <MinuteField label="Arrival allowance" min={0} max={30} value={draft.allowance_minutes} onChange={value => change('allowance_minutes', value)} />
                </div>
                <p className="text-xs text-muted-foreground">Drive time + allowance, rounded up to 5 minutes, with your minimum gap applied.</p>
                <div className="space-y-2"><Label htmlFor="buffer-fallback">If Google is unavailable or the budget is reached</Label>
                  <Select value={draft.fallback} onValueChange={value => change('fallback', value as BufferPolicy['fallback'])} disabled={saving}>
                    <SelectTrigger id="buffer-fallback"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="mileage">Use mileage estimates</SelectItem><SelectItem value="review">Require staff review</SelectItem></SelectContent>
                  </Select>
                </div>
              </>}
              {(draft.mode === 'mileage' || (draft.mode === 'google' && draft.fallback === 'mileage')) && <>
                <div className="grid grid-cols-3 gap-3">
                  <MinuteField label="Up to 5 mi" value={draft.near_minutes} onChange={value => change('near_minutes', value)} />
                  <MinuteField label="5–15 mi" value={draft.medium_minutes} onChange={value => change('medium_minutes', value)} />
                  <MinuteField label="15–30 mi" value={draft.far_minutes} onChange={value => change('far_minutes', value)} />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">Approximate mileage = straight-line distance × 1.3. Over 30 miles or an unverified location requires staff review.</p>
              </>}
              <p className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />Verified same-building visits need no travel gap. Capture work can never overlap.</p>
            </fieldset>
            <aside className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
              <h3 className="font-semibold">Google Routes</h3>
              <p className={data.google.key_configured ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'}>{data.google.key_configured ? 'Server key configured. Route availability is checked when scheduling.' : 'Setup needed: a server-restricted Google Routes key must be configured before driving estimates are available.'}</p>
              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Routes allowance</span><strong>${data.google.budget.budget_usd} / 31 days</strong></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, data.google.budget.usage_percent)}%` }} /></div>
                <p className="text-xs text-muted-foreground">{data.google.budget.used_elements.toLocaleString()} of {data.google.budget.limit_elements.toLocaleString()} route elements used. Approx. ${data.google.budget.estimated_cost_usd.toFixed(2)}.</p>
                {data.google.budget.usage_percent >= 75 && <p role="status" className="text-xs text-amber-600 dark:text-amber-400">{data.google.budget.exhausted ? 'Allowance reached. The selected fallback applies.' : `${Math.round(data.google.budget.usage_percent)}% of the Routes allowance used.`}</p>}
              </div>
              <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">A confirmed “no route” response requires staff review. Saving applies to new scheduling checks; existing appointments keep their times.</p>
            </aside>
          </div>
        </>}
        {(error || invalid) && <p role="alert" className="text-sm text-destructive">{error || invalid}</p>}
        {!loading && !draft && <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}
      </div>
      <DialogFooter className="border-t gap-2 bg-muted/20 px-5 py-4 sm:gap-0 sm:px-7">
        <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={loading || saving || !draft || !!invalid || !changed} onClick={() => void save()}>{saving ? 'Saving…' : 'Save buffer settings'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

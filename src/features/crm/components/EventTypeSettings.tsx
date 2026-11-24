import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi } from '../api';
import { useCrmMutation } from '../hooks';
import { Field, TextInput, Select } from '../ui/fields';
import { ErrorNote, Loading } from '../ui/primitives';
import { useEventTypes } from './eventTypes';

export function EventTypeSettings({ onClose }: { onClose: () => void }) {
  const types = useEventTypes();
  const [chosen, setChosen] = useState('');
  const [label, setLabel] = useState('');
  const [active, setActive] = useState(true);
  const [counts, setCounts] = useState(true);
  const selected = types.data?.data.find((t) => String(t.id) === chosen);
  const choose = (id: string) => {
    const type = types.data?.data.find((t) => String(t.id) === id);
    setChosen(id); setLabel(type?.label ?? ''); setActive(type?.is_active ?? true); setCounts(type?.counts_as_contact ?? true);
  };
  const save = useCrmMutation(() => chosen
    ? crmApi.patch(`/event-types/${chosen}`, { label: label.trim(), is_active: active, counts_as_contact: counts })
    : crmApi.post('/event-types', { label: label.trim(), counts_as_contact: counts }), { success: 'Follow-up type saved' });
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="crm-root">
    <DialogHeader><DialogTitle>Follow-up types</DialogTitle></DialogHeader>
    {types.isLoading ? <Loading /> : types.error ? <ErrorNote error={types.error} onRetry={() => types.refetch()} /> : <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (label.trim()) save.mutate(undefined, { onSuccess: onClose }); }}>
      <Field label="Follow-up type">{(id) => <Select id={id} value={chosen} onChange={(e) => choose(e.target.value)} placeholder="Create a new type" options={(types.data?.data ?? []).map((t) => ({ value: String(t.id), label: t.label + (t.is_active ? '' : ' (retired)') }))} />}</Field>
      <Field label="Name">{(id) => <TextInput id={id} required maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
      <label className="flex items-center gap-2"><input type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} />Counts as a contact when completed</label>
      {selected && !selected.is_system && <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Available to schedule</label>}
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!label.trim() || save.isPending}>Save type</Button></DialogFooter>
    </form>}
  </DialogContent></Dialog>;
}

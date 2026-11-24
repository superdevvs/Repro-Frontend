import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi } from '../api';
import { useCrmMeta, useCrmMutation } from '../hooks';
import type { ApiError, Contact, DuplicatePayload } from '../types';
import { Field, Select, TextInput } from '../ui/fields';
import { US_STATES } from '../ui/usStates';
import { Note } from '../ui/primitives';

type Form = Record<'name' | 'company' | 'title' | 'email' | 'phone' | 'address' | 'website' | 'market_city' | 'market_state' | 'segment' | 'client_type' | 'lead_source' | 'assigned_rep_id', string>;

const EMPTY: Form = { name: '', company: '', title: '', email: '', phone: '', address: '', website: '', market_city: '', market_state: '', segment: '', client_type: '', lead_source: '', assigned_rep_id: '' };

const fromContact = (c: Contact): Form => ({
  name: c.name, company: c.company ?? '', title: c.title ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', website: c.website ?? '',
  market_city: c.market_city ?? '', market_state: c.market_state ?? '', segment: c.segment, client_type: c.client_type ?? '', lead_source: c.lead_source ?? '',
  assigned_rep_id: c.assigned_rep ? String(c.assigned_rep.id) : '',
});

/**
 * Add or edit a contact (frame 03). The server is the duplicate guard: a rep
 * who hits a duplicate learns only that the contact exists and that an admin
 * was told; an admin sees the match and can confirm a same-name person.
 */
export function ContactFormDialog({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (open: boolean) => void; contact?: Contact }) {
  const { data: meta } = useCrmMeta();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [dup, setDup] = useState<{ message: string; duplicate: DuplicatePayload } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = Boolean(contact);

  useEffect(() => {
    if (open) {
      setForm(contact ? fromContact(contact) : { ...EMPTY, assigned_rep_id: meta && !meta.can.assign ? String(meta.me.id) : '' });
      setDup(null);
      setErrors({});
    }
  }, [open, contact, meta]);

  const save = useCrmMutation(
    (confirmDifferent: boolean) => {
      const body: Record<string, unknown> = {};
      (Object.keys(form) as (keyof Form)[]).forEach((k) => { if (k !== 'assigned_rep_id') body[k] = form[k] === '' ? null : form[k]; });
      if (!editing && meta?.can.assign) body.assigned_rep_id = form.assigned_rep_id ? Number(form.assigned_rep_id) : null;
      body.confirm_different_person = confirmDifferent;
      return editing
        ? crmApi.patch<{ contact: Contact }>(`/contacts/${contact!.id}`, body)
        : crmApi.post<{ contact: Contact }>('/contacts', body);
    },
    { success: editing ? 'Contact saved' : 'Contact added', silentErrors: true },
  );

  const submit = (confirmDifferent = false) => {
    const missing: Record<string, string> = {};
    if (!form.name.trim()) missing.name = 'Enter a name.';
    if (!form.segment) missing.segment = 'Choose Residential or Commercial.';
    setErrors(missing);
    if (Object.keys(missing).length) return;
    save.mutate(confirmDifferent, {
      onSuccess: (r) => { onOpenChange(false); if (!editing) navigate(`/crm/contacts/${r.contact.id}`); },
      onError: (e: ApiError) => {
        if (e.status === 409 && e.duplicate) { setDup({ message: e.message, duplicate: e.duplicate }); return; }
        setErrors(Object.fromEntries(Object.entries(e.errors ?? {}).map(([k, v]) => [k, v[0]])));
        if (!e.errors) setErrors({ _form: e.message });
      },
    });
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setForm({ ...form, [k]: e.target.value }); if (dup) setDup(null); };
  const blocked = dup && !dup.duplicate.overridable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${contact!.name}` : 'Add contact'}</DialogTitle>
          <DialogDescription>{editing ? 'Changes are checked against every contact for duplicates.' : 'New contacts start in Outreach. Email, phone and name are checked against every contact in the CRM.'}</DialogDescription>
        </DialogHeader>

        {dup && (
          <Note tone={blocked ? 'bad' : 'warn'} icon={blocked ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}>
            <p className="font-medium">{dup.message}</p>
            {dup.duplicate.match && (
              <p className="mt-1">
                Matches <Link to={`/crm/contacts/${dup.duplicate.match.id}`} className="font-medium underline underline-offset-2" onClick={() => onOpenChange(false)}>{dup.duplicate.match.name}</Link>
                {dup.duplicate.match.company ? ` · ${dup.duplicate.match.company}` : ''} · {dup.duplicate.match.stage_label}
                {dup.duplicate.match.assigned_rep ? ` · ${dup.duplicate.match.assigned_rep.name}` : ' · Unassigned'}
              </p>
            )}
          </Note>
        )}
        {errors._form && <Note tone="bad">{errors._form}</Note>}
        {Object.keys(errors).some((key) => ['title', 'market_city', 'market_state', 'address', 'website'].includes(key)) && <Note tone="bad">Check the highlighted fields in Additional details.</Note>}

        <form id="crm-contact-form" onSubmit={(e) => { e.preventDefault(); submit(false); }} className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name} className="sm:col-span-2">{(id, d) => <TextInput id={id} aria-describedby={d} aria-invalid={Boolean(errors.name) || dup?.duplicate.reason === 'name'} value={form.name} onChange={set('name')} autoFocus autoComplete="off" />}</Field>
          <Field label="Company">{(id) => <TextInput id={id} value={form.company} onChange={set('company')} />}</Field>
          <Field label="Email" error={errors.email}>{(id, d) => <TextInput id={id} type="email" aria-describedby={d} aria-invalid={dup?.duplicate.reason === 'email'} value={form.email} onChange={set('email')} />}</Field>
          <Field label="Phone" error={errors.phone}>{(id, d) => <TextInput id={id} type="tel" aria-describedby={d} aria-invalid={dup?.duplicate.reason === 'phone'} value={form.phone} onChange={set('phone')} />}</Field>
          <Field label="Segment" required error={errors.segment}>{(id, d) => <Select id={id} aria-describedby={d} value={form.segment} onChange={set('segment')} placeholder="Choose…" options={(meta?.segments ?? []).map((s) => ({ value: s.key, label: s.label }))} />}</Field>
          <Field label="Lead source">{(id) => <Select id={id} value={form.lead_source} onChange={set('lead_source')} placeholder="Choose…" options={(meta?.lead_sources ?? []).map((s) => ({ value: s.key, label: s.label }))} />}</Field>
          {editing && <Field label="Client type">{(id) => <Select id={id} value={form.client_type} onChange={set('client_type')} placeholder="—" options={(meta?.client_types ?? []).map((s) => ({ value: s.key, label: s.label }))} />}</Field>}
          {!editing && (
            <Field label="Rep" hint={meta?.can.assign ? 'Leave empty to send it to the Unassigned queue.' : 'New contacts you add are yours.'}>
              {(id, d) => meta?.can.assign
                ? <Select id={id} aria-describedby={d} value={form.assigned_rep_id} onChange={set('assigned_rep_id')} placeholder="Unassigned" options={(meta?.reps ?? []).map((r) => ({ value: String(r.id), label: r.name }))} />
                : <TextInput id={id} aria-describedby={d} value={meta?.me.name ?? ''} disabled />}
            </Field>
          )}
          <details className="rounded-xl border px-3 py-2.5 sm:col-span-2" open={editing || undefined}>
            <summary className="cursor-pointer font-medium">Additional details</summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Title" error={errors.title}>{(id) => <TextInput id={id} value={form.title} onChange={set('title')} placeholder="Managing broker" />}</Field>
          <Field label="City" error={errors.market_city}>{(id) => <TextInput id={id} value={form.market_city} onChange={set('market_city')} placeholder="Bethesda" />}</Field>
          <Field label="State" error={errors.market_state}>{(id) => <Select id={id} value={form.market_state} onChange={set('market_state')} placeholder="—" options={US_STATES.map((s) => ({ value: s, label: s }))} />}</Field>
          <Field label="Address" error={errors.address} className="sm:col-span-2">{(id) => <TextInput id={id} value={form.address} onChange={set('address')} />}</Field>
          <Field label="Website" error={errors.website}>{(id) => <TextInput id={id} value={form.website} onChange={set('website')} placeholder="example.com" />}</Field>
            </div>
          </details>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {dup?.duplicate.overridable && <Button variant="outline" onClick={() => submit(true)} disabled={save.isPending}>It’s a different person</Button>}
          <Button type="submit" form="crm-contact-form" disabled={save.isPending || Boolean(blocked)}>{save.isPending ? 'Saving…' : editing ? 'Save' : 'Add contact'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

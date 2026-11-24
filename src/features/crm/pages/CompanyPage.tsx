import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Globe, Pencil, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi } from '../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../hooks';
import { ago, day } from '../format';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import type { Contact } from '../types';
import { Field, Select, TextArea, TextInput } from '../ui/fields';
import { US_STATES } from '../ui/usStates';
import { Avatar, Card, Chip, CrmPage, ErrorNote, KeyValues, Loading, StageChip, StatStrip } from '../ui/primitives';

interface Company {
  company: { id: number; name: string; website: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; segment: string | null; notes: string | null; can_edit: boolean };
  stats: { contacts: number; clients: number; pipeline: number; shoots: number; last_shoot: string | null };
  contacts: (Contact & { shoots: { total: number; last_shoot: string | null } | null })[];
}

/** Company page (frame F4). */
export default function CompanyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: meta } = useCrmMeta();
  const q = useCrmQuery<Company>(['crm', 'company', id], `/companies/${id}`);
  useRobbieWhere({ page: 'company', label: q.data?.company.name });
  const [editing, setEditing] = useState(false);

  if (q.isLoading) return <CrmPage title="Company"><Loading /></CrmPage>;
  if (q.error || !q.data) return <CrmPage title="Company" crumbs={[{ label: 'Companies', to: '/crm/companies' }]}><ErrorNote error={q.error?.status === 404 ? { message: 'You have no contacts at this company.' } : q.error} /></CrmPage>;
  const { company, stats, contacts } = q.data;

  return (
    <CrmPage
      crumbs={[{ label: 'Companies', to: '/crm/companies' }, { label: company.name }]}
      title={company.name}
      description={[company.city, company.state].filter(Boolean).join(', ') || undefined}
      actions={company.can_edit ? <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button> : undefined}
    >
      <StatStrip className="max-md:grid-cols-2" stats={[
        { key: 'contacts', label: meta?.can.view_all ? 'Contacts' : 'Your contacts', value: stats.contacts, delta: null, series: null },
        { key: 'pipeline', label: 'In pipeline', value: stats.pipeline, delta: null, series: null },
        { key: 'clients', label: 'Clients', value: stats.clients, delta: null, series: null },
        { key: 'shoots', label: 'Shoots', value: stats.shoots, delta: null, series: null },
      ]} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead><tr><th>Name</th><th>Stage</th>{meta?.can.view_all && <th>Rep</th>}<th className="r">Shoots</th><th>Last contact</th></tr></thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} data-href onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                  <td><span className="font-medium">{c.name}</span>{c.title && <span className="block text-xs text-muted-foreground">{c.title}</span>}</td>
                  <td><StageChip stage={c.stage} label={c.stage_label} /></td>
                  {meta?.can.view_all && <td>{c.assigned_rep ? <span className="flex items-center gap-1.5"><Avatar person={c.assigned_rep} size="sm" />{c.assigned_rep.name}</span> : <Chip tone="amber">Unassigned</Chip>}</td>}
                  <td className="r tabular-nums">{c.shoots?.total ?? '—'}</td>
                  <td className="text-muted-foreground">{c.last_contacted_at ? ago(c.last_contacted_at) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card title="About">
          <KeyValues rows={[
            ['Website', company.website ? <a href={/^https?:/.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline"><Globe className="h-3 w-3" />{company.website}</a> : null],
            ['Phone', company.phone ? <a href={`tel:${company.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="h-3 w-3" />{company.phone}</a> : null],
            ['Address', company.address],
            ['Segment', company.segment ? <span className="capitalize">{company.segment}</span> : null],
            ['Last shoot', stats.last_shoot ? day(stats.last_shoot) : null],
          ]} />
          {company.notes && <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-[13px] text-muted-foreground">{company.notes}</p>}
        </Card>
      </div>
      <EditCompany open={editing} onOpenChange={setEditing} company={company} />
    </CrmPage>
  );
}

function EditCompany({ open, onOpenChange, company }: { open: boolean; onOpenChange: (o: boolean) => void; company: Company['company'] }) {
  const [form, setForm] = useState(company);
  useEffect(() => { if (open) setForm(company); }, [open, company]);
  const save = useCrmMutation(() => crmApi.patch(`/companies/${company.id}`, {
    name: form.name, website: form.website || null, phone: form.phone || null, address: form.address || null,
    city: form.city || null, state: form.state || null, segment: form.segment || null, notes: form.notes || null,
  }), { success: 'Company saved' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root sm:max-w-[520px]">
        <DialogHeader><DialogTitle>Edit company</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2" hint="Renaming updates the company on every contact here.">{(id, d) => <TextInput id={id} aria-describedby={d} value={form.name} onChange={set('name')} />}</Field>
          <Field label="Website">{(id) => <TextInput id={id} value={form.website ?? ''} onChange={set('website')} />}</Field>
          <Field label="Phone">{(id) => <TextInput id={id} value={form.phone ?? ''} onChange={set('phone')} />}</Field>
          <Field label="Address" className="col-span-2">{(id) => <TextInput id={id} value={form.address ?? ''} onChange={set('address')} />}</Field>
          <Field label="City">{(id) => <TextInput id={id} value={form.city ?? ''} onChange={set('city')} />}</Field>
          <Field label="State">{(id) => <Select id={id} value={form.state ?? ''} onChange={set('state')} placeholder="—" options={US_STATES.map((s) => ({ value: s, label: s }))} />}</Field>
          <Field label="Segment">{(id) => <Select id={id} value={form.segment ?? ''} onChange={set('segment')} placeholder="—" options={[{ value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }]} />}</Field>
          <Field label="Notes" className="col-span-2">{(id) => <TextArea id={id} value={form.notes ?? ''} onChange={set('notes')} />}</Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

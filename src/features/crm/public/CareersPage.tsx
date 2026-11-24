import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicCrmApi, toApiError } from '../api';
import { Field, Select, TextArea, TextInput } from '../ui/fields';
import { US_STATES } from '../ui/usStates';
import { Note } from '../ui/primitives';
import { PublicShell } from './PublicShell';
import '../crm.css';

interface PublicPosting { slug: string; role: 'photographer' | 'sales_rep'; title: string; state: string; state_name: string; region: string | null; description: string | null }

/** Public careers pages: /careers lists open roles, /careers/:slug shows one with the apply form. */
export default function CareersPage() {
  const { slug } = useParams();
  const list = useQuery({ queryKey: ['careers'], queryFn: () => publicCrmApi.get<{ data: PublicPosting[] }>('/careers'), enabled: !slug });
  const one = useQuery({ queryKey: ['careers', slug], queryFn: () => publicCrmApi.get<{ posting: PublicPosting }>(`/careers/${slug}`), enabled: Boolean(slug), retry: false });

  if (slug) {
    return (
      <PublicShell>
        <Link to="/careers" className="text-xs text-muted-foreground hover:text-foreground">← All openings</Link>
        {one.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
        {one.isError && <p className="mt-6 text-sm">This opening is closed or doesn’t exist. <Link to="/careers" className="underline">See current openings</Link>.</p>}
        {one.data && (
          <>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{one.data.posting.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{[one.data.posting.region, one.data.posting.state_name].filter(Boolean).join(', ')}</p>
            {one.data.posting.description && <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7">{one.data.posting.description}</div>}
            <ApplyForm slug={slug} role={one.data.posting.role} />
          </>
        )}
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <h1 className="text-2xl font-semibold tracking-tight">Work with R/E Pro Photos</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">We hire real estate photographers and sales reps across the Mid-Atlantic and beyond.</p>
      <div className="mt-6 flex flex-col gap-3">
        {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {list.data?.data.length === 0 && <p className="text-sm text-muted-foreground">No openings right now. You can still send a general application below.</p>}
        {list.data?.data.map((p) => (
          <Link key={p.slug} to={`/careers/${p.slug}`} className="rounded-xl border bg-card p-4 hover:shadow-md">
            <p className="font-semibold">{p.title}</p>
            <p className="text-sm text-muted-foreground">{p.role === 'sales_rep' ? 'Sales rep' : 'Photographer'} · {[p.region, p.state_name].filter(Boolean).join(', ')}</p>
          </Link>
        ))}
      </div>
      {list.data && <ApplyForm />}
    </PublicShell>
  );
}

function ApplyForm({ slug, role: fixedRole }: { slug?: string; role?: 'photographer' | 'sales_rep' }) {
  const [role, setRole] = useState<'photographer' | 'sales_rep'>(fixedRole ?? 'photographer');
  const [f, setF] = useState({ name: '', email: '', phone: '', city: '', state: '', portfolio_url: '', gear: '', part107_number: '', sales_experience: '', website: '' });
  const [resume, setResume] = useState<File | null>(null);
  const [samples, setSamples] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => { if (v) form.append(k, v); });
    if (!slug) form.append('role', role);
    if (f.part107_number) form.append('flies_drone', '1');
    if (resume) form.append('resume', resume);
    samples.slice(0, 6).forEach((s) => form.append('samples[]', s));
    try {
      const res = await publicCrmApi.post<{ message: string }>(slug ? `/careers/${slug}/apply` : '/careers/apply', form);
      setDone(res.message);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSending(false);
    }
  };

  if (done) return <Note tone="ok" icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />} className="mt-8 text-[15px]">{done}</Note>;

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{slug ? 'Apply' : 'General application'}</h2>
      {!fixedRole && (
        <Field label="I’m applying as">{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value as typeof role)} options={[{ value: 'photographer', label: 'Photographer' }, { value: 'sales_rep', label: 'Sales rep' }]} />}</Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2">{(id) => <TextInput id={id} required value={f.name} onChange={set('name')} autoComplete="name" />}</Field>
        <Field label="Email" required>{(id) => <TextInput id={id} type="email" required value={f.email} onChange={set('email')} autoComplete="email" />}</Field>
        <Field label="Phone">{(id) => <TextInput id={id} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />}</Field>
        <Field label="City">{(id) => <TextInput id={id} value={f.city} onChange={set('city')} autoComplete="address-level2" />}</Field>
        <Field label="State">{(id) => <Select id={id} value={f.state} onChange={set('state')} placeholder="—" options={US_STATES.map((s) => ({ value: s, label: s }))} />}</Field>
        {role === 'photographer' ? (
          <>
            <Field label="Portfolio link" className="sm:col-span-2">{(id) => <TextInput id={id} type="url" value={f.portfolio_url} onChange={set('portfolio_url')} placeholder="https://" />}</Field>
            <Field label="Your gear" className="sm:col-span-2" hint="Cameras, lenses, drone; one per line.">{(id, d) => <TextArea id={id} aria-describedby={d} value={f.gear} onChange={set('gear')} />}</Field>
            <Field label="FAA Part 107 number (if you fly)">{(id) => <TextInput id={id} value={f.part107_number} onChange={set('part107_number')} />}</Field>
            <Field label="Sample photos (up to 6)">{(id) => <input id={id} type="file" multiple accept="image/*,.pdf" className="text-sm" onChange={(e) => setSamples(Array.from(e.target.files ?? []))} />}</Field>
          </>
        ) : (
          <Field label="Sales experience" className="sm:col-span-2">{(id) => <TextArea id={id} value={f.sales_experience} onChange={set('sales_experience')} placeholder="Where you’ve sold, to whom, and what you’re proud of." />}</Field>
        )}
        <Field label="Résumé (PDF or Word)" className="sm:col-span-2">{(id) => <input id={id} type="file" accept=".pdf,.doc,.docx" className="text-sm" onChange={(e) => setResume(e.target.files?.[0] ?? null)} />}</Field>
      </div>
      <div aria-hidden="true" className="absolute left-[-9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
      {error && <Note tone="bad">{error}</Note>}
      <Button type="submit" disabled={sending} className="self-start">{sending ? 'Sending…' : 'Send application'}</Button>
      <p className="text-xs text-muted-foreground">We only use your details to review your application.</p>
    </form>
  );
}

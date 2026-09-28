import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Phone, Settings2, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { listingStudioRole } from '@/utils/listingStudio';
import { listingStudioError, listingStudioService, type ListingStudioCatalog, type ListingStudioContact, type ListingStudioRequestType } from '@/services/listingStudioService';

const requestTypes = [
  { type: 'signup' as const, label: 'Sign up / subscribe', icon: Sparkles },
  { type: 'call' as const, label: 'Request a call', icon: Phone },
  { type: 'change' as const, label: 'Request a change', icon: Settings2 },
];
const selectClassName = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ListingStudioRequestForm({ catalog, onSubmitted }: { catalog: ListingStudioCatalog; onSubmitted: () => void }) {
  const { user, role } = useAuth();
  const effectiveRole = listingStudioRole(role, user?.secondary_roles);
  const isClient = effectiveRole === 'client';
  const [type, setType] = useState<ListingStudioRequestType>('signup');
  const [contactMode, setContactMode] = useState<'existing' | 'custom'>('existing');
  const [clientSearch, setClientSearch] = useState('');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ListingStudioContact | null>(null);
  const [customClient, setCustomClient] = useState({ name: '', email: '', phone: '', company_name: '' });
  const [plan, setPlan] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [phone, setPhone] = useState(isClient ? user?.phone ?? '' : '');
  const [preferredTime, setPreferredTime] = useState('');
  const [validationError, setValidationError] = useState('');
  const submission = useRef({ signature: '', key: '' });
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(clientSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [clientSearch]);
  const clients = useQuery({
    queryKey: ['listing-studio-clients', user?.id, effectiveRole, search],
    queryFn: () => listingStudioService.clients(search),
    enabled: !isClient && contactMode === 'existing',
  });
  const create = useMutation({ mutationFn: listingStudioService.create, onSuccess: onSubmitted });
  const chooseType = (next: ListingStudioRequestType) => { setType(next); setValidationError(''); create.reset(); };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError('');
    if (!isClient && contactMode === 'existing' && !selectedClient) {
      setValidationError('Select the client this request is for.');
      return;
    }
    if (type === 'signup' && !plan) {
      setValidationError('Select a plan or choose a custom plan.');
      return;
    }
    const input = {
      type,
      ...(!isClient ? contactMode === 'existing'
        ? { client_id: selectedClient!.id }
        : { custom_client: Object.fromEntries(Object.entries(customClient).map(([key, value]) => [key, value.trim()])) as typeof customClient } : {}),
      ...(type === 'signup' ? { plan_code: plan, services } : {}),
      ...(details.trim() ? { details: details.trim() } : {}),
      ...(type === 'call' ? { phone: phone.trim(), ...(preferredTime.trim() ? { preferred_time: preferredTime.trim() } : {}) } : {}),
    };
    const signature = JSON.stringify(input);
    if (submission.current.signature !== signature) submission.current = { signature, key: crypto.randomUUID() };
    create.mutate({ ...input, idempotency_key: submission.current.key });
  };

  return <form onSubmit={submit} className="space-y-5">
    <fieldset disabled={create.isPending} className="space-y-5 min-w-0">
      <legend className="sr-only">New Listing Studio request</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Request type">
        {requestTypes.map(({ type: itemType, label, icon: Icon }) => <Button key={itemType} type="button" variant={type === itemType ? 'default' : 'outline'} aria-pressed={type === itemType} className="h-auto min-h-11 whitespace-normal px-2" onClick={() => chooseType(itemType)}><Icon className="mr-2 h-4 w-4 shrink-0" />{label}</Button>)}
      </div>
      {isClient ? <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm"><span className="text-muted-foreground">For </span><strong>{user?.name}</strong><span className="ml-2 break-all text-muted-foreground">{user?.email}</span></div> : <div className="space-y-3 rounded-xl border p-4">
        <div className="space-y-2"><Label htmlFor="ls-client-mode">Who is this for?</Label><select id="ls-client-mode" value={contactMode} onChange={event => { setContactMode(event.target.value as 'existing' | 'custom'); setPhone(''); }} className={selectClassName}><option value="existing">Existing client</option><option value="custom">New / custom client</option></select></div>
        {contactMode === 'existing' ? <>
          <div className="space-y-2"><Label htmlFor="ls-client-search">Find a client</Label><Input id="ls-client-search" placeholder="Search by name or email" value={clientSearch} onChange={event => setClientSearch(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="ls-client">Client</Label><select id="ls-client" className={selectClassName} value={selectedClient?.id ?? ''} onChange={event => { const client = clients.data?.find(item => String(item.id) === event.target.value) ?? null; setSelectedClient(client); setPhone(client?.phone ?? ''); }} required>
            <option value="">{clients.isFetching ? 'Loading clients…' : 'Select a client'}</option>
            {selectedClient && !clients.data?.some(item => item.id === selectedClient.id) && <option value={selectedClient.id}>{selectedClient.name} · {selectedClient.email}</option>}
            {clients.data?.map(client => <option key={client.id} value={client.id}>{client.name} · {client.email}</option>)}
          </select></div>
          {clients.isError && <div role="alert" className="text-sm text-destructive">Could not load clients. <button type="button" className="underline" onClick={() => clients.refetch()}>Try again</button></div>}
          {!clients.isFetching && !clients.isError && clients.data?.length === 0 && <p className="text-sm text-muted-foreground">No clients found. Try another search or choose a new / custom client.</p>}
        </> : <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="ls-name">Client name</Label><Input id="ls-name" required maxLength={255} value={customClient.name} onChange={event => setCustomClient({ ...customClient, name: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="ls-email">Client email</Label><Input id="ls-email" type="email" required maxLength={255} value={customClient.email} onChange={event => setCustomClient({ ...customClient, email: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="ls-contact-phone">Client phone <span className="text-muted-foreground">(optional)</span></Label><Input id="ls-contact-phone" type="tel" maxLength={40} value={customClient.phone} onChange={event => { setCustomClient({ ...customClient, phone: event.target.value }); setPhone(event.target.value); }} /></div>
            <div className="space-y-2"><Label htmlFor="ls-company">Company <span className="text-muted-foreground">(optional)</span></Label><Input id="ls-company" maxLength={255} value={customClient.company_name} onChange={event => setCustomClient({ ...customClient, company_name: event.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Contact details are sent for admin review. Submitting does not create a dashboard account.</p>
        </>}
      </div>}
      {type === 'signup' && <>
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Plan preference</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{catalog.plans.map(item => <label key={item.code} className={cn('relative cursor-pointer rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring', plan === item.code ? 'border-primary bg-primary/5' : 'hover:bg-muted/40')}>
            <input type="radio" name="ls-plan" value={item.code} checked={plan === item.code} onChange={() => setPlan(item.code)} className="sr-only" />
            <span className="block text-sm font-medium">{item.reference_price_usd === null ? item.name : `$${item.reference_price_usd}`}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{item.reference_price_usd === null ? 'Tailored to your needs' : 'Reference price'}</span>
          </label>)}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">An admin will confirm pricing, billing frequency and included services with you before activation. No payment is collected here.</p>
        </fieldset>
        <fieldset><legend className="mb-3 text-sm font-medium">Services of interest <span className="font-normal text-muted-foreground">(optional)</span></legend>
          <div className="grid gap-3 sm:grid-cols-2">{catalog.services.map(service => <label key={service.code} className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={services.includes(service.code)} onChange={event => setServices(event.target.checked ? [...services, service.code] : services.filter(code => code !== service.code))} /><span>{service.name}</span></label>)}</div>
        </fieldset>
      </>}
      {type === 'call' && <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="ls-phone">Callback phone</Label><Input id="ls-phone" type="tel" required maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} placeholder="Include country code" /></div>
        <div className="space-y-2"><Label htmlFor="ls-time">Preferred time <span className="text-muted-foreground">(optional)</span></Label><Input id="ls-time" value={preferredTime} maxLength={255} onChange={event => setPreferredTime(event.target.value)} placeholder="e.g. Weekdays 2–4 pm Eastern" /></div>
      </div>}
      <div className="space-y-2"><Label htmlFor="ls-details">{type === 'change' ? 'What would you like to change?' : 'Additional details (optional)'}</Label><Textarea id="ls-details" required={type === 'change'} maxLength={4000} rows={3} value={details} onChange={event => setDetails(event.target.value)} placeholder={type === 'change' ? 'Describe the plan, services or contact details you would like to change.' : 'Tell us about your listings and what you need.'} /></div>
      {(validationError || create.isError) && <p role="alert" className="text-sm text-destructive">{validationError || listingStudioError(create.error)}</p>}
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Your request goes to an admin or super admin.</p><Button type="submit" className="shrink-0" disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{create.isPending ? 'Submitting…' : type === 'signup' ? 'Submit signup request' : type === 'call' ? 'Submit call request' : 'Submit change request'}</Button></div>
    </fieldset>
  </form>;
}

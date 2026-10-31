import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listingStudioStaff } from '@/services/listingStudioStaffService';

export function StudioClientPicker({ actorId, embedded = false }: { actorId: string; embedded?: boolean }) {
  const [input, setInput] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(input.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [input]);
  const clients = useQuery({ queryKey: ['studio-managed-clients', actorId, search, page], queryFn: ({ signal }) => listingStudioStaff.clients(search, page, signal), staleTime: 30000 });
  return <section className={embedded ? 'space-y-5' : 'w-full min-w-0 space-y-5 p-4 sm:p-6 lg:p-8'} aria-labelledby="studio-client-directory">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="studio-client-directory" className="text-lg font-semibold tracking-tight">Choose a client</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Manage their plan, use available credit, or prepare a purchase for their approval.</p></div>{clients.data && <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">{clients.data.pagination.total} {clients.data.pagination.total === 1 ? 'client' : 'clients'}</span>}</div>
    <div className="rounded-2xl border bg-card p-4 sm:p-5"><Label htmlFor="studio-managed-client-search" className="text-xs font-medium">Find an active client</Label><div className="relative mt-2"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="studio-managed-client-search" className="h-11 border-border/70 bg-background pl-9" value={input} maxLength={100} onChange={event => setInput(event.target.value)} placeholder="Search by name or email" /></div></div>
    {clients.isPending && <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading clients…</p>}
    {clients.isError && <div role="alert" className="space-y-3 rounded-xl border p-5"><p>Clients could not be loaded.</p><Button variant="outline" onClick={() => void clients.refetch()}>Try again</Button></div>}
    {clients.data?.clients.length === 0 && <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center"><Users aria-hidden="true" className="h-7 w-7 text-muted-foreground/60" /><p className="text-sm text-muted-foreground">No active clients match this search.</p></div>}
    {clients.data && <><div className="grid gap-3 lg:grid-cols-2">{clients.data.clients.map(client => <Link key={client.id} to={'/listing-studio/manage/' + encodeURIComponent(client.id)} className="group flex min-h-24 min-w-0 items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{client.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{client.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{client.email}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary"><span className="hidden sm:inline">Manage</span><ArrowRight aria-hidden="true" className="h-4 w-4" /></span></Link>)}</div>
    {(page > 1 || clients.data.pagination.hasMore) && <nav aria-label="Client pages" className="flex items-center justify-between gap-3 border-t pt-4"><Button variant="outline" disabled={page === 1 || clients.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><p className="text-xs text-muted-foreground">Page {page}</p><Button variant="outline" disabled={!clients.data.pagination.hasMore || clients.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></nav>}</>}
  </section>;
}

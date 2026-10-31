import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listingStudioStaff } from '@/services/listingStudioStaffService';

export function StudioClientPicker({ actorId }: { actorId: string }) {
  const [input, setInput] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(input.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [input]);
  const clients = useQuery({ queryKey: ['studio-managed-clients', actorId, search, page], queryFn: ({ signal }) => listingStudioStaff.clients(search, page, signal), staleTime: 30000 });
  return <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">Client plans & credit</h1><p className="text-sm leading-6 text-muted-foreground">Choose the client for this purchase. Their editing credit and subscription stay with their account.</p></header>
    <div className="space-y-2"><Label htmlFor="studio-managed-client-search">Find an active client</Label><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="studio-managed-client-search" className="pl-9" value={input} maxLength={100} onChange={event => setInput(event.target.value)} placeholder="Search by name or email" /></div></div>
    {clients.isPending && <p role="status" className="flex gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading clients…</p>}
    {clients.isError && <div role="alert" className="space-y-3 rounded-xl border p-4"><p>Clients could not be loaded.</p><Button variant="outline" onClick={() => void clients.refetch()}>Try again</Button></div>}
    {clients.data?.clients.length === 0 && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No active clients match this search.</p>}
    {clients.data && <><div className="divide-y rounded-2xl border bg-card">{clients.data.clients.map(client => <Link key={client.id} to={'/listing-studio/manage/' + encodeURIComponent(client.id)} className="flex min-h-20 items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="min-w-0"><span className="block truncate text-sm font-medium">{client.name}</span><span className="block truncate text-xs text-muted-foreground">{client.email}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-medium">Manage<ArrowRight aria-hidden="true" className="h-4 w-4" /></span></Link>)}</div>
    {(page > 1 || clients.data.pagination.hasMore) && <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page === 1 || clients.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><p className="text-xs text-muted-foreground">Page {page}</p><Button variant="outline" disabled={!clients.data.pagination.hasMore || clients.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>}</>}
  </div>;
}

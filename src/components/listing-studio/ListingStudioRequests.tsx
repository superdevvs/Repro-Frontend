import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { listingStudioError, listingStudioService, type ListingStudioCatalog, type ListingStudioRequest, type ListingStudioStatus } from '@/services/listingStudioService';

const requestLabels = { signup: 'Signup request', call: 'Call request', change: 'Change request' };
const statusLabels = { pending: 'Awaiting review', approved: 'Approved', declined: 'Declined', completed: 'Completed' };
const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function RequestCard({ request, catalog, canReview, onReviewed }: { request: ListingStudioRequest; catalog: ListingStudioCatalog; canReview: boolean; onReviewed: () => void }) {
  const [reviewNote, setReviewNote] = useState('');
  const review = useMutation({
    mutationFn: (status: Exclude<ListingStudioStatus, 'pending'>) => listingStudioService.review(request.id, { status, ...(reviewNote.trim() ? { review_note: reviewNote.trim() } : {}) }),
    onSuccess: onReviewed,
  });
  const plan = catalog.plans.find(item => item.code === request.plan_code);
  return <article className="min-w-0 rounded-xl border bg-card p-4" aria-label={`${requestLabels[request.type]} ${request.id}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-sm font-semibold">{requestLabels[request.type]} <span className="font-normal text-muted-foreground">#{request.id}</span></h3><p className="mt-1 text-xs text-muted-foreground">{dateLabel(request.created_at)}</p></div>
      <Badge variant={request.status === 'declined' ? 'destructive' : request.status === 'pending' ? 'secondary' : 'outline'} className="gap-1">{request.status === 'pending' ? <Clock3 className="h-3 w-3" /> : request.status !== 'declined' ? <Check className="h-3 w-3" /> : null}{statusLabels[request.status]}</Badge>
    </div>
    <div className="mt-3 space-y-2 text-sm">
      <div><p className="font-medium">{request.contact.name}</p><p className="break-all text-muted-foreground">{request.contact.email}</p>{request.contact.company_name && <p className="text-muted-foreground">{request.contact.company_name}</p>}{request.contact.phone && request.type !== 'call' && <p className="text-muted-foreground">{request.contact.phone}</p>}</div>
      {plan && <p><span className="text-muted-foreground">Plan preference: </span>{plan.name}{plan.reference_price_usd !== null ? ` · $${plan.reference_price_usd} reference price` : ''}</p>}
      {!!request.services?.length && <div className="flex flex-wrap gap-1.5">{request.services.map(code => <Badge variant="secondary" className="font-normal" key={code}>{catalog.services.find(service => service.code === code)?.name ?? code}</Badge>)}</div>}
      {request.type === 'call' && <div><p><span className="text-muted-foreground">Callback: </span>{request.phone}</p>{request.preferred_time && <p className="mt-1"><span className="text-muted-foreground">Preferred time: </span>{request.preferred_time}</p>}</div>}
      {request.details && <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3">{request.details}</p>}
      <p className="text-xs text-muted-foreground">Submitted by {request.submitted_by?.name ?? 'Former account'}</p>
      {request.status !== 'pending' && <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{request.reviewed_by?.name ?? 'Admin'}{request.reviewed_at ? ` · ${dateLabel(request.reviewed_at)}` : ''}</p>{request.review_note && <p className="mt-1 whitespace-pre-wrap break-words">{request.review_note}</p>}{request.type === 'signup' && request.status === 'approved' && <p className="mt-2 text-xs text-muted-foreground">Approval records the signup review. Payment and activation are arranged separately with your admin.</p>}</div>}
    </div>
    {canReview && request.status === 'pending' && <div className="mt-4 space-y-3 border-t pt-4">
      <div className="space-y-2"><Label htmlFor={`ls-review-${request.id}`}>Response to client <span className="font-normal text-muted-foreground">(optional, visible to client)</span></Label><Textarea id={`ls-review-${request.id}`} value={reviewNote} onChange={event => setReviewNote(event.target.value)} disabled={review.isPending} maxLength={2000} rows={2} placeholder="Confirm next steps or explain your decision." /></div>
      {review.isError && <p className="text-sm text-destructive" role="alert">{listingStudioError(review.error)}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" disabled={review.isPending} onClick={() => review.mutate('declined')}>Decline request</Button><Button size="sm" disabled={review.isPending} onClick={() => review.mutate(request.type === 'call' ? 'completed' : 'approved')}>{review.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{request.type === 'call' ? 'Mark call completed' : 'Approve request'}</Button></div>
    </div>}
  </article>;
}

export function ListingStudioRequests({ catalog, canReview, identity, refreshVersion }: { catalog: ListingStudioCatalog; canReview: boolean; identity: string; refreshVersion: number }) {
  const [page, setPage] = useState(1);
  const requests = useQuery({ queryKey: ['listing-studio-requests', identity, page, refreshVersion], queryFn: () => listingStudioService.requests(page) });
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{canReview ? 'Review signup, callback and change requests.' : 'Track your requests and responses from the team.'}</p><Button variant="ghost" size="icon" aria-label="Refresh requests" disabled={requests.isFetching} onClick={() => requests.refetch()}><RefreshCw className={`h-4 w-4 ${requests.isFetching ? 'animate-spin' : ''}`} /></Button></div>
    {requests.isPending && <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading requests…</div>}
    {requests.isError && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p className="text-destructive">Unable to load requests.</p><Button className="mt-3" variant="outline" size="sm" onClick={() => requests.refetch()}>Try again</Button></div>}
    {requests.data && requests.data.data.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center"><Clock3 className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><h3 className="text-sm font-medium">No requests yet</h3><p className="mt-1 text-sm text-muted-foreground">Signup, call and change requests will appear here.</p></div>}
    {requests.data?.data.map(request => <RequestCard key={`${request.id}-${request.status}`} request={request} catalog={catalog} canReview={canReview} onReviewed={() => { void requests.refetch(); }} />)}
    {requests.data && requests.data.meta.last_page > 1 && <div className="flex items-center justify-between border-t pt-3"><Button variant="outline" size="sm" disabled={page === 1 || requests.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><span className="text-xs text-muted-foreground">Page {page} of {requests.data.meta.last_page}</span><Button variant="outline" size="sm" disabled={page >= requests.data.meta.last_page || requests.isFetching} onClick={() => setPage(page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>}
  </div>;
}

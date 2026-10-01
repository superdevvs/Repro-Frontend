import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchSupportArticle, fetchSupportKnowledge, isSafeSupportLink, roleHelpLabel } from '@/services/supportKnowledge';
import type { AiChatRequest } from '@/types/ai';

interface RobbieKnowledgePanelProps {
  onAsk: (message: string, context: AiChatRequest['context']) => void;
}

export default function RobbieKnowledgePanel({ onAsk }: RobbieKnowledgePanelProps) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const articleId = params.get('article') || '';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (search.trim() === query) return;
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [search, query]);
  const catalog = useQuery({
    queryKey: ['support-knowledge', user?.id, user?.role, query, category, page],
    queryFn: ({ signal }) => fetchSupportKnowledge({ query: query || undefined, category: category || undefined, page, per_page: 12 }, signal),
    enabled: Boolean(user),
  });
  const article = useQuery({
    queryKey: ['support-article', user?.id, user?.role, articleId],
    queryFn: ({ signal }) => fetchSupportArticle(articleId, signal),
    enabled: Boolean(user && articleId),
    retry: false,
  });
  const articleUrl = (id: string) => { const next = new URLSearchParams(params); next.set('tab', 'help'); next.set('article', id); return `?${next.toString()}`; };
  const closeArticle = () => setParams((current) => { const next = new URLSearchParams(current); next.delete('article'); next.set('tab', 'help'); return next; });
  const data = article.data;
  const pagination = catalog.data?.meta.pagination;
  const total = pagination?.total ?? catalog.data?.meta.total ?? catalog.data?.data.length ?? 0;
  const lastPage = pagination?.last_page ?? 1;
  const ask = (title: string, id?: string) => onAsk(`Help me with: ${title}`, { intent: 'support_faq', source: 'knowledge_base', knowledge_article_id: id });

  return <section aria-label="Help and guides" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
    <header className="shrink-0 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{roleHelpLabel(user?.role)} support</p>
      {!articleId && <p className="text-sm text-muted-foreground">Find steps for your dashboard, then ask Robbie in this chat.</p>}
      <Link to="/messaging/email/inbox?tab=support" className="inline-flex min-h-9 items-center text-xs font-medium text-primary underline underline-offset-4">Support requests</Link>
    </header>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`min-h-0 min-w-0 flex-1 flex-col gap-3 ${articleId ? 'hidden' : 'flex'}`}>
        <div className="relative"><Search aria-hidden className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search help guides" placeholder="Search a question or task" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9 text-base" /></div>
        <label className="block text-sm"><span className="sr-only">Guide category</span><select aria-label="Guide category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-11 w-full rounded-md border border-input bg-background px-3"><option value="">All topics</option>{(catalog.data?.meta.categories ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <p role="status" className="text-xs text-muted-foreground">{catalog.isLoading ? 'Loading guides…' : catalog.isError ? 'Guides are unavailable' : `${total} guide${total === 1 ? '' : 's'} · ${roleHelpLabel(user?.role)}`}</p>
        {catalog.isError && <div role="alert" className="rounded-lg border p-4 text-sm"><p>We could not load the guides. Try again.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void catalog.refetch()}>Retry guides</Button></div>}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1" aria-label="Guide results">
          {(catalog.data?.data ?? []).map((item) => <Link key={item.id} to={articleUrl(item.id)} aria-current={articleId === item.id ? 'page' : undefined} className={`block rounded-xl border p-4 transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${articleId === item.id ? 'border-primary bg-primary/5' : 'bg-card'}`}><p className="mb-1 text-xs text-muted-foreground">{item.category}</p><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.summary}</p></Link>)}
        </div>
        {!catalog.isLoading && !catalog.isError && catalog.data?.data.length === 0 && <div className="rounded-xl border border-dashed p-5 text-sm"><p className="font-medium">No matching guide</p><p className="mt-1 text-muted-foreground">Try a shorter phrase or ask Robbie to help describe the issue.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => ask(query || 'I need help with the dashboard')}>Ask Robbie</Button></div>}
        {(lastPage > 1 || page > 1) && <nav aria-label="Help guide pages" className="flex shrink-0 items-center justify-between gap-2 border-t pt-3"><Button variant="outline" className="min-h-11" disabled={page === 1 || catalog.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="text-xs text-muted-foreground">{page} / {lastPage}</span><Button variant="outline" className="min-h-11" disabled={page >= lastPage || catalog.isFetching || catalog.isError} onClick={() => setPage((value) => value + 1)}>Next</Button></nav>}
      </div>
      <div className={`min-h-0 min-w-0 flex-1 flex-col ${!articleId ? 'hidden' : 'flex'}`}>
        {articleId && <Button variant="ghost" className="mb-2 min-h-11 shrink-0 self-start px-2" onClick={closeArticle}><ArrowLeft className="mr-2 h-4 w-4" />All guides</Button>}
        {articleId && article.isLoading && <p role="status" className="p-5 text-sm text-muted-foreground">Loading guide…</p>}
        {articleId && article.isError && <div role="alert" className="rounded-xl border p-5"><h2 className="font-semibold">Guide unavailable</h2><p className="mt-2 text-sm text-muted-foreground">This guide may be unavailable for your role, or could not be loaded. Browse your guides or retry.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void article.refetch()}>Retry guide</Button></div>}
        {articleId && data && <article className="min-h-0 space-y-5 overflow-y-auto overscroll-contain rounded-xl border bg-card p-4">
          <div><p className="text-xs text-primary">{data.category}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{data.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{data.summary}</p></div>
          <section><h3 className="mb-3 text-sm font-semibold">Steps</h3><ol className="list-decimal space-y-3 pl-5 text-sm leading-6">{data.steps.map((step, index) => <li key={index} className="pl-1">{step}</li>)}</ol></section>
          {data.troubleshooting.length > 0 && <section className="rounded-lg bg-muted/50 p-4"><h3 className="mb-2 text-sm font-semibold">If something goes wrong</h3><ul className="list-disc space-y-2 pl-4 text-sm leading-6">{data.troubleshooting.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
          {data.escalation && <section><h3 className="mb-2 text-sm font-semibold">When you need the team</h3><p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{Array.isArray(data.escalation) ? data.escalation.join('\n') : data.escalation}</p></section>}
          <div className="flex flex-wrap gap-2 border-t pt-4"><p className="w-full text-xs text-muted-foreground">Adds a question to your draft. You choose when to send.</p><Button className="min-h-11" onClick={() => ask(data.title, data.id)}>Ask Robbie about this<ArrowRight className="ml-2 h-4 w-4" /></Button>{data.links.filter((link) => isSafeSupportLink(link.url)).map((link) => <Button key={link.url} asChild variant="outline" className="min-h-11">{link.url.startsWith('/') ? <Link to={link.url}>{link.label}</Link> : <a href={link.url}>{link.label}</a>}</Button>)}</div>
        </article>}
      </div>
    </div>
  </section>;
}

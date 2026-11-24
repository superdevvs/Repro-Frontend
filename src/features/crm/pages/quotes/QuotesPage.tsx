import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useCrmMeta, useCrmQuery } from '../../hooks';
import { money, when } from '../../format';
import { useRobbieWhere } from '../../robbie/useCrmRobbie';
import type { Quote } from '../../types';
import { Chip, CrmPage, Empty, ErrorNote, Loading, TabBar } from '../../ui/primitives';
import { QUOTE_LABEL, quoteTone } from './quoteStatus';

const QUOTE_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending_approval', label: 'Needs approval' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
] as const;
type Tab = (typeof QUOTE_TABS)[number]['key'];

/** All quotes the user can see. Admins start on the approvals tab when something waits. */
export default function QuotesPage() {
  useRobbieWhere({ page: 'quotes' });
  const { data: meta } = useCrmMeta();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = QUOTE_TABS.find((item) => item.key === params.get('status'))?.key ?? '';
  const setTab = (next: Tab) => setParams((current) => {
    const updated = new URLSearchParams(current);
    if (next) updated.set('status', next);
    else updated.delete('status');
    return updated;
  }, { replace: true });
  const q = useCrmQuery<{ data: Quote[] }>(['crm', 'quotes', tab], '/quotes', { status: tab || undefined });

  return (
    <CrmPage
      title="Quotes"
      description={`Start a quote from a contact. Discounts above ${meta?.settings.quote_discount_approval_percent ?? 10}% need an admin’s approval.`}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[...QUOTE_TABS]} />}
    >
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.data.length === 0 && <Empty icon={<FileText className="h-5 w-5" />} title={tab ? 'No quotes match this status.' : 'No quotes yet.'}>{!tab && 'Open a contact and choose New quote.'}</Empty>}
      {q.data && q.data.data.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table crm-workflow-table">
            <thead><tr><th className="w-3/5 lg:w-auto">Quote</th><th className="hidden lg:table-cell">Contact</th><th className="hidden lg:table-cell">Status</th><th className="crm-wide-cell r">Discount</th><th className="r">Total</th><th className="crm-wide-cell">Sent</th><th className="crm-wide-cell">By</th></tr></thead>
            <tbody>
              {q.data.data.map((x) => (
                <tr key={x.id} data-href onClick={() => navigate(`/crm/quotes/${x.id}`)}>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to={`/crm/quotes/${x.id}`} onClick={(e) => e.stopPropagation()} className="break-words font-medium hover:underline">{x.number}</Link>
                      {x.via_robbie && <Chip tone="blue">via Robbie</Chip>}
                    </div>
                    {x.contact && <span className="mt-1 block break-words text-xs text-muted-foreground lg:hidden">{x.contact.name}{x.contact.company && ` · ${x.contact.company}`}</span>}
                  </td>
                  <td className="hidden lg:table-cell">{x.contact?.name}{x.contact?.company && <span className="block text-xs text-muted-foreground">{x.contact.company}</span>}</td>
                  <td className="hidden lg:table-cell"><Chip tone={quoteTone(x.status)}>{QUOTE_LABEL[x.status]}</Chip></td>
                  <td className="crm-wide-cell r tabular-nums">{x.discount_percent ? `${x.discount_percent}%` : '—'}</td>
                  <td className="r">
                    <div className="flex flex-col items-end gap-1">
                      <span className="break-words font-medium tabular-nums">{money(x.total)}</span>
                      <span className="lg:hidden"><Chip tone={quoteTone(x.status)} className="crm-workflow-status">{QUOTE_LABEL[x.status]}</Chip></span>
                    </div>
                  </td>
                  <td className="crm-wide-cell text-muted-foreground">{x.sent_at ? when(x.sent_at) : '—'}</td>
                  <td className="crm-wide-cell text-muted-foreground">{x.created_by?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmPage>
  );
}

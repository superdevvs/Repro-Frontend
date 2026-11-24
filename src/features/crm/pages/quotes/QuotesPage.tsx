import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useCrmMeta, useCrmQuery } from '../../hooks';
import { money, when } from '../../format';
import { useRobbieWhere } from '../../robbie/useCrmRobbie';
import type { Quote } from '../../types';
import { Chip, CrmPage, Empty, ErrorNote, Loading, TabBar } from '../../ui/primitives';
import { QUOTE_LABEL, quoteTone } from './quoteStatus';

type Tab = '' | 'draft' | 'pending_approval' | 'sent' | 'accepted' | 'declined';

/** All quotes the user can see. Admins start on the approvals tab when something waits. */
export default function QuotesPage() {
  useRobbieWhere({ page: 'quotes' });
  const { data: meta } = useCrmMeta();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('status') as Tab) ?? '');
  const q = useCrmQuery<{ data: Quote[] }>(['crm', 'quotes', tab], '/quotes', { status: tab || undefined });

  return (
    <CrmPage
      title="Quotes"
      description={`Start a quote from a contact. Discounts above ${meta?.settings.quote_discount_approval_percent ?? 10}% need an admin’s approval.`}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[{ key: '', label: 'All' }, { key: 'draft', label: 'Drafts' }, { key: 'pending_approval', label: 'Needs approval' }, { key: 'sent', label: 'Sent' }, { key: 'accepted', label: 'Accepted' }, { key: 'declined', label: 'Declined' }]} />}
    >
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.data.length === 0 && <Empty icon={<FileText className="h-5 w-5" />} title="No quotes here.">Open a contact and choose New quote.</Empty>}
      {q.data && q.data.data.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead><tr><th>Quote</th><th>Contact</th><th>Status</th><th className="r">Discount</th><th className="r">Total</th><th>Sent</th><th>By</th></tr></thead>
            <tbody>
              {q.data.data.map((x) => (
                <tr key={x.id} data-href onClick={() => navigate(`/crm/quotes/${x.id}`)}>
                  <td className="font-medium">{x.number}{x.via_robbie && <Chip tone="blue" className="ml-1.5">via Robbie</Chip>}</td>
                  <td>{x.contact?.name}{x.contact?.company && <span className="block text-xs text-muted-foreground">{x.contact.company}</span>}</td>
                  <td><Chip tone={quoteTone(x.status)}>{QUOTE_LABEL[x.status]}</Chip></td>
                  <td className="r tabular-nums">{x.discount_percent ? `${x.discount_percent}%` : '—'}</td>
                  <td className="r font-medium tabular-nums">{money(x.total)}</td>
                  <td className="text-muted-foreground">{x.sent_at ? when(x.sent_at) : '—'}</td>
                  <td className="text-muted-foreground">{x.created_by?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmPage>
  );
}

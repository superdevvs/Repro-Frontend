import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search } from 'lucide-react';
import { PageSearch } from '@/components/search/PageSearch';
import { useCrmMeta, useCrmQuery } from '../hooks';
import { ago } from '../format';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import { Chip, CrmPage, Empty, ErrorNote, Loading } from '../ui/primitives';

interface CompanyRow { id: number; name: string; website: string | null; city: string | null; state: string | null; segment: string | null; contacts: number; clients: number; pipeline: number; last_touch: string | null }

/** Companies (frame F4): brokerages and businesses, built from each contact's company. */
export default function CompaniesPage() {
  useRobbieWhere({ page: 'companies' });
  const { data: meta } = useCrmMeta();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const q = useCrmQuery<{ data: CompanyRow[] }>(['crm', 'companies', search], '/companies', { q: search });

  return (
    <CrmPage title="Companies" count={q.data?.data.length ?? null} description={meta?.can.view_all ? 'Every company your contacts work at.' : 'Companies where you have contacts. Other reps’ contacts there stay private.'}>
      <div className="relative flex h-8 w-[260px] items-center rounded-lg border bg-background max-md:h-10 max-md:w-full" data-page-search-container>
        <Search className="ml-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <PageSearch searchId="crm-companies" scope="crm-companies" scopeLabel="Companies" priority={20} aria-label="Search companies" placeholder="Search companies" value={search} onChange={(e) => setSearch(e.target.value)} className="h-full border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0" />
      </div>
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.data.length === 0 && <Empty icon={<Building2 className="h-5 w-5" />} title={search ? 'No companies match.' : 'No companies yet.'}>Companies appear when contacts have a company filled in.</Empty>}
      {q.data && q.data.data.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead><tr><th>Company</th><th>Segment</th><th className="r">Contacts</th><th className="r">In pipeline</th><th className="r">Clients</th><th>Last activity</th></tr></thead>
            <tbody>
              {q.data.data.map((c) => (
                <tr key={c.id} data-href onClick={() => navigate(`/crm/companies/${c.id}`)}>
                  <td><span className="font-medium">{c.name}</span>{(c.city || c.state) && <span className="block text-xs text-muted-foreground">{[c.city, c.state].filter(Boolean).join(', ')}</span>}</td>
                  <td>{c.segment ? <Chip tone="line">{c.segment === 'commercial' ? 'Commercial' : 'Residential'}</Chip> : '—'}</td>
                  <td className="r tabular-nums">{c.contacts}</td>
                  <td className="r tabular-nums">{c.pipeline}</td>
                  <td className="r tabular-nums">{c.clients}</td>
                  <td className="text-muted-foreground">{c.last_touch ? ago(c.last_touch.replace(' ', 'T')) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmPage>
  );
}

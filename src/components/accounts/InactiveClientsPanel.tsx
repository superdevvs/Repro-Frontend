import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATE_OPTIONS } from '@/utils/stateUtils';
import { exportRowsAsCsv } from '@/utils/accountingExports';
import { Loader2, Download, Users } from 'lucide-react';

interface InactiveClient {
  client_id: number | string;
  client_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  sales_rep: string | null;
  sales_rep_id: number | null;
  last_shoot_date: string | null;
  last_login: string | null;
  total_shoots: number | null;
  days_since_last_shoot: number | null;
  reason: string;
}

interface ReportResponse {
  cutoff_days: number;
  cutoff_date: string;
  total: number;
  clients: InactiveClient[];
}

const DAYS_OPTIONS = [
  { value: '90', label: '90 days' },
  { value: '120', label: '120 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
];

function getToken(): string | null {
  return localStorage.getItem('authToken') || localStorage.getItem('token');
}

/**
 * Inactive Clients report (feature #9). Lists clients with no shoot in the selected window,
 * with region/state + sales-rep filters and CSV export. Admins see all clients; sales reps see
 * their own (server-scoped).
 */
export function InactiveClientsPanel() {
  const { toast } = useToast();
  const [days, setDays] = useState('90');
  const [stateFilter, setStateFilter] = useState('all');
  const [repFilter, setRepFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const params = new URLSearchParams({ days });
      if (stateFilter !== 'all') params.set('state', stateFilter);
      const res = await fetch(`${API_BASE_URL}/api/admin/reports/inactive-clients?${params.toString()}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load report');
      const data = (await res.json()) as ReportResponse;
      setReport(data);
    } catch (e) {
      toast({
        title: 'Could not load inactive clients',
        description: e instanceof Error ? e.message : 'Unexpected error.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [days, stateFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Rep options derived from the returned rows (avoids a second fetch).
  const repOptions = useMemo(() => {
    const map = new Map<string, string>();
    (report?.clients || []).forEach((c) => {
      if (c.sales_rep) map.set(String(c.sales_rep_id ?? c.sales_rep), c.sales_rep);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [report]);

  const rows = useMemo(() => {
    let list = report?.clients || [];
    if (repFilter !== 'all') {
      list = list.filter((c) => String(c.sales_rep_id ?? c.sales_rep) === repFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.client_name.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [report, repFilter, search]);

  const handleExport = useCallback(() => {
    exportRowsAsCsv(
      `inactive-clients-${days}d-${new Date().toISOString().slice(0, 10)}`,
      [
        { key: 'client_name', label: 'Client / Agent' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'state', label: 'State' },
        { key: 'sales_rep', label: 'Sales Rep' },
        { key: 'last_shoot_date', label: 'Last Shoot' },
        { key: 'days_since_last_shoot', label: 'Days Since Last Shoot' },
        { key: 'total_shoots', label: 'Total Shoots' },
      ],
      rows as unknown as Record<string, unknown>[],
    );
  }, [rows, days]);

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-base font-semibold">Inactive Clients</h3>
          <p className="text-sm text-muted-foreground">
            Clients with no shoot in the selected window
            {report ? ` — ${rows.length} shown` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAYS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All states" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {STATE_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {repOptions.length > 0 && (
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All reps" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {repOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            placeholder="Search name/email/phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52"
          />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-7 w-7" />
          No inactive clients for the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Client / Agent</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2 pr-3">State</th>
                <th className="py-2 pr-3">Sales Rep</th>
                <th className="py-2 pr-3">Last Shoot</th>
                <th className="py-2 pr-3 text-right">Days</th>
                <th className="py-2 pr-3 text-right">Shoots</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={String(c.client_id)} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3 font-medium">{c.client_name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    <div className="truncate max-w-[220px]">{c.email || '—'}</div>
                    <div className="text-xs">{c.phone || ''}</div>
                  </td>
                  <td className="py-2 pr-3">{c.state || '—'}</td>
                  <td className="py-2 pr-3">{c.sales_rep || 'Unassigned'}</td>
                  <td className="py-2 pr-3">{c.last_shoot_date || 'Never'}</td>
                  <td className="py-2 pr-3 text-right">{c.days_since_last_shoot ?? '—'}</td>
                  <td className="py-2 pr-3 text-right">{c.total_shoots ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from './invoiceReviewWorkspaceUtils';
import type { PayoutReportRow } from './payoutReportDisplay';

const groupLabel = { photographer: 'Photographer', editor: 'Editor', salesRep: 'Sales rep' };
export function PayoutReportResults({ rows }: { rows: PayoutReportRow[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedKey, setSelectedKey] = useState('');
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(search.trim().toLowerCase())), [rows, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = filtered.find((row) => row.key === selectedKey) ?? visible[0];
  const total = rows.reduce((sum, row) => sum + row.payout, 0);
  return <>
    <div className="ar-summary">
      <div><span>Report payout</span><strong>{formatCurrency(total)}</strong></div>
      <div><span>Payees</span><strong>{rows.length}</strong></div>
      <div><span>Shoots across payees</span><strong>{rows.reduce((sum, row) => sum + row.shoot_count, 0)}</strong></div>
      <div><span>Average per payee</span><strong>{formatCurrency(rows.length ? total / rows.length : 0)}</strong></div>
    </div>
    <div className="ar-report-grid">
      <section className="ar-queue" aria-label="Payout report payees">
        <div className="ar-queue-controls">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Payout breakdown</h3><span className="text-xs text-muted-foreground">{filtered.length} payees</span></div>
          <Input aria-label="Search report payees" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); setSelectedKey(''); }} placeholder="Search name or email" className="h-9" />
        </div>
        <div className="ar-queue-list ar-table-scroll"><table className="ar-table ar-report-table">
          <thead><tr><th>Payee</th><th>Shoots</th><th>Basis</th><th className="text-right">Payout</th></tr></thead>
          <tbody>{visible.map((row) => <tr key={row.key} className={selected?.key === row.key ? 'bg-primary/5' : ''}>
            <td><button className="text-left font-medium hover:text-primary" onClick={() => setSelectedKey(row.key)} aria-pressed={selected?.key === row.key}>{row.name}</button><p className="mt-1 text-[11px] text-muted-foreground">{groupLabel[row.group]}</p></td>
            <td>{row.shoot_count}</td>
            <td className="text-muted-foreground">{row.group === 'salesRep' ? (row.commission_rate == null ? 'Rate not recorded' : `${row.commission_rate}% commission`) : row.group === 'editor' ? `${row.service_count || 0} services` : `${formatCurrency(row.average_value)} / shoot`}</td>
            <td className="text-right font-semibold">{formatCurrency(row.payout)}</td>
          </tr>)}</tbody>
        </table>{!filtered.length && <p className="ar-empty px-4">No payees match this report and search.</p>}</div>
        <footer className="ar-pagination">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Rows<select className="ar-select" aria-label="Report rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[6, 12, 24].map((size) => <option key={size}>{size}</option>)}</select></label>
          <span className="text-xs text-muted-foreground">{currentPage} / {pages}</span>
          <div className="flex gap-1"><Button variant="outline" size="sm" aria-label="Previous report page" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedKey(''); }}>‹</Button><Button variant="outline" size="sm" aria-label="Next report page" disabled={currentPage === pages} onClick={() => { setPage(currentPage + 1); setSelectedKey(''); }}>›</Button></div>
        </footer>
      </section>
      <aside className="ar-detail ar-report-payee" aria-label="Selected payee payout">
        {selected ? <>
          <header className="ar-detail-header"><div className="min-w-0"><p className="text-xs text-muted-foreground">{groupLabel[selected.group]}</p><h3 className="mt-1 font-semibold">{selected.name}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{selected.email}</p></div></header>
          <div className="space-y-5 overflow-auto p-5">
            <div><p className="text-xs text-muted-foreground">Payout in this report</p><p className="mt-1 text-3xl font-semibold">{formatCurrency(selected.payout)}</p></div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Shoots</dt><dd>{selected.shoot_count}</dd></div>
              {selected.group === 'editor' && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Services</dt><dd>{selected.service_count || 0}</dd></div>}
              {selected.group === 'photographer' && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Average per shoot</dt><dd>{formatCurrency(selected.average_value)}</dd></div>}
              {selected.group === 'salesRep' && <><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Gross total</dt><dd>{formatCurrency(selected.gross_total)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Commission rate</dt><dd>{selected.commission_rate == null ? 'Not recorded' : `${selected.commission_rate}%`}</dd></div></>}
              {selected.paid_amount != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Paid</dt><dd>{formatCurrency(selected.paid_amount)}</dd></div>}
              {selected.unpaid_amount != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Unpaid</dt><dd>{formatCurrency(selected.unpaid_amount)}</dd></div>}
            </dl>
            <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">Report amounts come from the selected billing weeks. Record approvals and payments through the invoice workflow.</p>
          </div>
        </> : <p className="ar-empty p-5">Select a payee to inspect the payout breakdown.</p>}
      </aside>
    </div>
  </>;
}

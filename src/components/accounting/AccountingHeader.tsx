import React from 'react';
import { Plus, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SegmentedDays } from './OverviewCards';

type AccountingTab = 'home' | 'photographers' | 'equipments' | 'editors' | 'sales-reps';

interface AccountingHeaderProps {
  onCreateInvoice: () => void;
  onCreateBatch?: () => void;
  title?: string;
  description?: string;
  badge?: string;
  showCreateButton?: boolean;
  activeTab?: AccountingTab;
  onTabChange?: (tab: AccountingTab) => void;
  showTabs?: boolean;
  daysWindow?: number;
  onDaysWindowChange?: (v: number) => void;
  onExport?: (format: 'csv' | 'excel' | 'pdf') => void;
  reportingControl?: React.ReactNode;
  payoutActions?: {
    refresh: () => void;
    download: () => Promise<void>;
    loading: boolean;
    downloading: boolean;
  } | null;
}

export function AccountingHeader({
  onCreateInvoice, onCreateBatch, title = 'Accounting', description = 'Manage your finances, invoices, and payments',
  showCreateButton = true, activeTab = 'home', onTabChange, showTabs = false,
  daysWindow, onDaysWindowChange, onExport, payoutActions, reportingControl,
}: AccountingHeaderProps) {
  const showPayout = activeTab === 'photographers' && payoutActions;
  const tabs: { id: AccountingTab; label: string }[] = [
    { id: 'home', label: 'Home' }, { id: 'photographers', label: 'Photographers' },
    { id: 'editors', label: 'Editors' }, { id: 'sales-reps', label: 'Sales reps' },
    { id: 'equipments', label: 'Equipment' },
  ];
  return <header className="accounting-header space-y-5 max-md:contents">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">
        {reportingControl}
        {!reportingControl && activeTab === 'home' && daysWindow != null && onDaysWindowChange && <div className="space-y-1"><p className="text-xs text-muted-foreground">Reporting period</p><SegmentedDays value={daysWindow} onChange={onDaysWindowChange} /></div>}
        {showPayout && <><Button variant="outline" size="sm" onClick={showPayout.refresh} disabled={showPayout.loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" size="sm" onClick={showPayout.download} disabled={showPayout.downloading}><Download className="mr-2 h-4 w-4" />Download CSV</Button></>}
        {onExport && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{(['csv', 'excel', 'pdf'] as const).map(value => <DropdownMenuItem key={value} onClick={() => onExport(value)}>{value.toUpperCase()}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
        {showCreateButton && <Button size="sm" onClick={onCreateInvoice}><Plus className="mr-2 h-4 w-4" />Create invoice</Button>}
        {showCreateButton && onCreateBatch && <Button size="sm" variant="outline" onClick={onCreateBatch}>Batch invoices</Button>}
      </div>
    </div>
    {showTabs && onTabChange && <nav aria-label="Accounting sections" className="mobile-sticky-tabs flex gap-1 overflow-x-auto border-b pb-2 [scrollbar-width:thin]">{tabs.map(tab => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => onTabChange(tab.id)} className={`shrink-0 rounded-md px-3 py-2 text-sm transition-colors ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{tab.label}</button>)}</nav>}
  </header>;
}
export type { AccountingTab };

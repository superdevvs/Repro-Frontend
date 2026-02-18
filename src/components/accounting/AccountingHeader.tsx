
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { PlusIcon, Download, UsersIcon, BarChart3Icon, RefreshCw, Loader2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AccountingTab = 'home' | 'photographers';

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
  payoutActions?: {
    refresh: () => void;
    download: () => Promise<void>;
    loading: boolean;
    downloading: boolean;
  } | null;
}

export function AccountingHeader({ 
  onCreateInvoice, 
  onCreateBatch,
  title = "Accounting",
  description = "Manage your finances, invoices, and payments",
  badge = "Accounting",
  showCreateButton = true,
  activeTab = 'home',
  onTabChange,
  showTabs = false,
  payoutActions,
}: AccountingHeaderProps) {
  const showPayoutActions = activeTab === 'photographers' && Boolean(payoutActions);
  const showActionControls = showCreateButton || showPayoutActions;

  return (
    <div className="space-y-3">
      <PageHeader
        badge={badge}
        title={title}
        description={description}
        icon={BarChart3Icon}
        action={
          showActionControls ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-3">
                {showPayoutActions && payoutActions && (
                  <>
                    <Button variant="outline" className="gap-2" onClick={payoutActions.refresh} disabled={payoutActions.loading}>
                      <RefreshCw className={`h-4 w-4 ${payoutActions.loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={payoutActions.download} disabled={payoutActions.downloading}>
                      {payoutActions.downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Download CSV
                    </Button>
                  </>
                )}

                {showCreateButton && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem>
                          <span>CSV</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <span>Excel</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <span>PDF</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="gap-2">
                          <PlusIcon className="h-4 w-4" />
                          Create Invoice
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={onCreateInvoice}>
                          <PlusIcon className="h-4 w-4 mr-2" />
                          <span>Single Invoice</span>
                        </DropdownMenuItem>
                        {onCreateBatch && (
                          <DropdownMenuItem onClick={onCreateBatch}>
                            <UsersIcon className="h-4 w-4 mr-2" />
                            <span>Batch Invoices</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>

              <div className="flex sm:hidden items-center gap-2">
                {showCreateButton && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-9 gap-1.5 px-3">
                        <PlusIcon className="h-4 w-4" />
                        New
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Create</DropdownMenuLabel>
                      <DropdownMenuItem onClick={onCreateInvoice}>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        <span>Single Invoice</span>
                      </DropdownMenuItem>
                      {onCreateBatch && (
                        <DropdownMenuItem onClick={onCreateBatch}>
                          <UsersIcon className="h-4 w-4 mr-2" />
                          <span>Batch Invoices</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      title="Accounting actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {showPayoutActions && payoutActions && (
                      <>
                        <DropdownMenuLabel>Photographer Reports</DropdownMenuLabel>
                        <DropdownMenuItem onClick={payoutActions.refresh} disabled={payoutActions.loading}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${payoutActions.loading ? 'animate-spin' : ''}`} />
                          Refresh
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={payoutActions.download} disabled={payoutActions.downloading}>
                          {payoutActions.downloading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download CSV
                        </DropdownMenuItem>
                        {showCreateButton && <DropdownMenuSeparator />}
                      </>
                    )}

                    {showCreateButton && (
                      <>
                        <DropdownMenuLabel>Export</DropdownMenuLabel>
                        <DropdownMenuItem>
                          <span>CSV</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <span>Excel</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <span>PDF</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : undefined
        }
      />

      {showTabs && onTabChange && (
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-max items-center rounded-lg border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => onTabChange('home')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'home'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onTabChange('photographers')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'photographers'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Photographers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { AccountingTab };

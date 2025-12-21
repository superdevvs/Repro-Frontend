
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { PlusIcon, Download, UsersIcon, BarChart3Icon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountingHeaderProps {
  onCreateInvoice: () => void;
  onCreateBatch?: () => void;
  title?: string;
  description?: string;
  badge?: string;
  showCreateButton?: boolean;
}

export function AccountingHeader({ 
  onCreateInvoice, 
  onCreateBatch,
  title = "Accounting",
  description = "Manage your finances, invoices, and payments",
  badge = "Accounting",
  showCreateButton = true,
}: AccountingHeaderProps) {
  return (
    <PageHeader
      badge={badge}
      title={title}
      description={description}
      icon={BarChart3Icon}
      action={
        showCreateButton ? (
          <div className="flex items-center gap-3">
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
          </div>
        ) : undefined
      }
    />
  );
}

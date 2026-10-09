import { PhotographerInvoiceReviewWorkspace } from '@/components/accounting/PhotographerInvoiceReviewWorkspace';
import type { AccountingDateRange } from './accountingDateRange';

export function SalesRepInvoiceReviewWorkspace({ reportingRange }: { reportingRange?: AccountingDateRange } = {}) {
  return (
    <PhotographerInvoiceReviewWorkspace
      reportingRange={reportingRange}
      role="salesRep"
      title="Sales Rep Review"
      shortLabel="Sales Rep"
      pluralLabel="Sales Reps"
    />
  );
}

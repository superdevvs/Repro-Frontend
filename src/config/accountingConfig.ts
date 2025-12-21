import { Role } from '@/components/auth';

export type AccountingMode = 'admin' | 'photographer' | 'editor' | 'client' | 'rep';

export interface AccountingConfig {
  mode: AccountingMode;
  pageTitle: string;
  sidebarLabel: string;
  showOverviewCards: boolean;
  showRevenueChart: boolean;
  showExpenseCenter: boolean;
  showPaymentsSummary: boolean;
  showLatestTransactions: boolean;
  showInvoiceTable: boolean;
  overviewCardConfig?: {
    cards: Array<{
      title: string;
      metric: string;
      color: 'blue' | 'emerald' | 'amber' | 'rose';
      icon: string;
    }>;
  };
  chartConfig?: {
    title: string;
    series: string[];
  };
  tableConfig?: {
    title: string;
    columns: string[];
    showTabs: boolean;
  };
}

export const accountingConfigs: Record<AccountingMode, AccountingConfig> = {
  admin: {
    mode: 'admin',
    pageTitle: 'Accounting',
    sidebarLabel: 'Accounting',
    showOverviewCards: true,
    showRevenueChart: true,
    showExpenseCenter: true,
    showPaymentsSummary: true,
    showLatestTransactions: true,
    showInvoiceTable: true,
    overviewCardConfig: {
      cards: [
        { title: 'Total Revenue', metric: 'totalRevenue', color: 'blue', icon: 'DollarSign' },
        { title: 'Outstanding Invoices', metric: 'outstanding', color: 'amber', icon: 'CreditCard' },
        { title: 'Paid', metric: 'paid', color: 'emerald', icon: 'CheckCircle' },
      ],
    },
    chartConfig: {
      title: 'Revenue Overview',
      series: ['revenue', 'expenses', 'profit'],
    },
    tableConfig: {
      title: 'All Invoices',
      columns: ['invoice', 'client', 'amount', 'status', 'date', 'actions'],
      showTabs: true,
    },
  },
  photographer: {
    mode: 'photographer',
    pageTitle: 'Earnings',
    sidebarLabel: 'Earnings',
    showOverviewCards: true,
    showRevenueChart: true,
    showExpenseCenter: false,
    showPaymentsSummary: false,
    showLatestTransactions: false,
    showInvoiceTable: true,
    overviewCardConfig: {
      cards: [
        { title: 'Total Earnings (This Month)', metric: 'totalEarnings', color: 'blue', icon: 'DollarSign' },
        { title: 'Pending Payouts', metric: 'pendingPayouts', color: 'amber', icon: 'Clock' },
        { title: 'Shoots Completed (This Month)', metric: 'shootsCompleted', color: 'emerald', icon: 'Camera' },
        { title: 'Average Shoot Value', metric: 'avgShootValue', color: 'blue', icon: 'TrendingUp' },
      ],
    },
    chartConfig: {
      title: 'Earnings Overview',
      series: ['earnings', 'shootCount'],
    },
    tableConfig: {
      title: 'My Shoots & Earnings',
      columns: ['shootId', 'client', 'property', 'status', 'fee', 'shootDate', 'payoutDate', 'actions'],
      showTabs: false,
    },
  },
  editor: {
    mode: 'editor',
    pageTitle: 'My Pay',
    sidebarLabel: 'My Pay',
    showOverviewCards: true,
    showRevenueChart: true,
    showExpenseCenter: false,
    showPaymentsSummary: false,
    showLatestTransactions: false,
    showInvoiceTable: true,
    overviewCardConfig: {
      cards: [
        { title: 'Total Editing Earnings (This Month)', metric: 'totalEarnings', color: 'blue', icon: 'DollarSign' },
        { title: 'Pending Editing Payouts', metric: 'pendingPayouts', color: 'amber', icon: 'Clock' },
        { title: 'Edits Completed', metric: 'editsCompleted', color: 'emerald', icon: 'CheckCircle' },
        { title: 'Average Pay per Job', metric: 'avgPayPerJob', color: 'blue', icon: 'TrendingUp' },
      ],
    },
    chartConfig: {
      title: 'Editing Earnings Overview',
      series: ['earnings', 'jobCount'],
    },
    tableConfig: {
      title: 'Editing Jobs',
      columns: ['jobId', 'shootId', 'client', 'type', 'status', 'pay', 'assignedDate', 'completedDate', 'payoutStatus', 'actions'],
      showTabs: false,
    },
  },
  client: {
    mode: 'client',
    pageTitle: 'Billing',
    sidebarLabel: 'Billing',
    showOverviewCards: true,
    showRevenueChart: true,
    showExpenseCenter: false,
    showPaymentsSummary: true,
    showLatestTransactions: true,
    showInvoiceTable: true,
    overviewCardConfig: {
      cards: [
        { title: 'Outstanding Balance', metric: 'outstandingBalance', color: 'amber', icon: 'CreditCard' },
        { title: 'Paid (Last 30 Days)', metric: 'paidLast30Days', color: 'emerald', icon: 'CheckCircle' },
        { title: 'Total Spend (This Year)', metric: 'totalSpend', color: 'blue', icon: 'DollarSign' },
        { title: 'Upcoming Charges', metric: 'upcomingCharges', color: 'rose', icon: 'Calendar' },
      ],
    },
    chartConfig: {
      title: 'Spending Overview',
      series: ['amountBilled', 'amountPaid'],
    },
    tableConfig: {
      title: 'My Invoices',
      columns: ['invoice', 'property', 'status', 'amount', 'dueDate', 'actions'],
      showTabs: true,
    },
  },
  rep: {
    mode: 'rep',
    pageTitle: 'Sales',
    sidebarLabel: 'Sales',
    showOverviewCards: true,
    showRevenueChart: true,
    showExpenseCenter: false,
    showPaymentsSummary: false,
    showLatestTransactions: false,
    showInvoiceTable: true,
    overviewCardConfig: {
      cards: [
        { title: 'Total Revenue (This Month - My Clients)', metric: 'totalRevenue', color: 'blue', icon: 'DollarSign' },
        { title: 'Outstanding Invoices (My Clients)', metric: 'outstanding', color: 'amber', icon: 'CreditCard' },
        { title: 'Commission (This Month)', metric: 'commission', color: 'emerald', icon: 'TrendingUp' },
        { title: 'New Clients (This Month)', metric: 'newClients', color: 'blue', icon: 'Users' },
      ],
    },
    chartConfig: {
      title: 'Sales Overview',
      series: ['revenue', 'commission'],
    },
    tableConfig: {
      title: 'My Client Invoices',
      columns: ['invoice', 'client', 'amount', 'status', 'date', 'commission', 'actions'],
      showTabs: true,
    },
  },
};

export function getAccountingMode(role: Role | string | undefined): AccountingMode {
  if (!role) return 'client';
  
  const roleLower = role.toLowerCase();
  
  if (roleLower === 'admin' || roleLower === 'superadmin') {
    return 'admin';
  }
  if (roleLower === 'photographer' || roleLower === 'photo') {
    return 'photographer';
  }
  if (roleLower === 'editor' || roleLower === 'editing') {
    return 'editor';
  }
  if (roleLower === 'client' || roleLower === 'customer') {
    return 'client';
  }
  if (roleLower === 'rep' || roleLower === 'salesrep' || roleLower === 'sales_rep' || roleLower === 'sales-rep') {
    return 'rep';
  }
  
  return 'client'; // default fallback
}



import { endOfDay, startOfDay, subDays } from 'date-fns';
import type { ClientBillingItem } from '@/types/clientBilling';
import { parseInvoiceDateInput, resolveInvoiceDateFilterRange } from '@/utils/invoiceDateFilters';

export const clientBillingCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const clientBillingPaidValue = (item: ClientBillingItem) => item.amountPaid > 0 ? item.amountPaid : item.amount;
export const clientBillingDate = (item: ClientBillingItem) => parseInvoiceDateInput(item.paidAt || item.issueDate || item.dueDate);

export function getClientBillingPaidMetrics(
  items: ClientBillingItem[],
  range?: { startDate: string; endDate: string },
  daysWindow = 30,
  now = new Date(),
) {
  const { start, end } = range
    ? resolveInvoiceDateFilterRange({ preset: 'custom', customRange: range }, now)
    : { start: startOfDay(subDays(now, Math.max(1, daysWindow) - 1)), end: endOfDay(now) };
  const paidItems = items.filter((item) => item.bucket === 'paid');
  const inRange = paidItems.filter((item) => {
    const date = clientBillingDate(item);
    return date && (!start || date >= start) && (!end || date <= end);
  });
  return {
    paidInRange: inRange.reduce((sum, item) => sum + clientBillingPaidValue(item), 0),
    paidCount: inRange.length,
    annualSpend: paidItems.reduce((sum, item) => {
      const date = clientBillingDate(item);
      return sum + (date?.getFullYear() === now.getFullYear() ? clientBillingPaidValue(item) : 0);
    }, 0),
  };
}

export function getClientBillingChartData(items: ClientBillingItem[], year = new Date().getFullYear()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = months.map((month) => ({ month, 'Amount billed': 0, 'Amount paid': 0 }));
  items.forEach((item) => {
    const billedDate = parseInvoiceDateInput(item.issueDate || item.dueDate);
    if (billedDate?.getFullYear() === year) data[billedDate.getMonth()]['Amount billed'] += item.amount;
    const paidDate = clientBillingDate(item);
    if (item.bucket === 'paid' && paidDate?.getFullYear() === year) {
      data[paidDate.getMonth()]['Amount paid'] += clientBillingPaidValue(item);
    }
  });
  return data;
}

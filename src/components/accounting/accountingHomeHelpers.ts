import type {AccountingHomeData} from '@/services/accountingHomeService';
import {useEffect,useState,type ReactNode} from 'react';
import {exportRowsAsCsv as writeCsv} from '@/utils/accountingExports';
import type {InvoiceData} from '@/types/invoice';
import type {AccountingTab} from './AccountingHeader';
export const exportRowsAsCsv = (rows: Record<string, unknown>[], name: string) =>
  writeCsv(
    name,
    Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key.replaceAll("_", " ") })),
    rows,
  );
export const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const day = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
export function useReducedMotion() {
  const [reduced, set] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => set(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
export const workspaceTabs = [
  "Client invoices",
  "Cash movement & reports",
  "Expenses",
] as const;
export type HomeWorkspaceTarget = (typeof workspaceTabs)[number] | "Recipient payouts" | "Sales rep payouts" | "Editor earnings" | "Equipment";
export interface Props {
  start: string;
  end: string;
  invoices: ReactNode;
  onView: (i: InvoiceData) => void;
  onFilterInvoices: (status?: string) => void;
  onNavigateTab: (tab: AccountingTab) => void;
  canCreateExpense: boolean;
}

export const buildAccountingReport = (d: AccountingHomeData,report:string): Record<string, string | number>[] =>
    report === "Cash movement"
      ? d.ledger.map((r) => ({ ...r, amount: r.category === "client" ? r.amount : -r.amount }))
      : report === "Client aging"
        ? Object.entries(d.aging).map(([aging, balance]) => ({ aging, balance, issue_date_start: d.start, issue_date_end: d.end, balance_as_of: d.end }))
        : report === "Recipient payouts"
          ? Object.entries(d.recipients).map(([recipient, r]) => ({
              recipient,
              paid_in_period: r.paid,
              unpaid_at_period_end: r.unpaid,
              awaiting_review: r.review,
              earning_period_start: d.start,
              earning_period_end: d.end,
            }))
          : report === "Equipment expenses"
            ? d.expenses
                .filter((r) => r.linked === "photographer_equipment")
                .map((r) => ({ ...r, receipt: String(r.receipt), reimbursable: String(r.reimbursable) }))
            : report === "Reimbursements"
              ? d.expenses
                  .filter((r) => r.reimbursable)
                  .map((r) => ({ ...r, receipt: String(r.receipt), reimbursable: String(r.reimbursable) }))
              : report === "Financial exceptions"
                ? d.expenses.filter((r) => !r.receipt).map((r) => ({ id: r.id, name: r.name, issue: "Receipt missing", amount: r.amount }))
                : d.expenses.map((r) => ({ ...r, receipt: String(r.receipt), reimbursable: String(r.reimbursable) }));

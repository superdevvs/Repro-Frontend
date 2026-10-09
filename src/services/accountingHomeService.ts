import { apiClient } from "@/services/api";
export interface HomeLedgerRow {
  id: string;
  invoice_id: number | null;
  name: string;
  category: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
}
export interface HomeService {
  name: string;
  sales: number;
  prior: number;
  units: number;
  orders: number;
  invoice_ids: number[];
}
export interface HomeExpense {
  id: number;
  name: string;
  category: string;
  amount: number;
  date: string;
  status: string;
  receipt: boolean;
  receipt_url: string | null;
  linked: string | null;
  reimbursable: boolean;
}
export interface HomeSubscription {
  id: number;
  name: string;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  interval: string;
  end: string | null;
  attention: boolean;
}
export interface AccountingHomeData {
  start: string;
  end: string;
  snapshot_at: string;
  received: number;
  prior_received: number;
  paid: number;
  open: number;
  collected: number;
  accounts: number;
  open_count: number;
  aging: Record<string, number>;
  recipients: Record<string, { paid: number; unpaid: number; review: number }>;
  daily: { date: string; received: number; paid: number }[];
  ledger: HomeLedgerRow[];
  attention: { id: number; name: string; label: string; amount: number }[];
  methods: Record<string, number>;
  services: HomeService[];
  expenses: HomeExpense[];
  equipment: { pending: number; linked: number };
  subscriptions: HomeSubscription[];
  cash_basis_note: string;
}
export async function fetchAccountingHome(start: string, end: string, signal?: AbortSignal): Promise<AccountingHomeData> {
  return (await apiClient.get<{ data: AccountingHomeData }>("/admin/accounting-home", { params: { start, end }, signal })).data.data;
}
export async function sendComposedInvoice(id: string, input: { operation_key: string; subject: string; message: string }) {
  return (await apiClient.post<{ accepted: boolean; message: string }>("/admin/accounting-home/invoices/" + id + "/send", input)).data;
}

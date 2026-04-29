import { apiClient } from "@/services/api";

export type AccountingExpenseStatus = "unreviewed" | "reviewed" | "approved";

export type AccountingExpense = {
  id: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  vendor?: string | null;
  status: AccountingExpenseStatus;
  reimbursable: boolean;
  notes?: string | null;
  tags: string[];
  related_type?: string | null;
  related_id?: number | null;
  source_label?: string;
  has_receipt: boolean;
  receipt_original_name?: string | null;
  receipt_mime_type?: string | null;
  receipt_size?: number | null;
  receipt_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AccountingExpensePayload = {
  vendor?: string;
  category?: string;
  description: string;
  amount: number | string;
  expense_date: string;
  status?: AccountingExpenseStatus;
  reimbursable?: boolean;
  notes?: string;
  tags?: string[];
  related_type?: string;
  related_id?: number;
  receipt?: File | null;
};

const multipartConfig = {
  headers: { "Content-Type": "multipart/form-data" },
};

const toFormData = (payload: AccountingExpensePayload) => {
  const formData = new FormData();
  formData.append("description", payload.description);
  formData.append("amount", String(payload.amount));
  formData.append("expense_date", payload.expense_date);
  formData.append("category", payload.category || "General");
  if (payload.vendor) formData.append("vendor", payload.vendor);
  if (payload.status) formData.append("status", payload.status);
  formData.append("reimbursable", payload.reimbursable ? "1" : "0");
  if (payload.notes) formData.append("notes", payload.notes);
  if (payload.tags) formData.append("tags", JSON.stringify(payload.tags));
  if (payload.related_type) formData.append("related_type", payload.related_type);
  if (payload.related_id) formData.append("related_id", String(payload.related_id));
  if (payload.receipt) formData.append("receipt", payload.receipt);
  return formData;
};

export const listAccountingExpenses = async (filters?: {
  category?: string;
  status?: string;
  search?: string;
  related_type?: string;
  date_from?: string;
  date_to?: string;
}) => {
  const response = await apiClient.get<{ data: AccountingExpense[] }>("/admin/accounting-expenses", {
    params: filters,
  });
  return response.data.data;
};

export const createAccountingExpense = async (payload: AccountingExpensePayload) => {
  const response = await apiClient.post<{ data: AccountingExpense }>(
    "/admin/accounting-expenses",
    toFormData(payload),
    multipartConfig,
  );
  return response.data.data;
};

export const updateAccountingExpense = async (expenseId: number, payload: AccountingExpensePayload) => {
  const formData = toFormData(payload);
  formData.append("_method", "PUT");
  const response = await apiClient.post<{ data: AccountingExpense }>(
    `/admin/accounting-expenses/${expenseId}`,
    formData,
    multipartConfig,
  );
  return response.data.data;
};

export const deleteAccountingExpense = async (expenseId: number) => {
  await apiClient.delete(`/admin/accounting-expenses/${expenseId}`);
};

export const openAccountingExpenseReceipt = async (expense: AccountingExpense) => {
  if (!expense.receipt_url) return;
  const response = await apiClient.get(expense.receipt_url.replace(/^\/api/, ""), { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

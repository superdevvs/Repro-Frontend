import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Loader2, Plus, ReceiptText, Trash2, XCircle } from 'lucide-react';

import { Logo } from '@/components/layout/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  WeeklyInvoice,
  WeeklyInvoiceItem,
  addWeeklyInvoiceCharge,
  addWeeklyInvoiceExpense,
  removeWeeklyInvoiceCharge,
  removeWeeklyInvoiceExpense,
  updateWeeklyInvoiceItem,
} from '@/services/invoiceService';

const COMPANY_NAME = 'REPRO Photos';
const COMPANY_PHONE = '(202) 868-1663';
const COMPANY_EMAIL = 'contact@reprophotos.com';
const COMPANY_ADDRESS = import.meta.env.VITE_COMPANY_ADDRESS?.trim() || '';
const COMPANY_ADDRESS_LINES = COMPANY_ADDRESS
  ? COMPANY_ADDRESS.split('|').map((line) => line.trim()).filter(Boolean)
  : [];

export type InvoiceApprovalMode = 'photographer' | 'admin';

export interface InvoiceApprovalShootRef {
  id?: number | string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  scheduled_date?: string | null;
  completed_at?: string | null;
}

export interface InvoiceApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: WeeklyInvoice | null;
  mode: InvoiceApprovalMode;
  /** Resolve a shoot reference for an item (for the "Date & Address of Shoot" column). */
  resolveShoot?: (item: WeeklyInvoiceItem) => InvoiceApprovalShootRef | null | undefined;
  /** Override the displayed amount for a charge item (e.g. photographer pay vs client-billed). */
  getDisplayAmount?: (item: WeeklyInvoiceItem) => number;
  /** Photographer-side actions */
  onPhotographerApprove?: (notes: string) => Promise<void> | void;
  onPhotographerReject?: (reason: string) => Promise<void> | void;
  /** Admin-side actions */
  onAdminApprove?: (warningOverrideReason?: string) => Promise<void> | void;
  onAdminReject?: (reason: string) => Promise<void> | void;
  /** Called whenever the invoice content changes via inline edits so the parent list/totals refresh. */
  onInvoiceChange?: (invoice: WeeklyInvoice) => void;
}

type DraftItem = {
  description: string;
  amount: string;
  quantity: string;
};

const blankDraft: DraftItem = { description: '', amount: '', quantity: '1' };

const formatCurrency = (value: number | string | null | undefined) => {
  const num = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(num) ? num : 0,
  );
};

const formatShortDate = (value?: string | null) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'M/d/yy');
  } catch {
    return '';
  }
};

const formatLongDate = (value?: string | null) => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
};

const formatBillingPeriod = (start?: string, end?: string) => {
  if (!start && !end) return 'N/A';
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const sameDay =
    startDate && endDate &&
    Math.abs(endDate.getTime() - startDate.getTime()) < 1000 * 60 * 60 * 24;

  let weekStart = startDate;
  let weekEnd = endDate;
  if (sameDay && startDate) {
    const dayOfWeek = startDate.getDay();
    weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - dayOfWeek);
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
  }

  if (!weekStart || !weekEnd) return formatLongDate(start || end);
  return `${formatLongDate(weekStart.toISOString())} – ${formatLongDate(weekEnd.toISOString())}`;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending Your Review',
    className: 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200',
  },
  pending_approval: {
    label: 'Awaiting Admin Approval',
    className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200',
  },
  approved: {
    label: 'Approved',
    className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  accounts_approved: {
    label: 'Approved',
    className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  rejected: {
    label: 'Returned for Changes',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

const formatShootAddress = (shoot?: InvoiceApprovalShootRef | null) => {
  if (!shoot) return '';
  const parts = [
    shoot.address,
    shoot.city,
    [shoot.state, shoot.zip].filter(Boolean).join(' '),
  ].filter(Boolean);
  return parts.join(', ');
};

const getShootDate = (shoot?: InvoiceApprovalShootRef | null) =>
  shoot?.scheduled_date || shoot?.completed_at || null;

export function InvoiceApprovalDialog({
  isOpen,
  onClose,
  invoice,
  mode,
  resolveShoot,
  getDisplayAmount,
  onPhotographerApprove,
  onPhotographerReject,
  onAdminApprove,
  onAdminReject,
  onInvoiceChange,
}: InvoiceApprovalDialogProps) {
  const { toast } = useToast();
  const [currentInvoice, setCurrentInvoice] = useState<WeeklyInvoice | null>(invoice);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DraftItem>(blankDraft);
  const [chargeDraft, setChargeDraft] = useState<DraftItem>(blankDraft);
  const [expenseDraft, setExpenseDraft] = useState<DraftItem>(blankDraft);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [warningOverrideReason, setWarningOverrideReason] = useState('');
  const [busyAction, setBusyAction] = useState<'approve' | 'reject' | 'edit' | null>(null);

  useEffect(() => {
    setCurrentInvoice(invoice);
    setEditingItemId(null);
    setEditDraft(blankDraft);
    setChargeDraft(blankDraft);
    setExpenseDraft(blankDraft);
    setShowAddCharge(false);
    setShowAddExpense(false);
    setNotes(invoice?.modification_notes || '');
    setRejectReason('');
    setShowRejectInput(false);
    setWarningOverrideReason('');
  }, [invoice]);

  const status = currentInvoice?.approval_status || 'pending';
  const statusCfg = statusConfig[status] || statusConfig.pending;

  // The photographer can edit only their own invoice while it is pending or rejected (draft state).
  const photographerCanEdit =
    mode === 'photographer' && ['pending', 'rejected'].includes(status);
  const photographerCanReview = photographerCanEdit;
  const adminCanReview = mode === 'admin' && ['pending', 'pending_approval'].includes(status);

  const items = currentInvoice?.items || [];
  const charges = useMemo(() => items.filter((item) => item.type === 'charge'), [items]);
  const expenses = useMemo(() => items.filter((item) => item.type === 'expense'), [items]);
  const resolveAmount = useCallback(
    (item: WeeklyInvoiceItem) => {
      if (getDisplayAmount && item.type === 'charge') {
        return Number(getDisplayAmount(item) ?? 0);
      }
      return Number(item.total_amount ?? 0);
    },
    [getDisplayAmount],
  );
  const subtotal = charges.reduce((sum, item) => sum + resolveAmount(item), 0);
  const otherFees = expenses.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const total = subtotal + otherFees;

  const photographer = currentInvoice?.photographer || currentInvoice?.payee;
  const photographerName = photographer?.name || 'Photographer';
  const photographerEmail = photographer?.email;
  const invoiceNumber = currentInvoice?.id ? `#${currentInvoice.id}` : '';
  const issueDate = currentInvoice?.modified_at || currentInvoice?.created_at;

  const applyInvoiceUpdate = useCallback(
    (next: WeeklyInvoice | undefined | null) => {
      if (!next) return;
      setCurrentInvoice(next);
      onInvoiceChange?.(next);
    },
    [onInvoiceChange],
  );

  const handleStartEdit = (item: WeeklyInvoiceItem) => {
    setEditingItemId(item.id);
    setEditDraft({
      description: item.description || '',
      amount: String(item.unit_amount ?? item.total_amount ?? ''),
      quantity: String(item.quantity ?? 1),
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditDraft(blankDraft);
  };

  const handleSaveEdit = async (item: WeeklyInvoiceItem) => {
    if (!currentInvoice) return;
    const description = editDraft.description.trim();
    const amount = Number(editDraft.amount);
    const quantity = Number(editDraft.quantity || 1);
    if (!description) {
      toast({ title: 'Description required', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }

    setBusyAction('edit');
    try {
      const result = await updateWeeklyInvoiceItem(currentInvoice.id, item.id, 'photographer', {
        description,
        amount,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      });
      applyInvoiceUpdate(result.invoice);
      handleCancelEdit();
      toast({ title: 'Line updated' });
    } catch (error) {
      toast({
        title: 'Failed to update line',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddCharge = async () => {
    if (!currentInvoice) return;
    const description = chargeDraft.description.trim();
    const amount = Number(chargeDraft.amount);
    const quantity = Number(chargeDraft.quantity || 1);
    if (!description || !Number.isFinite(amount) || amount < 0) {
      toast({ title: 'Description and amount are required', variant: 'destructive' });
      return;
    }
    setBusyAction('edit');
    try {
      const result = await addWeeklyInvoiceCharge(currentInvoice.id, 'photographer', {
        description,
        amount,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      });
      applyInvoiceUpdate(result.invoice);
      setChargeDraft(blankDraft);
      setShowAddCharge(false);
      toast({ title: 'Service added' });
    } catch (error) {
      toast({
        title: 'Failed to add service',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemoveCharge = async (item: WeeklyInvoiceItem) => {
    if (!currentInvoice) return;
    setBusyAction('edit');
    try {
      const result = await removeWeeklyInvoiceCharge(currentInvoice.id, item.id, 'photographer');
      applyInvoiceUpdate(result.invoice);
      toast({ title: 'Service removed' });
    } catch (error) {
      toast({
        title: 'Failed to remove service',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddExpense = async () => {
    if (!currentInvoice) return;
    const description = expenseDraft.description.trim();
    const amount = Number(expenseDraft.amount);
    const quantity = Number(expenseDraft.quantity || 1);
    if (!description || !Number.isFinite(amount) || amount < 0) {
      toast({ title: 'Description and amount are required', variant: 'destructive' });
      return;
    }
    setBusyAction('edit');
    try {
      const result = await addWeeklyInvoiceExpense(currentInvoice.id, 'photographer', {
        description,
        amount,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      });
      applyInvoiceUpdate(result.invoice);
      setExpenseDraft(blankDraft);
      setShowAddExpense(false);
      toast({ title: 'Expense added' });
    } catch (error) {
      toast({
        title: 'Failed to add expense',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemoveExpense = async (item: WeeklyInvoiceItem) => {
    if (!currentInvoice) return;
    setBusyAction('edit');
    try {
      const result = await removeWeeklyInvoiceExpense(currentInvoice.id, item.id, 'photographer');
      applyInvoiceUpdate(result.invoice);
      toast({ title: 'Expense removed' });
    } catch (error) {
      toast({
        title: 'Failed to remove expense',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async () => {
    setBusyAction('approve');
    try {
      if (mode === 'photographer') {
        await onPhotographerApprove?.(notes.trim());
      } else {
        await onAdminApprove?.(warningOverrideReason.trim() || undefined);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Reason required', description: 'Add a short note so the other side knows what to change.', variant: 'destructive' });
      return;
    }
    setBusyAction('reject');
    try {
      if (mode === 'photographer') {
        await onPhotographerReject?.(rejectReason.trim());
      } else {
        await onAdminReject?.(rejectReason.trim());
      }
    } finally {
      setBusyAction(null);
    }
  };

  const renderShootCell = (item: WeeklyInvoiceItem) => {
    if (item.type === 'expense') {
      return <span className="text-xs uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Expense</span>;
    }
    const shoot = resolveShoot?.(item) || null;
    const dateLabel = formatShortDate(getShootDate(shoot)) || '';
    const address = formatShootAddress(shoot);
    if (!dateLabel && !address) {
      return <span className="text-sm text-muted-foreground">—</span>;
    }
    return (
      <div className="space-y-0.5">
        {dateLabel ? <p className="text-sm font-medium text-foreground">{dateLabel}</p> : null}
        {address ? <p className="text-xs text-muted-foreground">{address}</p> : null}
      </div>
    );
  };

  if (!currentInvoice) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">Photographer Invoice</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {mode === 'photographer'
                  ? 'Review your weekly payout. Edit lines, then approve or request changes.'
                  : 'Review the photographer-submitted payout and approve or return for changes.'}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={cn('font-medium self-start sm:self-auto', statusCfg.className)}>
              {statusCfg.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8 bg-background">
          {/* Top header: photographer info + INVOICE eyebrow */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 pt-0.5">
                <Logo className="h-9 w-auto" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg leading-tight">{photographerName}</p>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {photographerEmail ? <p>{photographerEmail}</p> : null}
                </div>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs font-semibold tracking-widest text-violet-600 dark:text-violet-400">INVOICE</div>
              {invoiceNumber ? (
                <div>
                  <span className="text-sm font-bold">{invoiceNumber}</span>
                </div>
              ) : null}
              <div>
                <span className="text-sm">{formatLongDate(issueDate)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                For the week of{' '}
                <span className="font-medium text-foreground">
                  {formatBillingPeriod(currentInvoice.billing_period_start, currentInvoice.billing_period_end)}
                </span>
              </p>
            </div>
          </div>

          {/* Bill To: REPRO Photos */}
          <div>
            <h3 className="text-sm font-semibold text-violet-600 dark:text-violet-400 tracking-wider mb-2">BILL TO</h3>
            <div className="space-y-1">
              <p className="font-medium text-base">{COMPANY_NAME}</p>
              {COMPANY_ADDRESS_LINES.length > 0
                ? COMPANY_ADDRESS_LINES.map((line) => (
                    <p key={line} className="text-sm text-muted-foreground">
                      {line}
                    </p>
                  ))
                : null}
              <p className="text-sm text-muted-foreground">{COMPANY_PHONE} · {COMPANY_EMAIL}</p>
            </div>
          </div>

          {/* Items table */}
          <div className="border-t border-b border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 text-xs font-bold text-foreground uppercase tracking-wider w-[34%]">Date &amp; Address of Shoot</th>
                  <th className="text-left py-4 text-xs font-bold text-foreground uppercase tracking-wider">Service</th>
                  <th className="text-right py-4 text-xs font-bold text-foreground uppercase tracking-wider w-24">Rate</th>
                  <th className="text-center py-4 text-xs font-bold text-foreground uppercase tracking-wider w-16">Qty</th>
                  <th className="text-right py-4 text-xs font-bold text-foreground uppercase tracking-wider w-28">Amount</th>
                  {photographerCanEdit ? <th className="w-12" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={photographerCanEdit ? 6 : 5} className="text-center py-8 text-sm text-muted-foreground">
                      No items on this invoice yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isEditing = editingItemId === item.id;
                    const isCharge = item.type === 'charge';
                    const displayAmount = resolveAmount(item);
                    const quantity = item.quantity ?? 1;
                    const displayRate = quantity > 0 ? displayAmount / quantity : displayAmount;
                    return (
                      <tr key={item.id} className="border-b border-border last:border-b-0 align-top">
                        <td className="py-4">{renderShootCell(item)}</td>
                        <td className="py-4">
                          {isEditing ? (
                            <Input
                              value={editDraft.description}
                              onChange={(event) => setEditDraft((draft) => ({ ...draft, description: event.target.value }))}
                              className="h-9"
                            />
                          ) : (
                            <p className="text-sm font-medium text-foreground">{item.description || 'Service'}</p>
                          )}
                        </td>
                        <td className="py-4 text-right text-sm text-muted-foreground">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editDraft.amount}
                              onChange={(event) => setEditDraft((draft) => ({ ...draft, amount: event.target.value }))}
                              className="h-9 text-right"
                            />
                          ) : (
                            formatCurrency(displayRate)
                          )}
                        </td>
                        <td className="py-4 text-center text-sm text-muted-foreground">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={editDraft.quantity}
                              onChange={(event) => setEditDraft((draft) => ({ ...draft, quantity: event.target.value }))}
                              className="h-9 text-center"
                            />
                          ) : (
                            quantity
                          )}
                        </td>
                        <td className="py-4 text-right text-sm font-medium text-foreground">
                          {formatCurrency(displayAmount)}
                        </td>
                        {photographerCanEdit ? (
                          <td className="py-4">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="default"
                                    className="h-8 bg-violet-600 hover:bg-violet-700 text-white"
                                    onClick={() => handleSaveEdit(item)}
                                    disabled={busyAction === 'edit'}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={handleCancelEdit}
                                    disabled={busyAction === 'edit'}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                                    onClick={() => handleStartEdit(item)}
                                    disabled={busyAction === 'edit'}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-destructive hover:bg-destructive/10"
                                    onClick={() => (isCharge ? handleRemoveCharge(item) : handleRemoveExpense(item))}
                                    disabled={busyAction === 'edit'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Add Service / Add Expense controls (photographer edit mode) */}
          {photographerCanEdit ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddCharge((open) => !open);
                    setShowAddExpense(false);
                  }}
                  className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-950/40"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Service
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddExpense((open) => !open);
                    setShowAddCharge(false);
                  }}
                >
                  <ReceiptText className="h-4 w-4 mr-1" />
                  Add Expense
                </Button>
              </div>

              {showAddCharge ? (
                <div className="rounded-md border border-violet-200 dark:border-violet-500/30 bg-violet-50/40 dark:bg-violet-950/20 p-4 grid gap-3 md:grid-cols-[2fr,1fr,1fr,auto]">
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={chargeDraft.description}
                      onChange={(event) => setChargeDraft((draft) => ({ ...draft, description: event.target.value }))}
                      placeholder="e.g. 35 HDR Photos"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={chargeDraft.amount}
                      onChange={(event) => setChargeDraft((draft) => ({ ...draft, amount: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={chargeDraft.quantity}
                      onChange={(event) => setChargeDraft((draft) => ({ ...draft, quantity: event.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handleAddCharge}
                      disabled={busyAction === 'edit'}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      {busyAction === 'edit' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      Add Service
                    </Button>
                  </div>
                </div>
              ) : null}

              {showAddExpense ? (
                <div className="rounded-md border border-border bg-muted/20 p-4 grid gap-3 md:grid-cols-[2fr,1fr,1fr,auto]">
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={expenseDraft.description}
                      onChange={(event) => setExpenseDraft((draft) => ({ ...draft, description: event.target.value }))}
                      placeholder="e.g. Mileage"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenseDraft.amount}
                      onChange={(event) => setExpenseDraft((draft) => ({ ...draft, amount: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={expenseDraft.quantity}
                      onChange={(event) => setExpenseDraft((draft) => ({ ...draft, quantity: event.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddExpense}
                      disabled={busyAction === 'edit'}
                    >
                      {busyAction === 'edit' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      Add Expense
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Summary */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Other Fees / Charges</span>
                <span className="font-medium text-foreground">{formatCurrency(otherFees)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t-2 border-violet-500/60 mt-2">
                <span className="text-foreground">Total</span>
                <span className="text-violet-700 dark:text-violet-300">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Existing rejection / submission notes (read-only context) */}
          {currentInvoice.rejection_reason ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-destructive font-semibold mb-1">
                {mode === 'photographer' ? 'Admin requested changes' : 'Previous return reason'}
              </p>
              <p className="text-sm text-foreground whitespace-pre-line">{currentInvoice.rejection_reason}</p>
            </div>
          ) : null}
          {mode === 'admin' && currentInvoice.modification_notes ? (
            <div className="rounded-md border border-violet-200 dark:border-violet-500/30 bg-violet-50/40 dark:bg-violet-950/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300 font-semibold mb-1">
                Photographer notes
              </p>
              <p className="text-sm text-foreground whitespace-pre-line">{currentInvoice.modification_notes}</p>
            </div>
          ) : null}

          {/* Photographer-side notes input */}
          {photographerCanReview ? (
            <div className="space-y-2">
              <Label htmlFor="invoice-approval-notes" className="text-sm">Notes (optional)</Label>
              <Textarea
                id="invoice-approval-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add an optional note for accounts when approving..."
                rows={3}
              />
            </div>
          ) : null}

          {/* Reject reason input (shared between photographer & admin) */}
          {showRejectInput && (photographerCanReview || adminCanReview) ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <Label htmlFor="invoice-reject-reason" className="text-sm">
                {mode === 'photographer' ? 'What needs to change?' : 'Return reason'}
              </Label>
              <Textarea
                id="invoice-reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder={mode === 'photographer'
                  ? 'Explain what should be corrected before this can be approved...'
                  : 'Explain the correction needed before payout can be approved.'}
                rows={4}
              />
            </div>
          ) : null}
        </div>

        {/* Sticky footer actions */}
        {photographerCanReview || adminCanReview ? (
          <div className="sticky bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => {
                if (showRejectInput) {
                  void handleReject();
                } else {
                  setShowRejectInput(true);
                }
              }}
              disabled={busyAction !== null}
            >
              {busyAction === 'reject' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              {showRejectInput
                ? mode === 'photographer' ? 'Submit Reject' : 'Return for Changes'
                : mode === 'photographer' ? 'Reject with Changes' : 'Return for Changes'}
            </Button>
            <Button
              type="button"
              onClick={handleApprove}
              disabled={busyAction !== null}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {busyAction === 'approve' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {mode === 'photographer' ? 'Approve' : 'Approve Invoice'}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

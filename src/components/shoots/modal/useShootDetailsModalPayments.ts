import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { NavigateFunction } from 'react-router-dom';
import { InvoiceData, InvoiceItem, InvoiceParty, InvoiceShootRef } from '@/utils/invoiceUtils';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { blurActiveElement } from '../dialogFocusUtils';
import type { PaymentDetails } from '@/utils/paymentUtils';

interface ToastApi {
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
  }) => void;
}

interface UseShootDetailsModalPaymentsOptions {
  shoot: ShootData | null;
  queryClient: QueryClient;
  refreshShoot: () => Promise<ShootData | null>;
  formatTime: (value: string) => string;
  navigate: NavigateFunction;
  toast: ToastApi['toast'];
}

type InvoiceResponseLike = {
  id?: string | number;
  number?: string;
  invoice_number?: string | number;
  client?: string | InvoiceParty | null;
  shoot?: InvoiceShootRef | null;
  property?: string;
  issue_date?: string;
  date?: string;
  due_date?: string;
  dueDate?: string;
  total?: number | string;
  amount?: number | string;
  status?: string;
  is_paid?: boolean;
  amount_paid?: number | string;
  services?: string[];
  paymentMethod?: string;
  payment_method?: string;
  paymentDetails?: PaymentDetails;
  payment_details?: PaymentDetails;
  paidAt?: string;
  paid_at?: string;
  items?: InvoiceItem[];
  subtotal?: number | string;
  tax?: number | string;
};

export function useShootDetailsModalPayments({
  shoot,
  queryClient,
  refreshShoot,
  formatTime,
  navigate,
  toast,
}: UseShootDetailsModalPaymentsOptions) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);

  const amountDue = shoot
    ? Math.max((shoot.payment?.totalQuote || 0) - (shoot.payment?.totalPaid || 0), 0)
    : 0;
  const isPaid = amountDue <= 0.01;

  const handleProcessPayment = () => {
    blurActiveElement();
    setIsPaymentDialogOpen(true);
  };

  const handleMarkPaidConfirm = async (payload: MarkAsPaidPayload) => {
    if (!shoot) return;

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const outstandingAmount = Math.max((shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0), 0);
    if (outstandingAmount <= 0.01) {
      toast({ title: 'Already Paid', description: 'This shoot is already fully paid.' });
      return;
    }

    const body: Record<string, unknown> = {
      payment_type: payload.paymentMethod,
      amount: payload.amount && payload.amount > 0 ? payload.amount : outstandingAmount,
    };

    if (payload.paymentDetails) {
      body.payment_details = payload.paymentDetails;
    }
    if (payload.paymentDate) {
      body.payment_date = payload.paymentDate;
    }
    if (payload.shootServiceIds?.length) {
      body.shoot_service_ids = payload.shootServiceIds;
    }
    if (payload.allocationStrategy) {
      body.allocation_strategy = payload.allocationStrategy;
    }

    const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Failed to mark as paid' }));
      throw new Error(errorData.message || errorData.error || 'Failed to mark as paid');
    }

    await refreshShoot();
    queryClient.invalidateQueries({ queryKey: ['shootFiles', String(shoot.id)] });
    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id] });
    toast({
      title: 'Success',
      description: 'Shoot marked as paid successfully.',
    });
  };

  const handlePaymentSuccess = () => {
    toast({
      title: 'Payment Successful',
      description: 'Payment has been processed successfully.',
    });
    refreshShoot();
    if (shoot) {
      queryClient.invalidateQueries({ queryKey: ['shootFiles', String(shoot.id)] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id] });
    }
  };

  const handleShowInvoice = async () => {
    if (!shoot) return;

    setIsLoadingInvoice(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/invoice`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const data = await res.json();
      const invoiceData = (data.data || data) as InvoiceResponseLike;
      const dueDate = invoiceData.due_date || invoiceData.dueDate || new Date().toISOString();
      const isPaid = Boolean(invoiceData.is_paid) || String(invoiceData.status || '').toLowerCase() === 'paid';
      const isOverdue = !isPaid && Boolean(dueDate) && new Date(dueDate) < new Date();
      const normalizedStatus = isPaid ? 'paid' : (isOverdue ? 'overdue' : 'pending');
      const invoice: InvoiceData = {
        id: invoiceData.id?.toString() || '',
        number: String(invoiceData.invoice_number ?? invoiceData.number ?? `Invoice ${invoiceData.id ?? ''}`),
        client: typeof invoiceData.client === 'string'
          ? invoiceData.client
          : invoiceData.client?.name || invoiceData.shoot?.client?.name || 'Unknown Client',
        property: invoiceData.shoot?.location?.fullAddress
          || invoiceData.shoot?.address
          || invoiceData.property
          || 'N/A',
        date: invoiceData.issue_date || invoiceData.date || new Date().toISOString(),
        dueDate,
        amount: Number(invoiceData.total || invoiceData.amount || 0),
        status: normalizedStatus,
        services: invoiceData.items
          ?.map((item: InvoiceItem) => item.description)
          .filter((description): description is string => Boolean(description))
          || invoiceData.services || [],
        paymentMethod: invoiceData.payment_method || invoiceData.paymentMethod || 'N/A',
        paymentDetails: invoiceData.payment_details || invoiceData.paymentDetails || undefined,
        paidAt: invoiceData.paid_at || invoiceData.paidAt || undefined,
        items: invoiceData.items || [],
        subtotal: Number(invoiceData.subtotal || invoiceData.total || invoiceData.amount || 0),
        tax: Number(invoiceData.tax || 0),
        total: Number(invoiceData.total || invoiceData.amount || 0),
      };

      setSelectedInvoice(invoice);
      blurActiveElement();
      setIsInvoiceDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load invoice',
        variant: 'destructive',
      });
      navigate('/accounting');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  return {
    amountDue,
    isPaid,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    isMarkPaidDialogOpen,
    setIsMarkPaidDialogOpen,
    isInvoiceDialogOpen,
    setIsInvoiceDialogOpen,
    selectedInvoice,
    setSelectedInvoice,
    isLoadingInvoice,
    handleProcessPayment,
    handleMarkPaidConfirm,
    handlePaymentSuccess,
    handleShowInvoice,
    formatTime,
  };
}

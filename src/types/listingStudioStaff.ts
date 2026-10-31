import type { StudioAccount, StudioPagination, StudioOrder } from './listingStudioClient';

export interface StudioManagedClient { id: string; name: string; email: string }
export interface StudioManagedAccount extends StudioAccount {
  client: StudioManagedClient;
  management: { canPurchase: boolean; canManageSubscription: boolean; subscription?: StudioSubscriptionSummary };
}
export interface StudioManagedClients { clients: StudioManagedClient[]; pagination: StudioPagination }
export type StudioBillingRequestInput = { kind: 'order_payment'; orderId: string }
  | { kind: 'subscription_purchase' | 'subscription_upgrade'; planCode: string };

export interface StudioBillingRequest {
  id: string; kind: StudioBillingRequestInput['kind']; status: 'pending' | 'processing' | 'completed' | 'expired' | 'cancelled' | 'needs_attention';
  client: StudioManagedClient; actor: { id: string; name: string };
  orderId: string | null; planCode: string | null; amountCents: number | null; currency: 'usd';
  expiresAt: string; createdAt: string; completedAt: string | null; appUrl: string;
  actions: { canEmail: boolean; canCancel: boolean; canConfirm: boolean; canShare: boolean };
  email: { status: 'queued' | 'submitting' | 'sent' | 'needs_attention' | null; lastSentAt: string | null };
}
export interface StudioBillingRequests { requests: StudioBillingRequest[]; pagination: StudioPagination }
export interface StudioBillingReview {
  reviewId: string; confirmationToken: string; amountCents: number; currency: 'usd';
  planCode?: string; currentPlanCode?: string; additionalCreditCents?: number; expiresAt: string;
  periodEnd?: string; prorationDate?: string; monthlyPriceCents?: number; monthlyCreditCents?: number;
}
export interface StudioBillingRequestReview { request: StudioBillingRequest; review: StudioBillingReview | null; url?: string | null; nextAction?: { type: string } }
export interface StudioBillingConfirmation { request: StudioBillingRequest; status: string; nextAction: { type: string }; url?: string | null }

export type StudioSubscriptionActionType = 'schedule_downgrade' | 'cancel_renewal' | 'undo_cancel' | 'undo_downgrade';
export interface StudioSubscriptionActionInput { action: StudioSubscriptionActionType; planCode?: string }
export interface StudioSubscriptionAction { id: string; type: string; status: string; currentPlanCode: string; planCode: string | null; effectiveAt: string | null; errorCode: string | null }
export interface StudioSubscriptionSummary { pendingChange: StudioSubscriptionAction | null; capabilities: { canScheduleDowngrade: boolean; canCancelRenewal: boolean; canUndoCancel: boolean; canUndoDowngrade: boolean } }
export interface StudioSubscriptionActionResult { status: string; action: StudioSubscriptionAction; nextAction: { type: string } }

export interface StudioManagedOrder extends StudioOrder { actions: StudioOrder['actions'] & { canRequestPayment: boolean } }
export interface StudioManagedOrdersPage { orders: StudioManagedOrder[]; pagination: StudioPagination }

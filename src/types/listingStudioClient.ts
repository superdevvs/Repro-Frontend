import type { ListingStudioTrialService } from '@/services/listingStudioTrials';

export type StudioService = ListingStudioTrialService;
export type StudioKind = 'ai_edit' | 'human_revision';
export type StudioFundingMethod = 'credits' | 'card';
export type StudioSource = { kind: 'upload' | 'paid_item' | 'claimed_trial'; id: string };
export type StudioItemStatus = 'awaiting_funding' | 'queued' | 'processing' | 'needs_attention' | 'completed' | 'failed' | 'cancelled';
export type StudioFundingStatus = 'pending' | 'reserved' | 'settled' | 'released' | 'refund_pending' | 'partially_refunded' | 'refunded' | 'failed' | 'expired';
export interface StudioPlan {
  code: 'starter' | 'pro' | 'studio'; name: string; monthlyPriceCents: number;
  monthlyCreditCents: number; revisionDiscountPercent: number;
}
export interface StudioCatalogService {
  id: StudioService; name: string; aiPriceCents: number; aiCreditCents: number;
  revisionBasePriceCents: number; revisionBaseCreditCents: number;
  aiAvailable: boolean; revisionAvailable: boolean; unavailableReason: string | null;
}
export interface StudioCatalog {
  version: string; currency: 'usd'; creditScale: number; services: StudioCatalogService[];
  plans: StudioPlan[]; checkoutAvailable: boolean; dashboardPath: string;
  rules: { creditRollover: false; mixedFunding: false; photosPerAiOrder: number };
  uploadConstraints: { mimeTypes: string[]; maxFileBytes: number; maxPixels: number; maxFiles: number };
  stagingOptions: { rooms: Record<string, string>; styles: Record<string, string>; defaults: { roomType: string; style: string } };
  revisionConstraints: { maxInstructionsLength: number };
}
export interface StudioAccount {
  status: 'ready' | 'billing_attention';
  subscription: { id: string; planCode: string; status: string; periodStart: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  credits: { earnedCents: number; usedCents: number; reservedCents: number; availableCents: number; expiresAt: string | null; rollover: false };
  revisionDiscountPercent: number;
  capabilities: { canCreateOrder: boolean; canUseCredits: boolean; canPayByCard: boolean; canSubscribe: boolean; canManageBilling: boolean };
  notice: string | null;
  trialUsage: { allowancePerService: number; services: { service: StudioService; completed: number; reserved: number; remaining: number }[]; startUrl: string };
}
export interface StudioPricing {
  currency: 'usd'; basePriceCents: number; discountPercent: number; discountCents: number;
  totalPriceCents: number; creditCostCents: number; planCode: string | null; catalogVersion?: string;
}
export interface StudioQuoteInput {
  kind: StudioKind; service: StudioService; source: StudioSource;
  options: { roomType?: string; style?: string }; instructions?: string;
}
export interface StudioQuote extends StudioQuoteInput {
  id: string; expiresAt: string; catalogVersion: string; pricing: StudioPricing;
  fundingOptions: { credits: { available: boolean; shortfallCents: number; reason?: string | null }; card: { available: boolean; reason?: string | null } };
  confirmationRequired: boolean;
}
export interface StudioOrder {
  id: string; createdAt: string; kind: StudioKind; service: StudioService; pricing: StudioPricing;
  funding: { method: StudioFundingMethod; status: StudioFundingStatus; reservedCreditCents: number; capturedCreditCents: number; paidAmountCents: number; refundedAmountCents: number };
  item: {
    id: string; status: StudioItemStatus; progress: number | null;
    source: StudioSource & { originalPreviewAvailable: boolean };
    previewAvailable: boolean; downloadAvailable: boolean; completedAt: string | null;
    error: { code: string; message: string } | null;
    revisionFulfillment: { status: 'queued' | 'assigned' | 'in_progress' | 'delivered' | 'cancelled'; deliveredAt: string | null } | null;
  };
  actions: { canCheckout: boolean; canDownload: boolean; canRequestRevision: boolean; canCancel: boolean };
}
export interface StudioPagination { page: number; perPage: number; total: number; hasMore: boolean }
export interface StudioOrdersPage { orders: StudioOrder[]; pagination: StudioPagination }
export interface StudioTransaction {
  id: string; kind: 'credit_grant' | 'credit_usage' | 'credit_adjustment' | 'credit_refund' | 'card_charge' | 'card_refund';
  status: 'pending' | 'succeeded' | 'failed'; amountCents: number;
  balanceType: 'editing_credit' | 'card'; currency: 'usd'; description: string;
  orderId: string | null; subscriptionId: string | null; createdAt: string; expiresAt: string | null;
}
export interface StudioTransactionsPage { transactions: StudioTransaction[]; pagination: StudioPagination }
export interface StudioUpload { id: string; originalPreviewAvailable: boolean; expiresAt: string }
export interface StudioOrderCreation { order: StudioOrder; created: boolean; nextAction: { type: 'await_processing' | 'checkout' | 'await_payment' | 'none' } }
export interface StudioCheckout { orderId?: string; status?: string; url?: string | null; expiresAt?: string; order?: StudioOrder; nextAction?: { type: string } }

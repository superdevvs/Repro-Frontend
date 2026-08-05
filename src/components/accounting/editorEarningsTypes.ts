import type { EditorEarningsDetail } from '@/services/invoiceService';
import type { DropboxMediaFile } from '@/services/dropboxMediaService';

export type EditorEarningsLineItem = EditorEarningsDetail['line_items'][number];

export type EffectiveEditorEarning = {
  rate: number;
  payout: number;
  isFallback: boolean;
};

export type ResolveEffectiveEditorEarning = (
  item: EditorEarningsLineItem,
) => EffectiveEditorEarning;

export type ShootMediaState = {
  status: 'loading' | 'loaded' | 'error';
  items: DropboxMediaFile[];
};

export type EditorShootActivity = {
  id: string;
  label: string;
  timestamp: string;
  meta?: string;
  actor?: string;
};

export type EditorShootGroup = {
  shootId: number;
  address: string;
  city: string;
  state?: string;
  scheduledDate?: string | null;
  client?: string;
  services: string[];
  totalPayout: number;
  paidPayout: number;
  unpaidPayout: number;
  hasUnpaid: boolean;
  isFullyPaid: boolean;
  latestCompletedAt?: string | null;
  lineItems: EditorEarningsLineItem[];
};

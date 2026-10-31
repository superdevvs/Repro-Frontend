import type { StudioItemStatus, StudioService } from '@/types/listingStudioClient';

export const studioLabels: Record<StudioService, string> = { staging: 'Virtual staging', decluttering: 'Decluttering', grass: 'Green grass', twilight: 'Digital twilight' };
export const studioStatusLabels: Record<StudioItemStatus, string> = { awaiting_funding: 'Awaiting payment', queued: 'Queued', processing: 'Editing your photo', needs_attention: 'Awaiting recovery', completed: 'Ready', failed: 'Edit failed', cancelled: 'Cancelled' };
export const studioMoney = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const studioDate = (date: string | null) => date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)) : '—';
export const studioIsActive = (status: StudioItemStatus) => ['awaiting_funding', 'queued', 'processing', 'needs_attention'].includes(status);

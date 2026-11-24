import type { Quote } from '../../types';

export const QUOTE_TONE: Record<Quote['status'], 'line' | 'amber' | 'blue' | 'green' | 'red' | 'neutral'> = {
  draft: 'line', pending_approval: 'amber', approved: 'blue', sending: 'amber', sent: 'blue', accepted: 'green', declined: 'red', expired: 'neutral',
};
export const QUOTE_LABEL: Record<Quote['status'], string> = { draft: 'Draft', pending_approval: 'Needs approval', approved: 'Approved', sending: 'Confirming delivery', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };
export const quoteTone = (s: Quote['status']) => QUOTE_TONE[s];

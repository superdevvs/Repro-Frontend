import type { Tone } from '../../ui/primitives';

export const CAMPAIGN_STATUS: Record<string, [string, Tone]> = {
  draft: ['Draft', 'line'], submitted: ['Waiting for review', 'amber'], sent_back: ['Sent back', 'red'], approved: ['Approved', 'blue'],
  needs_review: ['Delivery needs review', 'amber'], skipped: ['Skipped', 'neutral'],
  scheduled: ['Scheduled', 'violet'], sending: ['Sending', 'violet'], sent: ['Sent', 'green'],
};

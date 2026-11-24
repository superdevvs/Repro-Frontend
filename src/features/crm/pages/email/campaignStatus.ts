import type { Tone } from '../../ui/primitives';

export const CAMPAIGN_STATUS: Record<string, [string, Tone]> = {
  draft: ['Draft', 'line'], submitted: ['Waiting for review', 'amber'], sent_back: ['Sent back', 'red'], approved: ['Approved', 'blue'],
  scheduled: ['Scheduled', 'violet'], sending: ['Sending', 'violet'], sent: ['Sent', 'green'],
};

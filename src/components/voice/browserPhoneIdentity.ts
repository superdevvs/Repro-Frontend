import type { VoiceBrowserOffer } from '@/types/voiceBrowser';

export const matchesBrowserOffer = (offer: VoiceBrowserOffer, legId?: string | null) =>
  Boolean(legId && (offer.agent_call_control_id === legId || offer.browser_call_control_id === legId));

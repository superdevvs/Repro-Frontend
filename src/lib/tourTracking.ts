import { API_BASE_URL } from '@/config/env';

type TourEventType = 'page_view' | 'link_click' | 'media_view' | 'share' | 'download';
type TourType = 'branded' | 'mls' | 'generic_mls';

/**
 * Fire-and-forget tour event tracking.
 * Called from public tour pages to record visitor activity.
 */
export function trackTourEvent(
  shootId: number | string,
  eventType: TourEventType,
  tourType: TourType,
  metadata?: Record<string, any>
) {
  try {
    const body: Record<string, any> = {
      shoot_id: Number(shootId),
      event_type: eventType,
      tour_type: tourType,
    };
    if (metadata) {
      body.metadata = metadata;
    }

    // Fire and forget — don't await, don't block UI
    fetch(`${API_BASE_URL}/api/public/tour-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // Silently fail — analytics should never break the tour page
    });
  } catch {
    // Silently fail
  }
}

/**
 * Track a page view (should be called once per page load).
 * Uses sessionStorage to deduplicate within the same session.
 */
export function trackPageView(shootId: number | string, tourType: TourType) {
  const dedupKey = `tour_pv_${shootId}_${tourType}`;
  if (typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem(dedupKey)) return;
    sessionStorage.setItem(dedupKey, '1');
  }
  trackTourEvent(shootId, 'page_view', tourType);
}

/**
 * Track a media view (image lightbox open).
 */
export function trackMediaView(
  shootId: number | string,
  tourType: TourType,
  mediaIndex: number,
  mediaUrl?: string
) {
  trackTourEvent(shootId, 'media_view', tourType, {
    media_index: mediaIndex,
    media_url: mediaUrl || null,
  });
}

/**
 * Track an external link click (matterport, iguide, video, etc).
 */
export function trackLinkClick(
  shootId: number | string,
  tourType: TourType,
  linkType?: string,
  url?: string
) {
  trackTourEvent(shootId, 'link_click', tourType, {
    link_type: linkType || null,
    url: url || null,
  });
}

/**
 * Track a share action.
 */
export function trackShare(shootId: number | string, tourType: TourType) {
  trackTourEvent(shootId, 'share', tourType);
}

/**
 * Track a download action.
 */
export function trackDownload(shootId: number | string, tourType: TourType) {
  trackTourEvent(shootId, 'download', tourType);
}

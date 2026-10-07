/** A client who is also the assigned photographer receives one notification. */
export const canNotifyDistinctPhotographer = (
  email?: string | null,
  photographerId?: string | number | null,
  clientId?: string | number | null,
): boolean => Boolean(email && (!clientId || String(photographerId) !== String(clientId)));

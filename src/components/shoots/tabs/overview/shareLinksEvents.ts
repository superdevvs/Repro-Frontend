export const SHOOT_SHARE_LINKS_UPDATED_EVENT = 'shoot-share-links-updated';

export type ShootShareLinkEntry = {
  id: number;
  share_url: string;
  download_count: number;
  created_at: string;
  expires_at: string | null;
  is_expired: boolean;
  is_revoked: boolean;
  is_active: boolean;
  created_by: { id: number; name: string } | null;
};

export const dispatchShootShareLinksUpdated = (
  shootId: string | number,
  entry?: ShootShareLinkEntry | null,
) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SHOOT_SHARE_LINKS_UPDATED_EVENT, {
      detail: {
        shootId: String(shootId),
        entry: entry ?? null,
      },
    }),
  );
};

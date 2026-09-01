import type { NormalizedIguideOfflinePackage } from '@/utils/shootTourData';

export const canShowIguideMedia = ({
  iguideUrl,
  isAdmin,
  isClient,
  isEditor,
  offlinePackage,
}: {
  iguideUrl?: string | null;
  isAdmin: boolean;
  isClient: boolean;
  isEditor: boolean;
  offlinePackage?: NormalizedIguideOfflinePackage | null;
}) => {
  if (isEditor) return false;
  if (String(iguideUrl || '').trim()) return true;
  if (isClient) {
    return offlinePackage?.status === 'ready' && Boolean(offlinePackage.exists);
  }
  return isAdmin && Boolean(offlinePackage?.exists);
};

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
  return isAdmin && !isClient && Boolean(offlinePackage?.exists);
};

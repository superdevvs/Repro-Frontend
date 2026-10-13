import type { MediaFile } from '@/hooks/useShootFiles';
import { canUseMediaDownload } from './mediaPresentationPermissions';
import { isSalesRepRole } from '@/utils/shootManagementAccess';

export function getMediaDownloadPermissions({ role, presentationRole = role, isAdmin, isPhotographer, isEditor, isClient, releaseLocked, displayTab, viewerSourceTab, viewerFile }: {
  role: string; isAdmin: boolean; isPhotographer: boolean; isEditor: boolean; isClient: boolean;
  releaseLocked: boolean; displayTab: string; viewerSourceTab: string; viewerFile?: MediaFile | null;
  presentationRole?: string;
}) {
  const allowedInTab = isAdmin || isPhotographer || (isEditor && displayTab === 'uploaded')
    || (isClient && !releaseLocked) || (isSalesRepRole(role) && displayTab === 'edited');
  const canDownloadFile = (file: MediaFile) => canUseMediaDownload(file, presentationRole)
    && (allowedInTab || (isClient && file.uses_watermark === false));
  const viewerAllowed = !viewerFile || canUseMediaDownload(viewerFile, presentationRole);
  return {
    allowedInTab,
    canDownloadFile,
    canDownloadViewer: viewerAllowed && (isAdmin || isPhotographer || (isEditor && viewerSourceTab === 'uploaded')
      || (isClient && (!releaseLocked || viewerFile?.uses_watermark === false)) || (isSalesRepRole(role) && viewerSourceTab === 'edited')),
    canViewFullSize: viewerAllowed && (isAdmin || isEditor || isPhotographer || (isClient && (!releaseLocked || viewerFile?.uses_watermark === false))),
  };
}

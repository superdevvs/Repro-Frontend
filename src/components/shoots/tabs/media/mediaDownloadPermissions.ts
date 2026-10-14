import type { MediaFile } from '@/hooks/useShootFiles';
import { canUseMediaDownload } from './mediaPresentationPermissions';
import { isSalesRepRole } from '@/utils/shootManagementAccess';

export function getMediaDownloadPermissions({ role, presentationRole = role, isAdmin, isPhotographer, isEditor, isClient, releaseLocked, displayTab, viewerSourceTab, viewerFile }: {
  role: string; isAdmin: boolean; isPhotographer: boolean; isEditor: boolean; isClient: boolean;
  releaseLocked: boolean; displayTab: string; viewerSourceTab: string; viewerFile?: MediaFile | null;
  presentationRole?: string;
}) {
  const allowedInTab = isAdmin || isPhotographer || isEditor
    || (isClient && !releaseLocked) || (isSalesRepRole(role) && displayTab === 'edited');
  const canDownloadFile = (file: MediaFile) => canUseMediaDownload(file, presentationRole)
    && (!isEditor || displayTab === 'uploaded' || file.can_download === true)
    && (allowedInTab || (isClient && file.uses_watermark === false));
  const viewerAllowed = !viewerFile || canUseMediaDownload(viewerFile, presentationRole);
  return {
    allowedInTab,
    canDownloadFile,
    canDownloadViewer: viewerAllowed && (isAdmin || isPhotographer || (isEditor && (viewerSourceTab === 'uploaded' || viewerFile?.can_download === true))
      || (isClient && (!releaseLocked || viewerFile?.uses_watermark === false)) || (isSalesRepRole(role) && viewerSourceTab === 'edited')),
    canViewFullSize: (viewerAllowed || (isEditor && viewerFile?.can_interact === true))
      && (isAdmin || isEditor || isPhotographer || (isClient && (!releaseLocked || viewerFile?.uses_watermark === false))),
  };
}

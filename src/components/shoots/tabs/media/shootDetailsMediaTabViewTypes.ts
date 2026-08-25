import type { Dispatch, DragEvent, ReactNode, SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import type { ShootUpload } from '@/context/UploadContext';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import type { useToast } from '@/hooks/use-toast';
import type { NormalizedIguideFloorplan, NormalizedIguideSync } from '@/utils/shootTourData';
import type { DownloadPopupState, ReclassifyMediaType } from './useShootMediaActions';
import type { MediaImageSize } from './mediaPreviewUtils';
import type { MediaSortOrder } from './mediaSort';

export type MediaSubTab =
  | 'photos'
  | 'videos'
  | 'iguide'
  | 'floorplans'
  | 'virtualStaging'
  | 'greenGrass'
  | 'twilight'
  | 'drone'
  | 'extras';

type AdminUploadSectionProps = {
  shoot: ShootData;
  onUploadComplete: () => void;
  onEditedUploadComplete: () => void;
  uploadContext: 'raw' | 'edited';
};

export interface ShootDetailsMediaTabViewProps {
  downloadPopup: DownloadPopupState;
  handleManualDownload: (popup: DownloadPopupState) => void;
  closeDownloadPopup: (popup: DownloadPopupState) => void;
  activeSubTab: 'uploaded' | 'edited' | 'upload';
  displayTab: 'uploaded' | 'edited';
  defaultTab: 'uploaded' | 'edited' | 'upload';
  isClient: boolean;
  isPhotographer: boolean;
  rawFiles: MediaFile[];
  editedFiles: MediaFile[];
  setActiveSubTab: Dispatch<SetStateAction<'uploaded' | 'edited' | 'upload'>>;
  setDisplayTab: Dispatch<SetStateAction<'uploaded' | 'edited'>>;
  mediaViewMode: 'list' | 'grid';
  toggleMediaViewMode: (mode: 'list' | 'grid') => void;
  isEditor: boolean;
  sortOrder: MediaSortOrder;
  sortSaveStatus: 'idle' | 'saving' | 'saved';
  changeSortOrder: (order: MediaSortOrder) => void;
  activeShootUploads: ShootUpload[];
  showUploadTab: boolean;
  selectedFiles: Set<string>;
  setRequestManagerOpen: Dispatch<SetStateAction<boolean>>;
  downloading: boolean;
  handleDownload: (size: 'original' | 'small') => Promise<void>;
  handleDeleteFiles: () => Promise<void>;
  handleGenerateShareLink: (shareAll?: boolean) => Promise<void>;
  handleEditorDownloadRaw: (downloadAll?: boolean) => Promise<void>;
  canDelete: boolean;
  canDownload: boolean;
  isAdmin: boolean;
  handleReclassify: (type: ReclassifyMediaType) => Promise<void>;
  markMenuOptions: Array<{ label: string; value: ReclassifyMediaType }>;
  directUploading: boolean;
  directUploadCompleted: number;
  directUploadTotal: number;
  directUploadProgress: number;
  dragOverTab: 'uploaded' | 'edited' | null;
  handleTabDragEnter: (event: DragEvent<HTMLDivElement>, tab: 'uploaded' | 'edited') => void;
  handleTabDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleTabDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleDirectDrop: (event: DragEvent<HTMLDivElement>, type: 'raw' | 'edited') => Promise<void>;
  uploadedMediaTab: MediaSubTab;
  setUploadedMediaTab: Dispatch<SetStateAction<MediaSubTab>>;
  uploadedPhotos: MediaFile[];
  uploadedVideos: MediaFile[];
  shootHasVideoService: boolean;
  iguideUrl: string;
  iguideFloorplans: NormalizedIguideFloorplan[];
  iguideSync?: NormalizedIguideSync | null;
  uploadedFloorplans: MediaFile[];
  uploadedVirtualStaging: MediaFile[];
  uploadedGreenGrass: MediaFile[];
  uploadedTwilight: MediaFile[];
  uploadedDrone: MediaFile[];
  uploadedExtras: MediaFile[];
  renderMediaGridPane: (
    files: MediaFile[],
    emptyTitle: string,
    emptyDescription: string,
    uploadLabel?: string,
    separateExtras?: boolean,
  ) => ReactNode;
  /**
   * A render function, deliberately not a `ComponentType`.
   *
   * It is defined inside `useShootDetailsMediaTab`, so as a component it received
   * a new function identity on every render of that hook. React treats a new
   * component type as a different component and remounts the whole subtree, which
   * destroyed the upload panel's staged queue on any parent re-render — including
   * the one that starting an upload itself triggers. Calling it instead of
   * mounting it removes the component boundary, so the panel below keeps its
   * identity and its state.
   */
  renderAdminUploadSection: (props: AdminUploadSectionProps) => ReactNode;
  shoot: ShootData;
  toast: ReturnType<typeof useToast>['toast'];
  queryClient: QueryClient;
  onShootUpdate: () => void;
  clientEditedMediaTabs: Array<{ id: MediaSubTab; label: string }>;
  editedMediaTab: MediaSubTab;
  setEditedMediaTab: Dispatch<SetStateAction<MediaSubTab>>;
  editedPhotos: MediaFile[];
  editedVideos: MediaFile[];
  editedFloorplans: MediaFile[];
  editedVirtualStaging: MediaFile[];
  editedGreenGrass: MediaFile[];
  editedTwilight: MediaFile[];
  editedDrone: MediaFile[];
  editedExtras: MediaFile[];
  openViewer: (index: number, files: MediaFile[], source: 'uploaded' | 'edited') => void;
  toggleSelection: (fileId: string) => void;
  setSelectedFiles: Dispatch<SetStateAction<Set<string>>>;
  manualOrder: string[];
  handleManualOrderChange: (files: MediaFile[], order: string[], separateExtras?: boolean) => void;
  getImageUrl: (file: MediaFile, size?: MediaImageSize) => string;
  getSrcSet: (file: MediaFile) => string;
  isPreviewableImage: (file: MediaFile) => boolean;
  isVideoFile: (file: MediaFile) => boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  toggleFileHidden: (fileId: string, hidden: boolean) => void;
}

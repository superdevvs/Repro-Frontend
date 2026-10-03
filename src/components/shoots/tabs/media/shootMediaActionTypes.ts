import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { useToast } from '@/hooks/use-toast';
import type { StagedMediaDrop } from './stagedMediaDrop';
import type { useUpload } from '@/context/UploadContext';

export type ReclassifyMediaType =
  | 'photos'
  | 'main'
  | 'main_photos'
  | 'floorplan'
  | 'raw'
  | 'edited'
  | 'extra'
  | 'virtual_staging'
  | 'green_grass'
  | 'twilight'
  | 'drone';

export const markMenuOptions: Array<{ label: string; value: ReclassifyMediaType }> = [
  { label: 'Main photos', value: 'photos' },
  { label: 'Floorplan', value: 'floorplan' },
  { label: 'Extra', value: 'extra' },
  { label: 'Virtual Staging', value: 'virtual_staging' },
  { label: 'Green Grass', value: 'green_grass' },
  { label: 'Twilight', value: 'twilight' },
  { label: 'Drone', value: 'drone' },
];

export interface DownloadPopupState {
  visible: boolean;
  status: 'processing' | 'ready' | 'error';
  blobUrl: string | null;
  filename: string;
  fileCount: number;
  sizeLabel: string;
}

export interface UseShootMediaActionsParams {
  shoot: ShootData;
  role: string;
  displayTab: 'uploaded' | 'edited';
  selectedFiles: Set<string>;
  setSelectedFiles: Dispatch<SetStateAction<Set<string>>>;
  selectedEditingType: string;
  setShowAiEditDialog: Dispatch<SetStateAction<boolean>>;
  setSubmittingAiEdit: Dispatch<SetStateAction<boolean>>;
  setDownloading: Dispatch<SetStateAction<boolean>>;
  setDownloadPopup: Dispatch<SetStateAction<DownloadPopupState>>;
  setActiveSubTab: Dispatch<SetStateAction<'uploaded' | 'edited' | 'upload'>>;
  setDisplayTab: Dispatch<SetStateAction<'uploaded' | 'edited'>>;
  rawFiles: MediaFile[];
  editedFiles: MediaFile[];
  setRawFiles: Dispatch<SetStateAction<MediaFile[]>>;
  setEditedFiles: Dispatch<SetStateAction<MediaFile[]>>;
  showUploadTab: boolean;
  onShootUpdate: () => void;
  queryClient: QueryClient;
  toast: ReturnType<typeof useToast>['toast'];
  onStageUploadFiles?: (batch: StagedMediaDrop) => void;
  trackUpload: ReturnType<typeof useUpload>['trackUpload'];
  dragCounterRef: MutableRefObject<number>;
  setDragOverTab: Dispatch<SetStateAction<'uploaded' | 'edited' | null>>;
}

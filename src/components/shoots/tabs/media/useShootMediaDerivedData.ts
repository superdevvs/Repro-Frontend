import { useMemo } from 'react';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { getPreferredIguideUrl, normalizeIguideFloorplans } from '@/utils/shootTourData';

const VIDEO_EXTENSION_REGEX = /\.(mp4|mov|m4v|avi|mkv|wmv|webm|mpg|mpeg|3gp)$/i;

const normalizeFilename = (value?: string | null): string =>
  String(value || '')
    .replace(/^https?:\/\//i, '')
    .split(/[?#]/)[0]
    .split('/')
    .pop()
    ?.toLowerCase() || '';

const isVideoFile = (file: MediaFile): boolean => {
  if (!file) return false;

  const mediaType = (file.media_type || '').toLowerCase();
  if (mediaType === 'video') return true;

  const mimeCandidates = [
    file.fileType,
    (file as any)?.file_type,
    (file as any)?.mime_type,
  ]
    .filter(Boolean)
    .map((m) => (m || '').toLowerCase());

  if (mimeCandidates.some((mime) => mime.startsWith('video/'))) {
    return true;
  }

  const nameCandidates = [
    file.filename,
    (file as any)?.stored_filename,
    file.original,
    file.url,
    file.path,
  ];

  return nameCandidates.some((name) => VIDEO_EXTENSION_REGEX.test(normalizeFilename(name)));
};

const getNormalizedMediaType = (f: MediaFile): string => (f.media_type || '').toLowerCase();
const isFloorplanFile = (f: MediaFile): boolean => getNormalizedMediaType(f) === 'floorplan';
const isVirtualStagingFile = (f: MediaFile): boolean => getNormalizedMediaType(f) === 'virtual_staging';
const isGreenGrassFile = (f: MediaFile): boolean => getNormalizedMediaType(f) === 'green_grass';
const isTwilightFile = (f: MediaFile): boolean => getNormalizedMediaType(f) === 'twilight';
const isDroneFile = (f: MediaFile): boolean => getNormalizedMediaType(f) === 'drone';
const isExtraMediaFile = (f: MediaFile): boolean => Boolean(f.isExtra) || getNormalizedMediaType(f) === 'extra';

const filterPhotoFiles = (files: MediaFile[]): MediaFile[] =>
  files.filter(
    (f) =>
      !isVideoFile(f) &&
      !isFloorplanFile(f) &&
      !isVirtualStagingFile(f) &&
      !isGreenGrassFile(f) &&
      !isTwilightFile(f) &&
      !isDroneFile(f) &&
      !isExtraMediaFile(f),
  );
const filterVideoFiles = (files: MediaFile[]): MediaFile[] =>
  files.filter((f) => isVideoFile(f) && !isDroneFile(f) && !isExtraMediaFile(f));
const filterFloorplanFiles = (files: MediaFile[]): MediaFile[] => files.filter((f) => isFloorplanFile(f));
const filterVirtualStagingFiles = (files: MediaFile[]): MediaFile[] => files.filter((f) => isVirtualStagingFile(f));
const filterGreenGrassFiles = (files: MediaFile[]): MediaFile[] => files.filter((f) => isGreenGrassFile(f));
const filterTwilightFiles = (files: MediaFile[]): MediaFile[] => files.filter((f) => isTwilightFile(f));
const filterDroneFiles = (files: MediaFile[]): MediaFile[] => files.filter((f) => isDroneFile(f));
const filterExtraFiles = (files: MediaFile[]): MediaFile[] => files.filter((f) => isExtraMediaFile(f));

interface UseShootMediaDerivedDataParams {
  shoot: ShootData;
  rawFiles: MediaFile[];
  editedFiles: MediaFile[];
  displayTab: 'uploaded' | 'edited';
  uploadedMediaTab:
    | 'photos'
    | 'videos'
    | 'iguide'
    | 'floorplans'
    | 'virtualStaging'
    | 'greenGrass'
    | 'twilight'
    | 'drone'
    | 'extras';
  editedMediaTab:
    | 'photos'
    | 'videos'
    | 'iguide'
    | 'floorplans'
    | 'virtualStaging'
    | 'greenGrass'
    | 'twilight'
    | 'drone'
    | 'extras';
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
}

export function useShootMediaDerivedData({
  shoot,
  rawFiles,
  editedFiles,
  displayTab,
  uploadedMediaTab,
  editedMediaTab,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
}: UseShootMediaDerivedDataParams) {
  const uploadedPhotos = useMemo(() => filterPhotoFiles(rawFiles), [rawFiles]);
  const uploadedVideos = useMemo(() => filterVideoFiles(rawFiles), [rawFiles]);
  const editedPhotos = useMemo(() => filterPhotoFiles(editedFiles), [editedFiles]);
  const editedVideos = useMemo(() => filterVideoFiles(editedFiles), [editedFiles]);
  const uploadedFloorplans = useMemo(() => filterFloorplanFiles(rawFiles), [rawFiles]);
  const editedFloorplans = useMemo(() => filterFloorplanFiles(editedFiles), [editedFiles]);
  const uploadedVirtualStaging = useMemo(() => filterVirtualStagingFiles(rawFiles), [rawFiles]);
  const editedVirtualStaging = useMemo(() => filterVirtualStagingFiles(editedFiles), [editedFiles]);
  const uploadedGreenGrass = useMemo(() => filterGreenGrassFiles(rawFiles), [rawFiles]);
  const editedGreenGrass = useMemo(() => filterGreenGrassFiles(editedFiles), [editedFiles]);
  const uploadedTwilight = useMemo(() => filterTwilightFiles(rawFiles), [rawFiles]);
  const editedTwilight = useMemo(() => filterTwilightFiles(editedFiles), [editedFiles]);
  const uploadedDrone = useMemo(() => filterDroneFiles(rawFiles), [rawFiles]);
  const editedDrone = useMemo(() => filterDroneFiles(editedFiles), [editedFiles]);
  const uploadedExtras = useMemo(() => filterExtraFiles(rawFiles), [rawFiles]);
  const editedExtras = useMemo(() => filterExtraFiles(editedFiles), [editedFiles]);

  const iguideUrl = getPreferredIguideUrl(shoot);
  const iguideFloorplans: Array<{ url: string; filename?: string }> = useMemo(
    () => normalizeIguideFloorplans(shoot),
    [shoot],
  );

  const shootHasVideoService = useMemo(() => {
    const services = shoot?.services || [];
    return services.some((service) => /video/i.test(String(service)));
  }, [shoot]);

  const canDownload = isAdmin || isClient || isEditor || isPhotographer;
  const showUploadTab = isAdmin || isPhotographer || isEditor;

  const currentDisplayedFiles = useMemo(() => {
    if (displayTab === 'uploaded') {
      if (uploadedMediaTab === 'photos') return uploadedPhotos;
      if (uploadedMediaTab === 'videos') return uploadedVideos;
      if (uploadedMediaTab === 'floorplans') return uploadedFloorplans;
      if (uploadedMediaTab === 'virtualStaging') return uploadedVirtualStaging;
      if (uploadedMediaTab === 'greenGrass') return uploadedGreenGrass;
      if (uploadedMediaTab === 'twilight') return uploadedTwilight;
      if (uploadedMediaTab === 'drone') return uploadedDrone;
      if (uploadedMediaTab === 'extras') return uploadedExtras;
      return rawFiles;
    }

    if (editedMediaTab === 'photos') return editedPhotos;
    if (editedMediaTab === 'videos') return editedVideos;
    if (editedMediaTab === 'floorplans') return editedFloorplans;
    if (editedMediaTab === 'virtualStaging') return editedVirtualStaging;
    if (editedMediaTab === 'greenGrass') return editedGreenGrass;
    if (editedMediaTab === 'twilight') return editedTwilight;
    if (editedMediaTab === 'drone') return editedDrone;
    if (editedMediaTab === 'extras') return editedExtras;
    return editedFiles;
  }, [
    displayTab,
    uploadedMediaTab,
    editedMediaTab,
    uploadedPhotos,
    uploadedVideos,
    uploadedFloorplans,
    uploadedVirtualStaging,
    uploadedGreenGrass,
    uploadedTwilight,
    uploadedDrone,
    uploadedExtras,
    editedPhotos,
    editedVideos,
    editedFloorplans,
    editedVirtualStaging,
    editedGreenGrass,
    editedTwilight,
    editedDrone,
    editedExtras,
    rawFiles,
    editedFiles,
  ]);

  return {
    uploadedPhotos,
    uploadedVideos,
    editedPhotos,
    editedVideos,
    uploadedFloorplans,
    editedFloorplans,
    uploadedVirtualStaging,
    editedVirtualStaging,
    uploadedGreenGrass,
    editedGreenGrass,
    uploadedTwilight,
    editedTwilight,
    uploadedDrone,
    editedDrone,
    uploadedExtras,
    editedExtras,
    iguideUrl,
    iguideFloorplans,
    shootHasVideoService,
    canDownload,
    showUploadTab,
    currentDisplayedFiles,
    isVideoFile,
  };
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Upload, 
  Download,
  Image as ImageIcon,
  FileIcon,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Loader2,
  Check,
  ArrowUpDown,
  Trash2,
  CloudUpload,
  Circle,
  MinusCircle,
  Link2,
  Share2,
  LayoutGrid,
  List,
  Play,
  ExternalLink,
  EyeOff,
  Eye,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
// FileUploader import removed - using RawUploadSection and EditedUploadSection instead
import { useAuth } from '@/components/auth/AuthProvider';
import { useUpload } from '@/context/UploadContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { autoenhanceService, type EditingType } from '@/services/autoenhanceService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isRawFile } from '@/services/rawPreviewService';
import { useShootFiles, type MediaFile } from '@/hooks/useShootFiles';
import { useQueryClient } from '@tanstack/react-query';
import { UploadDropzone, UploadProgressCard } from './MediaUploadPanels';
import { MediaGrid } from './MediaGrid';
import { MediaViewer } from './MediaViewer';
import {
  getMediaImageUrl as getImageUrl,
  getMediaSrcSet as getSrcSet,
  getDisplayMediaFilename,
  getMediaViewerImageUrl,
  isPreviewableImage,
} from './mediaPreviewUtils';
import VideoThumbnail from '../../VideoThumbnail';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import { EditedUploadSection, RawUploadSection } from './MediaUploadSections';
import { useShootMediaSelectionState } from './useShootMediaSelectionState';
import { useShootMediaDerivedData } from './useShootMediaDerivedData';
import { getSortedMediaIds, normalizeManualOrder, sortMediaFiles, type MediaSortOrder } from './mediaSort';
import { getPreferredMlsTourLink } from '@/utils/shootTourData';
import { markMenuOptions, useShootMediaActions, type DownloadPopupState } from './useShootMediaActions';
import { ShootDetailsMediaTabView } from './ShootDetailsMediaTabView';
import { ShootDetailsMediaTabDialogs } from './ShootDetailsMediaTabDialogs';
import { getShootServiceItems } from '@/utils/shootServiceItems';

interface ShootDetailsMediaTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  isClientReleaseLocked?: boolean;
  role: string;
  onShootUpdate: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  displayTab?: 'uploaded' | 'edited';
  onDisplayTabChange?: (tab: 'uploaded' | 'edited') => void;
}

type MediaSubTab =
  | 'photos'
  | 'videos'
  | 'iguide'
  | 'floorplans'
  | 'virtualStaging'
  | 'greenGrass'
  | 'twilight'
  | 'drone'
  | 'extras';

type ShootMediaTabSource = ShootData & {
  editor_notes?: string;
  editorNotes?: string;
  status?: string;
  raw_photo_count?: number;
  edited_photo_count?: number;
};

const CLIENT_PROGRESS_STEPS = [
  {
    key: 'requested',
    stageLabel: 'Requested',
    label: 'Awaiting confirmation',
    description: "We're waiting for your shoot request to be confirmed.",
    percent: 10,
  },
  {
    key: 'scheduled',
    stageLabel: 'Scheduled',
    label: 'Shoot scheduled',
    description: 'Your shoot is booked and waiting for the next workflow update.',
    percent: 30,
  },
  {
    key: 'editing',
    stageLabel: 'Editing',
    label: 'Editing in progress',
    description: 'Your photos are currently being edited.',
    percent: 60,
  },
  {
    key: 'ready',
    stageLabel: 'Ready',
    label: 'Ready',
    description: "Everything is complete and your shoot is ready.",
    percent: 100,
  },
] as const;

type ClientProgressStageKey = (typeof CLIENT_PROGRESS_STEPS)[number]['key'];

// MediaFile interface is imported from useShootFiles hook

export function useShootDetailsMediaTab({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  isClientReleaseLocked = false,
  role,
  onShootUpdate,
  isExpanded = false,
  onToggleExpand,
  onSelectionChange,
  displayTab: controlledDisplayTab,
  onDisplayTabChange,
}: ShootDetailsMediaTabProps) {
  const aiEditEventName = 'shoot-ai-edit-open';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { trackUpload, uploads } = useUpload();
  // Default tab based on role: clients see edited, others see uploaded
  const defaultTab = isClient ? 'edited' : 'uploaded';
  const shootFilesCacheKey = [
    shoot.payment?.paymentStatus ?? 'unknown',
    shoot.payment?.totalPaid ?? shoot.totalPaid ?? 0,
    shoot.updatedAt ?? '',
    getShootServiceItems(shoot)
      .map((item) => [
        item.id,
        item.shootServiceId ?? '',
        item.workflowStatus ?? '',
        item.deliveryStatus ?? '',
        item.paymentStatus ?? '',
        item.isUnlockedForDelivery ? '1' : '0',
      ].join('|'))
      .join(';'),
  ].join(':');
  const [activeSubTab, setActiveSubTab] = useState<'uploaded' | 'edited' | 'upload'>(defaultTab);
  const [internalDisplayTab, setInternalDisplayTab] = useState<'uploaded' | 'edited'>(defaultTab);
  const [uploadedMediaTab, setUploadedMediaTab] = useState<MediaSubTab>('photos');
  const [editedMediaTab, setEditedMediaTab] = useState<MediaSubTab>('photos');
  const displayTab = controlledDisplayTab ?? internalDisplayTab;
  const setDisplayTab = useCallback(
    (nextTab: 'uploaded' | 'edited') => {
      setInternalDisplayTab(nextTab);
      onDisplayTabChange?.(nextTab);
    },
    [onDisplayTabChange],
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadPopup, setDownloadPopup] = useState<DownloadPopupState>({
    visible: false,
    status: 'processing',
    blobUrl: null,
    filename: '',
    fileCount: 0,
    sizeLabel: '',
  });
  const [showAiEditDialog, setShowAiEditDialog] = useState(false);
  const [editingTypes, setEditingTypes] = useState<EditingType[]>([]);
  const [selectedEditingType, setSelectedEditingType] = useState<string>('');
  const [submittingAiEdit, setSubmittingAiEdit] = useState(false);
  const [editingNotesValue, setEditingNotesValue] = useState(() => {
    const mediaShoot = shoot as ShootMediaTabSource;
    return String(mediaShoot.editor_notes || mediaShoot.editorNotes || (typeof shoot.notes === 'object' && shoot.notes?.editingNotes) || '');
  });
  const [requestManagerOpen, setRequestManagerOpen] = useState(false);
  const [rawFiles, setRawFiles] = useState<MediaFile[]>([]);
  const [editedFiles, setEditedFiles] = useState<MediaFile[]>([]);
  const clientUnlockedServiceIds = useMemo(() => {
    if (!isClient) return new Set<string>();

    return new Set(
      getShootServiceItems(shoot)
        .filter((item) => {
          const deliveryStatus = String(item.deliveryStatus ?? '').toLowerCase();
          const workflowStatus = String(item.workflowStatus ?? '').toLowerCase();

          return (
            item.isDeliverable &&
            item.isUnlockedForDelivery &&
            ['ready', 'delivered'].includes(deliveryStatus) &&
            workflowStatus !== 'cancelled'
          );
        })
          .flatMap((item) => [item.id, item.shootServiceId].filter(Boolean).map(String)),
    );
  }, [isClient, shoot]);
  const hasClientUnlockedServiceDelivery = isClient && clientUnlockedServiceIds.size > 0;
  const effectiveClientReleaseLocked = isClientReleaseLocked && !hasClientUnlockedServiceDelivery;
  const clientVisibleEditedFiles = useMemo(() => {
    if (!isClient || !isClientReleaseLocked || !hasClientUnlockedServiceDelivery) {
      return editedFiles;
    }

    return editedFiles.filter((file) => {
      const serviceId = file.shoot_service_id ?? file.shootServiceId;
      return serviceId != null && clientUnlockedServiceIds.has(String(serviceId));
    });
  }, [
    clientUnlockedServiceIds,
    editedFiles,
    hasClientUnlockedServiceDelivery,
    isClient,
    isClientReleaseLocked,
  ]);
  const {
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
  } = useShootMediaDerivedData({
    shoot,
    rawFiles,
    editedFiles: clientVisibleEditedFiles,
    displayTab,
    uploadedMediaTab,
    editedMediaTab,
    isAdmin,
    isPhotographer,
    isEditor,
    isClient,
    isClientReleaseLocked: effectiveClientReleaseLocked,
    role,
  });
  const clientEditedMediaTabs = useMemo(
    () =>
      [
        { id: 'photos' as MediaSubTab, label: `Photos (${editedPhotos.length})` },
        (shootHasVideoService || editedVideos.length > 0)
          ? { id: 'videos' as MediaSubTab, label: `Video (${editedVideos.length})` }
          : null,
        !isEditor && iguideUrl
          ? { id: 'iguide' as MediaSubTab, label: 'iGuide' }
          : null,
        !isEditor && (editedFloorplans.length > 0 || iguideFloorplans.length > 0)
          ? {
              id: 'floorplans' as MediaSubTab,
              label: `Floorplans (${editedFloorplans.length + iguideFloorplans.length})`,
            }
          : null,
        editedVirtualStaging.length > 0
          ? {
              id: 'virtualStaging' as MediaSubTab,
              label: `Virtual Staging (${editedVirtualStaging.length})`,
            }
          : null,
        editedGreenGrass.length > 0
          ? { id: 'greenGrass' as MediaSubTab, label: `Green Grass (${editedGreenGrass.length})` }
          : null,
        editedTwilight.length > 0
          ? { id: 'twilight' as MediaSubTab, label: `Twilight (${editedTwilight.length})` }
          : null,
        editedDrone.length > 0
          ? { id: 'drone' as MediaSubTab, label: `Drone (${editedDrone.length})` }
          : null,
        editedExtras.length > 0
          ? { id: 'extras' as MediaSubTab, label: `Extras (${editedExtras.length})` }
          : null,
      ].filter((tab): tab is { id: MediaSubTab; label: string } => Boolean(tab)),
    [
      editedDrone.length,
      editedExtras.length,
      editedFloorplans.length,
      editedGreenGrass.length,
      editedPhotos.length,
      editedTwilight.length,
      editedVideos.length,
      editedVirtualStaging.length,
      iguideFloorplans.length,
      iguideUrl,
      isEditor,
      shootHasVideoService,
    ],
  );
  const [sortOrder, setSortOrderRaw] = useState<MediaSortOrder>(() => {
    try {
      const saved = localStorage.getItem(`media-sort-${shoot.id}`);
      if (saved && ['name', 'date', 'time', 'manual'].includes(saved)) return saved as MediaSortOrder;
    } catch {
      // Ignore unavailable localStorage and fall back to the default sort mode.
    }
    return 'time';
  });
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [isDragMode, setIsDragMode] = useState(false);
  const [sortSaveStatus, setSortSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const sortSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortSavedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringOrder = useRef(false);
  const hasPendingManualOrder = useRef(false);
  const [mediaViewMode, setMediaViewMode] = useState<'list' | 'grid'>(() => {
    try { return (localStorage.getItem('media-view-mode') as 'list' | 'grid') || 'list'; } catch { return 'list'; }
  });
  const toggleMediaViewMode = (mode: 'list' | 'grid') => {
    setMediaViewMode(mode);
    try {
      localStorage.setItem('media-view-mode', mode);
    } catch {
      // Ignore unavailable localStorage in restricted/private browsing contexts.
    }
  };
  const [dragOverTab, setDragOverTab] = useState<'uploaded' | 'edited' | null>(null);
  const [directUploading, setDirectUploading] = useState(false);
  const [directUploadProgress, setDirectUploadProgress] = useState(0);
  const [directUploadTotal, setDirectUploadTotal] = useState(0);
  const [directUploadCompleted, setDirectUploadCompleted] = useState(0);
  const dragCounterRef = useRef(0);
  const {
    selectedFiles,
    setSelectedFiles,
    viewerOpen,
    setViewerOpen,
    viewerIndex,
    setViewerIndex,
    viewerFiles,
    setViewerFiles,
    openViewer,
    toggleSelection,
    clearSelection,
  } = useShootMediaSelectionState({ onSelectionChange });
  const [viewerSourceTab, setViewerSourceTab] = useState<'uploaded' | 'edited'>('uploaded');
  const openViewerWithSource = useCallback(
    (index: number, files: MediaFile[], source: 'uploaded' | 'edited' = displayTab) => {
      setViewerSourceTab(source);
      openViewer(index, files);
    },
    [displayTab, openViewer],
  );

  useEffect(() => {
    if (controlledDisplayTab) {
      setInternalDisplayTab(controlledDisplayTab);
    }
  }, [controlledDisplayTab]);

  useEffect(() => {
    if (activeSubTab !== 'upload' && activeSubTab !== displayTab) {
      setActiveSubTab(displayTab);
    }
  }, [activeSubTab, displayTab]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, displayTab]);

  useEffect(() => {
    if (!viewerOpen || viewerFiles.length === 0) {
      return;
    }

    const allFiles = [...rawFiles, ...clientVisibleEditedFiles];
    const nextViewerFiles = viewerFiles.map((file) => allFiles.find((candidate) => candidate.id === file.id) ?? file);
    const hasChanged = nextViewerFiles.some((file, index) => file !== viewerFiles[index]);
    if (hasChanged) {
      setViewerFiles(nextViewerFiles);
    }
  }, [clientVisibleEditedFiles, rawFiles, setViewerFiles, viewerFiles, viewerOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOpenAiEdit = (event: Event) => {
      const customEvent = event as CustomEvent<{ shootId?: string | number }>;
      const targetShootId = customEvent.detail?.shootId;

      if (targetShootId === undefined || String(targetShootId) !== String(shoot.id)) {
        return;
      }

      setShowAiEditDialog(true);
    };

    window.addEventListener(aiEditEventName, handleOpenAiEdit as EventListener);

    return () => {
      window.removeEventListener(aiEditEventName, handleOpenAiEdit as EventListener);
    };
  }, [shoot.id]);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const availableIds = clientEditedMediaTabs.map((tab) => tab.id);
    if (availableIds.length === 0) {
      if (editedMediaTab !== 'photos') {
        setEditedMediaTab('photos');
      }
      return;
    }

    if (availableIds.includes(editedMediaTab)) {
      return;
    }

    setEditedMediaTab(availableIds[0]);
  }, [clientEditedMediaTabs, editedMediaTab, isClient]);

  // Load editing types - only for admin/editor users (clients don't have access)
  const canAccessAutoenhance = ['admin', 'superadmin', 'editing_manager', 'editor'].includes(role || '');
  
  useEffect(() => {
    if (!canAccessAutoenhance) return;
    
    const loadEditingTypes = async () => {
      try {
        const types = await autoenhanceService.getEditingTypes();
        setEditingTypes(types);
        if (types.length > 0) {
          setSelectedEditingType(types[0].id);
        }
      } catch (error) {
        // Silently fail - editing types are optional and may not be configured
      }
    };
    loadEditingTypes();
  }, [canAccessAutoenhance]);

  // Load files using React Query hooks for deduplication and caching
  const rawFilesEnabled = Boolean(shoot.id) && !isClient;
  const { data: rawFilesData = [], isLoading: rawLoading } = useShootFiles(shoot.id, 'raw', {
    enabled: rawFilesEnabled,
    cacheKey: shootFilesCacheKey,
  });
  const { data: editedFilesData = [], isLoading: editedLoading } = useShootFiles(shoot.id, 'edited', {
    enabled: Boolean(shoot.id),
    cacheKey: shootFilesCacheKey,
  });

  const buildFilesFingerprint = (files: MediaFile[]) => JSON.stringify(
    files.map((f) => ({
      id: f.id,
      shootServiceId: f.shoot_service_id ?? f.shootServiceId,
      url: f.url,
      path: f.path,
      mt: f.media_type,
      workflowStage: f.workflowStage,
      thumb: f.thumb,
      medium: f.medium,
      large: f.large,
      original: f.original,
      web_url: f.web_url,
      thumbnail_path: f.thumbnail_path,
      web_path: f.web_path,
      watermarked_thumbnail_path: f.watermarked_thumbnail_path,
      watermarked_web_path: f.watermarked_web_path,
      placeholder_path: f.placeholder_path,
      processed_at: f.processed_at,
    }))
  );

  // Update local state when data changes - use JSON.stringify to detect actual content changes
  // This prevents infinite loops from new array references with same content
  const rawFilesRef = useRef<string>('');
  useEffect(() => {
    const newRawFilesJson = buildFilesFingerprint(rawFilesData);
    if (rawFilesRef.current !== newRawFilesJson) {
      rawFilesRef.current = newRawFilesJson;
      setRawFiles(rawFilesData);
    }
  }, [rawFilesData]);

  const editedFilesRef = useRef<string>('');
  useEffect(() => {
    const newEditedFilesJson = buildFilesFingerprint(editedFilesData);
    if (editedFilesRef.current !== newEditedFilesJson) {
      editedFilesRef.current = newEditedFilesJson;
      setEditedFiles(editedFilesData);
    }
  }, [editedFilesData]);

  // Restore manual order from saved sort_order when files load
  const lastSortFingerprint = useRef('');
  const getAllFiles = useCallback(
    () => [...rawFiles, ...clientVisibleEditedFiles],
    [clientVisibleEditedFiles, rawFiles],
  );
  const getSortableFiles = useCallback(
    () => (isClient ? [...clientVisibleEditedFiles] : [...rawFiles, ...clientVisibleEditedFiles]),
    [clientVisibleEditedFiles, isClient, rawFiles],
  );
  useEffect(() => {
    const sortableFiles = getSortableFiles();
    if (sortableFiles.length === 0) return;
    if (hasPendingManualOrder.current || (sortOrder === 'manual' && manualOrder.length > 0)) {
      return;
    }
    // Check if any file has a non-zero sort_order (meaning order was previously saved)
    const hasSavedOrder = sortableFiles.some(f => (f.sort_order ?? 0) > 0);
    if (hasSavedOrder) {
      const sorted = [...sortableFiles].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const newOrder = normalizeManualOrder(sorted.map((file) => file.id), sortableFiles);
      // Only update if the order fingerprint changed (avoids infinite loops)
      const fingerprint = newOrder.join(',');
      if (fingerprint !== lastSortFingerprint.current) {
        lastSortFingerprint.current = fingerprint;
        isRestoringOrder.current = true;
        setManualOrder(newOrder);
      }
    }
  }, [getSortableFiles, manualOrder.length, sortOrder]);

  useEffect(() => {
    const sortableFiles = getSortableFiles();
    if (sortableFiles.length === 0) {
      if (manualOrder.length > 0) {
        setManualOrder([]);
      }
      return;
    }

    const normalizedOrder = normalizeManualOrder(manualOrder, sortableFiles);
    const currentFingerprint = manualOrder.join(',');
    const normalizedFingerprint = normalizedOrder.join(',');
    if (normalizedFingerprint !== currentFingerprint) {
      setManualOrder(normalizedOrder);
    }
  }, [getSortableFiles, manualOrder]);

  useEffect(() => {
    if (sortOrder !== 'manual' && isDragMode) {
      setIsDragMode(false);
    }
  }, [isDragMode, sortOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(`media-sort-${shoot.id}`, sortOrder);
    } catch {
      // Ignore unavailable localStorage and keep the in-memory selection active.
    }
  }, [shoot.id, sortOrder]);

  const persistManualOrder = useCallback(
    async (nextOrder: string[]) => {
      const sortableFiles = getSortableFiles();
      const sortableFileIds = new Set(sortableFiles.map((file) => file.id));
      const numericFileIds = nextOrder
        .filter((id) => sortableFileIds.has(id))
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isFinite(id));

      if (numericFileIds.length === 0) {
        return;
      }

      setSortSaveStatus('saving');

      try {
        const headers = getApiHeaders();
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/reorder`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ file_ids: numericFileIds }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to save file order' }));
          throw new Error(errorData.message || 'Failed to save file order');
        }

        const orderMap = new Map(nextOrder.map((id, index) => [id, index]));
        const applyOrder = (files: MediaFile[]) =>
          files.map((file) =>
            orderMap.has(file.id) ? { ...file, sort_order: orderMap.get(file.id) ?? file.sort_order ?? 0 } : file,
          );

        if (!isClient) {
          setRawFiles((prev) => applyOrder(prev));
        }
        setEditedFiles((prev) => applyOrder(prev));
        lastSortFingerprint.current = nextOrder.join(',');
        hasPendingManualOrder.current = false;

        setSortSaveStatus('saved');
        queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
        queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
        queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'all'] });
      } catch (error: unknown) {
        setSortSaveStatus('idle');
        toast({
          title: 'Sort order update failed',
          description: error instanceof Error ? error.message : 'Failed to save file order',
          variant: 'destructive',
        });
      }
    },
    [getSortableFiles, isClient, queryClient, shoot.id, toast],
  );

  useEffect(() => {
    if (sortOrder !== 'manual' || manualOrder.length === 0) {
      return;
    }

    const currentFingerprint = manualOrder.join(',');
    if (!hasPendingManualOrder.current && currentFingerprint === lastSortFingerprint.current) {
      return;
    }

    if (isRestoringOrder.current) {
      isRestoringOrder.current = false;
      return;
    }

    if (sortSaveTimerRef.current) {
      clearTimeout(sortSaveTimerRef.current);
    }

    if (sortSavedResetRef.current) {
      clearTimeout(sortSavedResetRef.current);
    }

    sortSaveTimerRef.current = setTimeout(() => {
      void persistManualOrder(manualOrder);
    }, 250);

    return () => {
      if (sortSaveTimerRef.current) {
        clearTimeout(sortSaveTimerRef.current);
      }
    };
  }, [manualOrder, persistManualOrder, sortOrder]);

  useEffect(() => {
    if (sortSaveStatus !== 'saved') {
      return;
    }

    sortSavedResetRef.current = setTimeout(() => {
      setSortSaveStatus('idle');
    }, 1500);

    return () => {
      if (sortSavedResetRef.current) {
        clearTimeout(sortSavedResetRef.current);
      }
    };
  }, [sortSaveStatus]);

  useEffect(() => () => {
    if (sortSaveTimerRef.current) {
      clearTimeout(sortSaveTimerRef.current);
    }
    if (sortSavedResetRef.current) {
      clearTimeout(sortSavedResetRef.current);
    }
  }, []);

  const changeSortOrder = useCallback((nextSortOrder: MediaSortOrder) => {
    if (nextSortOrder === 'manual') {
      const sortableFiles = getSortableFiles();
      const baselineSort = sortOrder === 'manual' ? 'time' : sortOrder;
      const nextManualOrder = normalizeManualOrder(
        manualOrder.length > 0 ? manualOrder : getSortedMediaIds(sortableFiles, baselineSort),
        sortableFiles,
      );
      // Entering manual mode should not immediately persist and refresh the parent list.
      // We only want to save after the user actually reorders files.
      isRestoringOrder.current = true;
      setManualOrder(nextManualOrder);
      lastSortFingerprint.current = nextManualOrder.join(',');
      hasPendingManualOrder.current = false;
    }

    setSortOrderRaw(nextSortOrder);
    if (nextSortOrder !== 'manual') {
      setIsDragMode(false);
      setSelectedFiles(new Set());
    }
  }, [getSortableFiles, manualOrder, setSelectedFiles, sortOrder]);

  const toggleDragMode = useCallback(() => {
    if (sortOrder !== 'manual') {
      return;
    }

    setIsDragMode((current) => !current);
    setSelectedFiles(new Set());
  }, [setSelectedFiles, sortOrder]);

  const handleManualOrderChange = useCallback(
    (contextFiles: MediaFile[], nextContextOrder: string[], separateExtras = true) => {
      const sortableFiles = getSortableFiles();
      const normalizedGlobalOrder = normalizeManualOrder(manualOrder, sortableFiles);
      const contextFileMap = new Map(contextFiles.map((file) => [file.id, file]));
      const contextRegularIds = normalizeManualOrder(
        normalizedGlobalOrder.filter((id) => contextFileMap.has(id)),
        contextFiles,
      ).filter((id) => !(separateExtras && contextFileMap.get(id)?.isExtra));

      if (contextRegularIds.length === 0) {
        return;
      }

      const visibleReorderedIds = nextContextOrder.filter((id) => contextRegularIds.includes(id));
      if (visibleReorderedIds.length === 0) {
        return;
      }

      const visibleIdSet = new Set(visibleReorderedIds);
      const visibleQueue = [...visibleReorderedIds];
      const reorderedContextIds = contextRegularIds.map((id) => (visibleIdSet.has(id) ? visibleQueue.shift() || id : id));
      const contextRegularIdSet = new Set(contextRegularIds);
      const reorderedQueue = [...reorderedContextIds];
      const nextGlobalOrder = normalizedGlobalOrder.map((id) =>
        contextRegularIdSet.has(id) ? reorderedQueue.shift() || id : id,
      );

      hasPendingManualOrder.current = true;
      setManualOrder(nextGlobalOrder);
    },
    [getSortableFiles, manualOrder],
  );

  const {
    handleDirectDrop,
    handleTabDragEnter,
    handleTabDragLeave,
    handleTabDragOver,
    handleAiEdit,
    handleDownload,
    handleManualDownload,
    closeDownloadPopup,
    handleEditorDownloadRaw,
    handleGenerateShareLink,
    handleDeleteFiles,
    handleReclassify,
    toggleFileHidden,
    handleToggleFavorite,
    handleAddComment,
    handleDownloadSingleFile,
  } = useShootMediaActions({
    shoot,
    isAdmin,
    isClient,
    role,
    displayTab,
    selectedFiles,
    setSelectedFiles,
    selectedEditingType,
    setShowAiEditDialog,
    setSubmittingAiEdit,
    setDownloading,
    setDownloadPopup,
    setActiveSubTab,
    setDisplayTab,
    rawFiles,
    editedFiles: isClient ? clientVisibleEditedFiles : editedFiles,
    setRawFiles,
    setEditedFiles,
    showUploadTab,
    onShootUpdate,
    queryClient,
    toast,
    trackUpload,
    dragCounterRef,
    setDragOverTab,
  });
  const normalizedRole = String(role || '').trim().toLowerCase();
  const isSalesRep = ['salesrep', 'rep', 'representative'].includes(normalizedRole);
  const canInteractSingleMedia = isClient || ['admin', 'superadmin', 'editing_manager', 'salesRep', 'rep', 'representative'].includes(role || '');
  const canDownloadSingleMedia =
    isAdmin ||
    isPhotographer ||
    (isEditor && displayTab === 'uploaded') ||
    (isClient && !effectiveClientReleaseLocked);
  const canDownloadSingleMediaInActiveTab =
    canDownloadSingleMedia || (isSalesRep && displayTab === 'edited');
  const canDownloadViewerSingleMedia =
    isAdmin ||
    isPhotographer ||
    (isEditor && viewerSourceTab === 'uploaded') ||
    (isClient && !effectiveClientReleaseLocked) ||
    (isSalesRep && viewerSourceTab === 'edited');
  const canViewFullSizeMedia =
    isAdmin || isEditor || isPhotographer || (isClient && !effectiveClientReleaseLocked);
  const editedSlideshowFiles = useMemo(() => {
    const eligibleFiles = clientVisibleEditedFiles.filter((file) => {
      if (!isPreviewableImage(file) || isVideoFile(file)) {
        return false;
      }

      return Boolean(getMediaViewerImageUrl(file));
    });

    return sortMediaFiles(eligibleFiles, sortOrder, manualOrder);
  }, [clientVisibleEditedFiles, isVideoFile, manualOrder, sortOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        `media-grid-order-${shoot.id}`,
        JSON.stringify(editedSlideshowFiles.map((file) => file.id)),
      );
    } catch {
      return;
    }
  }, [editedSlideshowFiles, shoot.id]);

  const canStartSlideshowMedia =
    (isAdmin || isEditor || isPhotographer || (isClient && !effectiveClientReleaseLocked)) &&
    editedSlideshowFiles.length > 1;
  const currentViewerFile = viewerFiles[viewerIndex] ?? null;
  const viewerMatchesEditedSlideshow = useMemo(() => {
    if (!currentViewerFile) {
      return false;
    }

    const currentId = String(currentViewerFile.id || '');
    if (currentId && editedSlideshowFiles.some((file) => String(file.id) === currentId)) {
      return true;
    }

    const currentName = getDisplayMediaFilename(currentViewerFile).trim().toLowerCase();
    if (!currentName) {
      return false;
    }

    return editedSlideshowFiles.some(
      (file) => getDisplayMediaFilename(file).trim().toLowerCase() === currentName,
    );
  }, [currentViewerFile, editedSlideshowFiles]);
  const viewerHasEditedSlideshowContext = viewerSourceTab === 'edited' || viewerMatchesEditedSlideshow;

  const mediaShoot = shoot as ShootMediaTabSource;
  const normalizedShootStatus = String(shoot?.workflowStatus || mediaShoot.status || '').toLowerCase();
  const normalizeClientProgressStatus = (value: string) => {
    const statusKey = String(value || '').toLowerCase();
    const aliases: Record<string, ClientProgressStageKey> = {
      requested: 'requested',
      approved: 'scheduled',
      scheduled: 'scheduled',
      booked: 'scheduled',
      raw_upload_pending: 'scheduled',
      raw_uploaded: 'editing',
      raw_issue: 'editing',
      photos_uploaded: 'editing',
      in_progress: 'editing',
      completed: 'editing',
      uploaded: 'editing',
      editing: 'editing',
      editing_uploaded: 'editing',
      editing_complete: 'editing',
      pending_review: 'editing',
      ready_for_review: 'editing',
      review: 'editing',
      qc: 'editing',
      ready: 'ready',
      delivered: 'ready',
      ready_for_client: 'ready',
      admin_verified: 'ready',
      client_delivered: 'ready',
      workflow_completed: 'ready',
      finalized: 'ready',
    };

    return aliases[statusKey] || 'scheduled';
  };

  const rawMediaCount = Number(
    shoot?.rawPhotoCount ??
      mediaShoot.raw_photo_count ??
      shoot?.mediaSummary?.rawUploaded ??
      rawFiles.length ??
      0,
  );
  const editedMediaCount = Number(
    shoot?.editedPhotoCount ??
      mediaShoot.edited_photo_count ??
      shoot?.mediaSummary?.editedUploaded ??
      clientVisibleEditedFiles.length ??
      0,
  );
  const progressStatus = normalizeClientProgressStatus(normalizedShootStatus);
  const hasUploadedMedia = rawMediaCount > 0 || rawFiles.length > 0;
  const hasEditedMedia = editedMediaCount > 0 || clientVisibleEditedFiles.length > 0;
  const hasReviewSignal = Boolean(shoot?.submittedForReviewAt) || hasEditedMedia;

  const REVIEW_SUBMITTED_STATUSES = ['pending_review', 'ready_for_review', 'qc', 'review', 'ready'];
  const isSubmittedForReview =
    Boolean(shoot?.submittedForReviewAt) ||
    REVIEW_SUBMITTED_STATUSES.some(status => normalizedShootStatus.includes(status));

  // Determine if delete is allowed (before delivered status - admin, photographer, editor can delete)
  // Superadmin can always delete, even after delivery
  const DELIVERED_STATUSES = ['delivered', 'client_delivered', 'workflow_completed', 'finalized'];
  const isDelivered = DELIVERED_STATUSES.some(status => normalizedShootStatus.includes(status));
  const isSuperAdmin = role === 'superadmin';
  const canDelete =
    isSuperAdmin ||
    ((isAdmin || isPhotographer) && !isDelivered) ||
    (isEditor && !isDelivered && !isSubmittedForReview);
  const editorRestrictedToEditedTab = isEditor;
  const canUploadInDisplayTab = showUploadTab && (!editorRestrictedToEditedTab || displayTab === 'edited');
  const canDeleteInDisplayTab = canDelete && (!editorRestrictedToEditedTab || displayTab === 'edited');
  const canSelectInDisplayTab = canDownload || canDeleteInDisplayTab;
  const activeShootUploads = useMemo(
    () => uploads.filter((upload) => upload.shootId === String(shoot.id) && upload.status === 'uploading'),
    [shoot.id, uploads],
  );
  const isScheduledShoot = normalizedShootStatus === 'scheduled' || normalizedShootStatus === 'booked';
  const hasAnyMedia = rawFiles.length > 0 || editedFiles.length > 0;

  // Determine if shoot is finalized (client can view photos)
  const FINALIZED_STATUSES = ['admin_verified', 'delivered', 'client_delivered', 'ready_for_client', 'workflow_completed', 'finalized'];
  const isShootFinalized = FINALIZED_STATUSES.some(status => normalizedShootStatus.includes(status));

  useEffect(() => {
    if (canSelectInDisplayTab || selectedFiles.size === 0) {
      return;
    }

    setSelectedFiles(new Set());
  }, [canSelectInDisplayTab, selectedFiles.size, setSelectedFiles]);
  
  // Calculate progress for non-finalized shoots (for client progress indicator)
  const clientProgress = useMemo(() => {
    const isAwaitingRequestConfirmation = progressStatus === 'requested';
    const steps = isAwaitingRequestConfirmation
      ? CLIENT_PROGRESS_STEPS
      : CLIENT_PROGRESS_STEPS
          .filter((step) => step.key !== 'requested')
          .map((step) => step.key === 'scheduled' ? { ...step, percent: 10 } : step);

    let stageKey: ClientProgressStageKey = isAwaitingRequestConfirmation ? 'requested' : 'scheduled';

    if (isShootFinalized || progressStatus === 'ready') {
      stageKey = 'ready';
    } else if (progressStatus === 'editing' || hasReviewSignal) {
      stageKey = 'editing';
    } else if (hasUploadedMedia) {
      stageKey = 'editing';
    }

    return {
      ...(steps.find((step) => step.key === stageKey) ?? steps[0]),
      steps,
    };
  }, [
    hasReviewSignal,
    hasUploadedMedia,
    isShootFinalized,
    progressStatus,
  ]);


  const renderMediaGridPane = (
    files: MediaFile[],
    emptyTitle: string,
    emptyDescription: string,
    uploadLabel = 'Upload Files',
    separateExtras = true,
  ) => {
    if (files.length === 0) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
            <div className="relative mb-6">
              <div className="h-28 w-28 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-muted dark:bg-slate-800/80 flex items-center justify-center">
                  <CloudUpload className="h-10 w-10 text-primary" />
                </div>
              </div>
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{emptyTitle}</h3>
            <p className="text-sm text-muted-foreground mb-6">{emptyDescription}</p>
            {canUploadInDisplayTab && (
              <Button
                type="button"
                variant="default"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setActiveSubTab('upload')}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadLabel}
              </Button>
            )}
          </div>
        </div>
      );
    }

    const rawStackSize = Number(shoot.bracketMode ?? shoot.package?.bracketMode ?? 0);

    return (
      <div className="relative h-full m-0 sm:mx-0 sm:my-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card">
        <div className={`h-full overflow-y-auto p-1 sm:p-2.5 ${canUploadInDisplayTab ? 'pb-20 sm:pb-2.5' : ''}`}>
          <MediaGrid
            files={files}
            onFileClick={(index, sorted) => openViewerWithSource(index, sorted, displayTab)}
            selectedFiles={selectedFiles}
            onSelectionChange={toggleSelection}
            onSelectAll={() => {
              if (!canSelectInDisplayTab) {
                return;
              }

              if (selectedFiles.size === files.length) {
                setSelectedFiles(new Set());
              } else {
                setSelectedFiles(new Set(files.map((f) => f.id)));
              }
            }}
            canSelect={canSelectInDisplayTab}
            sortOrder={sortOrder}
            manualSortActive={isDragMode}
            manualOrder={manualOrder}
            onManualOrderChange={(nextOrder) => handleManualOrderChange(files, nextOrder, separateExtras)}
            getImageUrl={getImageUrl}
            getSrcSet={getSrcSet}
            isImage={isPreviewableImage}
            isVideo={isVideoFile}
            viewMode={mediaViewMode}
            isClient={isClient}
            toggleFileHidden={toggleFileHidden}
            separateExtras={separateExtras}
            canInteractSingleMedia={canInteractSingleMedia}
            canDownloadSingleMedia={canDownloadSingleMediaInActiveTab}
            onToggleFavorite={handleToggleFavorite}
            onAddComment={handleAddComment}
            onDownloadSingle={canDownloadSingleMediaInActiveTab ? handleDownloadSingleFile : undefined}
            enableRawStacks={displayTab === 'uploaded'}
            rawStackSize={Number.isFinite(rawStackSize) && rawStackSize > 1 ? rawStackSize : null}
          />
        </div>
        {canUploadInDisplayTab && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-3 pt-8 sm:hidden">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="pointer-events-auto h-9 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
              onClick={() => setActiveSubTab('upload')}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload More
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Get current files based on active tab
  const currentFiles = activeSubTab === 'uploaded' ? rawFiles : editedFiles;

  const AdminUploadSection = ({
    shoot,
    onUploadComplete,
    onEditedUploadComplete,
    uploadContext,
  }: {
    shoot: ShootData;
    onUploadComplete: () => void;
    onEditedUploadComplete: () => void;
    uploadContext: 'raw' | 'edited';
  }) => {
    if (uploadContext === 'edited') {
      return (
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="text-sm text-muted-foreground mb-4">
            Upload final, edited files ready for client delivery. Supported formats: JPG, PNG (photos){shootHasVideoService ? ', MP4 (videos)' : ''}.
          </div>
          <EditedUploadSection
            shoot={shoot}
            onUploadComplete={onEditedUploadComplete}
            isEditor={isEditor}
            editedFiles={editedFiles}
            showInlineProgress={false}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4 flex-1 flex flex-col min-h-0">
        <RawUploadSection shoot={shoot} onUploadComplete={onUploadComplete} showInlineProgress={false} />
      </div>
    );
  };
  // Show "Work in Progress" UI for clients when shoot is not finalized
  if (isClient && !isShootFinalized && !hasClientUnlockedServiceDelivery) {
    const progress = clientProgress.percent;
    const progressLabel = clientProgress.label;
    
    return (
      <div className="flex flex-col h-full min-h-0 bg-background px-3 sm:px-4 lg:px-6 items-center justify-center" style={{ height: '100%', minHeight: '300px' }}>
        <div className="flex flex-col items-center justify-center max-w-md text-center space-y-6 py-12">
          {/* Animated icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
            </div>
          </div>
          
          {/* Title and description */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Work in Progress</h3>
            <p className="text-sm text-muted-foreground">
              {clientProgress.description}
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Status steps */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              {clientProgress.steps.map((step) => (
                <div key={step.key} className={`flex flex-col items-center gap-1 ${progress >= step.percent ? 'text-primary' : ''}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${progress >= step.percent ? 'bg-primary' : 'bg-muted'}`} />
                  <span>{step.stageLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ShootDetailsMediaTabView
        downloadPopup={downloadPopup}
        handleManualDownload={handleManualDownload}
        closeDownloadPopup={closeDownloadPopup}
        activeSubTab={activeSubTab}
        displayTab={displayTab}
        defaultTab={defaultTab}
        isClient={isClient}
        isPhotographer={isPhotographer}
        rawFiles={rawFiles}
        editedFiles={clientVisibleEditedFiles}
        setActiveSubTab={setActiveSubTab}
        setDisplayTab={setDisplayTab}
        mediaViewMode={mediaViewMode}
        toggleMediaViewMode={toggleMediaViewMode}
        isEditor={isEditor}
        sortOrder={sortOrder}
        isDragMode={isDragMode}
        sortSaveStatus={sortSaveStatus}
        changeSortOrder={changeSortOrder}
        toggleDragMode={toggleDragMode}
        activeShootUploads={activeShootUploads}
        showUploadTab={canUploadInDisplayTab}
        selectedFiles={selectedFiles}
        setRequestManagerOpen={setRequestManagerOpen}
        downloading={downloading}
        handleDownload={handleDownload}
        handleDeleteFiles={handleDeleteFiles}
        handleGenerateShareLink={handleGenerateShareLink}
        handleEditorDownloadRaw={handleEditorDownloadRaw}
        canDelete={canDeleteInDisplayTab}
        canDownload={canDownload}
        isAdmin={isAdmin}
        handleReclassify={handleReclassify}
        markMenuOptions={markMenuOptions}
        directUploading={directUploading}
        directUploadCompleted={directUploadCompleted}
        directUploadTotal={directUploadTotal}
        directUploadProgress={directUploadProgress}
        dragOverTab={dragOverTab}
        handleTabDragEnter={handleTabDragEnter}
        handleTabDragLeave={handleTabDragLeave}
        handleTabDragOver={handleTabDragOver}
        handleDirectDrop={handleDirectDrop}
        uploadedMediaTab={uploadedMediaTab}
        setUploadedMediaTab={setUploadedMediaTab}
        uploadedPhotos={uploadedPhotos}
        uploadedVideos={uploadedVideos}
        shootHasVideoService={shootHasVideoService}
        iguideUrl={iguideUrl}
        iguideFloorplans={iguideFloorplans}
        uploadedFloorplans={uploadedFloorplans}
        uploadedVirtualStaging={uploadedVirtualStaging}
        uploadedGreenGrass={uploadedGreenGrass}
        uploadedTwilight={uploadedTwilight}
        uploadedDrone={uploadedDrone}
        uploadedExtras={uploadedExtras}
        renderMediaGridPane={renderMediaGridPane}
        AdminUploadSection={AdminUploadSection}
        shoot={shoot}
        toast={toast}
        queryClient={queryClient}
        onShootUpdate={onShootUpdate}
        clientEditedMediaTabs={clientEditedMediaTabs}
        editedMediaTab={editedMediaTab}
        setEditedMediaTab={setEditedMediaTab}
        editedPhotos={editedPhotos}
        editedVideos={editedVideos}
        editedFloorplans={editedFloorplans}
        editedVirtualStaging={editedVirtualStaging}
        editedGreenGrass={editedGreenGrass}
        editedTwilight={editedTwilight}
        editedDrone={editedDrone}
        editedExtras={editedExtras}
        openViewer={openViewerWithSource}
        toggleSelection={toggleSelection}
        setSelectedFiles={setSelectedFiles}
        manualOrder={manualOrder}
        handleManualOrderChange={handleManualOrderChange}
        getImageUrl={getImageUrl}
        getSrcSet={getSrcSet}
        isPreviewableImage={isPreviewableImage}
        isVideoFile={isVideoFile}
        toggleFileHidden={toggleFileHidden}
      />
      <ShootDetailsMediaTabDialogs
        viewerOpen={viewerOpen}
        setViewerOpen={setViewerOpen}
        viewerFiles={viewerFiles}
        viewerIndex={viewerIndex}
        setViewerIndex={setViewerIndex}
        setViewerFiles={setViewerFiles}
        getImageUrl={getImageUrl}
        getSrcSet={getSrcSet}
        shoot={shoot}
        isAdmin={isAdmin}
        isClient={isClient}
        canViewFullSize={canViewFullSizeMedia}
        canStartSlideshow={canStartSlideshowMedia && viewerHasEditedSlideshowContext}
        slideshowFiles={viewerHasEditedSlideshowContext ? editedSlideshowFiles : []}
        onShootUpdate={onShootUpdate}
        canInteractSingleMedia={canInteractSingleMedia}
        canDownloadSingleMedia={canDownloadViewerSingleMedia}
        onToggleFavorite={handleToggleFavorite}
        onAddComment={handleAddComment}
        onToggleHidden={toggleFileHidden}
        onDownloadSingle={canDownloadViewerSingleMedia ? handleDownloadSingleFile : undefined}
        showAiEditDialog={showAiEditDialog}
        setShowAiEditDialog={setShowAiEditDialog}
        selectedFiles={selectedFiles}
        editingTypes={editingTypes}
        selectedEditingType={selectedEditingType}
        setSelectedEditingType={setSelectedEditingType}
        submittingAiEdit={submittingAiEdit}
        handleAiEdit={handleAiEdit}
        requestManagerOpen={requestManagerOpen}
        setRequestManagerOpen={setRequestManagerOpen}
        isPhotographer={isPhotographer}
        isEditor={isEditor}
        setSelectedFiles={setSelectedFiles}
      />
    </>
  );
}

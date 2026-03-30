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
import { fotelloService, type EditingType } from '@/services/fotelloService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isRawFile } from '@/services/rawPreviewService';
import { useShootFiles, type MediaFile } from '@/hooks/useShootFiles';
import { useQueryClient } from '@tanstack/react-query';
import { ShootIssueManager } from '../ShootIssueManager';
import { UploadDropzone, UploadProgressCard } from './MediaUploadPanels';
import { MediaGrid } from './MediaGrid';
import { MediaViewer } from './MediaViewer';
import { getMediaImageUrl as getImageUrl, getMediaSrcSet as getSrcSet, isPreviewableImage } from './mediaPreviewUtils';
import VideoThumbnail from '../../VideoThumbnail';
import { getServicePricingForSqft } from '@/utils/servicePricing';
import { EditedUploadSection, RawUploadSection } from './MediaUploadSections';
import { useShootMediaSelectionState } from './useShootMediaSelectionState';
import { useShootMediaDerivedData } from './useShootMediaDerivedData';
import { getSortedMediaIds, normalizeManualOrder, type MediaSortOrder } from './mediaSort';
import { getPreferredMlsTourLink } from '@/utils/shootTourData';
import { markMenuOptions, useShootMediaActions, type DownloadPopupState } from './useShootMediaActions';
import { ShootDetailsMediaTabView } from './ShootDetailsMediaTabView';
import { ShootDetailsMediaTabDialogs } from './ShootDetailsMediaTabDialogs';

interface ShootDetailsMediaTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  role: string;
  onShootUpdate: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  showHidden?: boolean;
  onShowHiddenChange?: (val: boolean) => void;
}

type MediaSubTab = 'photos' | 'videos' | 'iguide' | 'floorplans' | 'virtualStaging' | 'extras';

type ShootMediaTabSource = ShootData & {
  editor_notes?: string;
  editorNotes?: string;
  status?: string;
  raw_photo_count?: number;
  edited_photo_count?: number;
};

// MediaFile interface is imported from useShootFiles hook

export function useShootDetailsMediaTab({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  role,
  onShootUpdate,
  isExpanded = false,
  onToggleExpand,
  onSelectionChange,
  showHidden = false,
  onShowHiddenChange,
}: ShootDetailsMediaTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { trackUpload } = useUpload();
  // Default tab based on role: clients see edited, others see uploaded
  const defaultTab = isClient ? 'edited' : 'uploaded';
  const [activeSubTab, setActiveSubTab] = useState<'uploaded' | 'edited' | 'upload'>(defaultTab);
  const [displayTab, setDisplayTab] = useState<'uploaded' | 'edited'>(defaultTab);
  const [uploadedMediaTab, setUploadedMediaTab] = useState<MediaSubTab>('photos');
  const [editedMediaTab, setEditedMediaTab] = useState<MediaSubTab>('photos');
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
  const {
    uploadedPhotos,
    uploadedVideos,
    editedPhotos,
    editedVideos,
    uploadedFloorplans,
    editedFloorplans,
    uploadedVirtualStaging,
    editedVirtualStaging,
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
    editedFiles,
    displayTab,
    uploadedMediaTab,
    editedMediaTab,
    isAdmin,
    isPhotographer,
    isEditor,
    isClient,
  });
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

  useEffect(() => {
    if (!viewerOpen || viewerFiles.length === 0) {
      return;
    }

    const allFiles = [...rawFiles, ...editedFiles];
    const nextViewerFiles = viewerFiles.map((file) => allFiles.find((candidate) => candidate.id === file.id) ?? file);
    const hasChanged = nextViewerFiles.some((file, index) => file !== viewerFiles[index]);
    if (hasChanged) {
      setViewerFiles(nextViewerFiles);
    }
  }, [editedFiles, rawFiles, setViewerFiles, viewerFiles, viewerOpen]);

  // Load editing types - only for admin/editor users (clients don't have access)
  const canAccessFotello = ['admin', 'superadmin', 'editing_manager', 'editor'].includes(role || '');
  
  useEffect(() => {
    if (!canAccessFotello) return;
    
    const loadEditingTypes = async () => {
      try {
        const types = await fotelloService.getEditingTypes();
        setEditingTypes(types);
        if (types.length > 0) {
          setSelectedEditingType(types[0].id);
        }
      } catch (error) {
        // Silently fail - editing types are optional and may not be configured
      }
    };
    loadEditingTypes();
  }, [canAccessFotello]);

  // Load files using React Query hooks for deduplication and caching
  const rawFilesEnabled = Boolean(shoot.id) && !isClient;
  const { data: rawFilesData = [], isLoading: rawLoading } = useShootFiles(shoot.id, 'raw', {
    enabled: rawFilesEnabled,
  });
  const { data: editedFilesData = [], isLoading: editedLoading } = useShootFiles(shoot.id, 'edited', {
    enabled: Boolean(shoot.id),
  });

  const buildFilesFingerprint = (files: MediaFile[]) => JSON.stringify(
    files.map((f) => ({
      id: f.id,
      url: f.url,
      path: f.path,
      mt: f.media_type,
      workflowStage: f.workflowStage,
      thumb: f.thumb,
      medium: f.medium,
      large: f.large,
      original: f.original,
      thumbnail_path: f.thumbnail_path,
      web_path: f.web_path,
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
  const getAllFiles = useCallback(() => [...rawFiles, ...editedFiles], [editedFiles, rawFiles]);
  const getSortableFiles = useCallback(
    () => (isClient ? [...editedFiles] : [...rawFiles, ...editedFiles]),
    [editedFiles, isClient, rawFiles],
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
    editedFiles,
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
  const canInteractSingleMedia = isClient || ['admin', 'superadmin', 'editing_manager', 'salesRep', 'rep', 'representative'].includes(role || '');

  const mediaShoot = shoot as ShootMediaTabSource;
  const normalizedShootStatus = String(shoot?.workflowStatus || mediaShoot.status || '').toLowerCase();
  const normalizeClientProgressStatus = (value: string) => {
    const statusKey = String(value || '').toLowerCase();
    const aliases: Record<string, 'scheduled' | 'uploaded' | 'editing' | 'review' | 'ready'> = {
      requested: 'scheduled',
      approved: 'scheduled',
      booked: 'scheduled',
      raw_upload_pending: 'scheduled',
      raw_uploaded: 'uploaded',
      raw_issue: 'uploaded',
      photos_uploaded: 'uploaded',
      in_progress: 'uploaded',
      completed: 'uploaded',
      editing_uploaded: 'review',
      editing_complete: 'review',
      pending_review: 'review',
      ready_for_review: 'review',
      review: 'review',
      qc: 'review',
      ready: 'review',
      delivered: 'ready',
      ready_for_client: 'ready',
      admin_verified: 'ready',
      client_delivered: 'ready',
      workflow_completed: 'ready',
      finalized: 'ready',
    };

    return aliases[statusKey] || statusKey;
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
      editedFiles.length ??
      0,
  );
  const progressStatus = normalizeClientProgressStatus(normalizedShootStatus);
  const hasUploadedMedia = rawMediaCount > 0 || rawFiles.length > 0;
  const hasEditedMedia = editedMediaCount > 0 || editedFiles.length > 0;
  const hasReviewSignal = Boolean(shoot?.submittedForReviewAt) || hasEditedMedia;

  // Determine if delete is allowed (before delivered status - admin, photographer, editor can delete)
  // Superadmin can always delete, even after delivery
  const DELIVERED_STATUSES = ['delivered', 'client_delivered', 'workflow_completed', 'finalized'];
  const isDelivered = DELIVERED_STATUSES.some(status => normalizedShootStatus.includes(status));
  const isSuperAdmin = role === 'superadmin';
  const canDelete = isSuperAdmin || ((isAdmin || isPhotographer || isEditor) && !isDelivered);
  const isScheduledShoot = normalizedShootStatus === 'scheduled' || normalizedShootStatus === 'booked';
  const hasAnyMedia = rawFiles.length > 0 || editedFiles.length > 0;

  // Determine if shoot is finalized (client can view photos)
  const FINALIZED_STATUSES = ['admin_verified', 'delivered', 'client_delivered', 'ready_for_client', 'workflow_completed', 'finalized'];
  const isShootFinalized = FINALIZED_STATUSES.some(status => normalizedShootStatus.includes(status));
  
  // Calculate progress for non-finalized shoots (for client progress indicator)
  const clientProgress = useMemo(() => {
    const steps = [
      {
        key: 'scheduled',
        label: normalizedShootStatus.includes('requested') ? 'Awaiting confirmation' : 'Shoot scheduled',
        description: normalizedShootStatus.includes('requested')
          ? "We're waiting for your shoot request to be confirmed."
          : 'Your shoot is booked and waiting for the next workflow update.',
        percent: 10,
      },
      {
        key: 'uploaded',
        label: 'Photos uploaded',
        description: 'The photographer has uploaded the media and it is moving into production.',
        percent: 30,
      },
      {
        key: 'editing',
        label: 'Editing in progress',
        description: 'Your photos are currently being edited.',
        percent: 50,
      },
      {
        key: 'review',
        label: 'In review',
        description: 'Edited files are uploaded and waiting for final admin review.',
        percent: 75,
      },
      {
        key: 'ready',
        label: 'Ready',
        description: "Everything is complete and your shoot is ready.",
        percent: 100,
      },
    ] as const;

    let stageKey: typeof steps[number]['key'] = 'scheduled';

    if (isShootFinalized || progressStatus === 'ready') {
      stageKey = 'ready';
    } else if (progressStatus === 'review' || hasReviewSignal) {
      stageKey = 'review';
    } else if (progressStatus === 'editing') {
      stageKey = 'editing';
    } else if (progressStatus === 'uploaded' || hasUploadedMedia) {
      stageKey = 'uploaded';
    }

    return steps.find((step) => step.key === stageKey) ?? steps[0];
  }, [
    hasReviewSignal,
    hasUploadedMedia,
    isShootFinalized,
    normalizedShootStatus,
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
            {showUploadTab && (
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

    return (
      <div className="h-full m-0 sm:m-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card overflow-y-auto p-1 sm:p-2.5">
        <MediaGrid
          files={files}
          onFileClick={(index, sorted) => openViewer(index, sorted)}
          selectedFiles={selectedFiles}
          onSelectionChange={toggleSelection}
          onSelectAll={() => {
            if (selectedFiles.size === files.length) {
              setSelectedFiles(new Set());
            } else {
              setSelectedFiles(new Set(files.map((f) => f.id)));
            }
          }}
          canSelect={canDownload}
          sortOrder={sortOrder}
          manualSortActive={isDragMode}
          manualOrder={manualOrder}
          onManualOrderChange={(nextOrder) => handleManualOrderChange(files, nextOrder, separateExtras)}
          getImageUrl={getImageUrl}
          getSrcSet={getSrcSet}
          isImage={isPreviewableImage}
          isVideo={isVideoFile}
          viewMode={mediaViewMode}
          showHidden={showHidden}
          isClient={isClient}
          toggleFileHidden={toggleFileHidden}
          separateExtras={separateExtras}
          canInteractSingleMedia={canInteractSingleMedia}
          onToggleFavorite={handleToggleFavorite}
          onAddComment={handleAddComment}
          onDownloadSingle={handleDownloadSingleFile}
        />
        {showUploadTab && (
          <div className="sm:hidden sticky bottom-2 z-20 flex justify-center pointer-events-none mt-2 pb-2">
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
          <EditedUploadSection shoot={shoot} onUploadComplete={onEditedUploadComplete} isEditor={isEditor} />
        </div>
      );
    }

    return (
      <div className="space-y-4 flex-1 flex flex-col min-h-0">
        <div className="text-sm text-muted-foreground mb-4">
          Upload RAW, unedited files for processing. Supported formats: JPG, PNG, TIFF, NEF, CR2, CR3, ARW, DNG (photos){shootHasVideoService ? ', MP4, MOV (videos)' : ''}.
        </div>
        <RawUploadSection shoot={shoot} onUploadComplete={onUploadComplete} />
      </div>
    );
  };
  // Show "Work in Progress" UI for clients when shoot is not finalized
  if (isClient && !isShootFinalized) {
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
              <div className={`flex flex-col items-center gap-1 ${progress >= 10 ? 'text-primary' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${progress >= 10 ? 'bg-primary' : 'bg-muted'}`} />
                <span>Scheduled</span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${progress >= 30 ? 'text-primary' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${progress >= 30 ? 'bg-primary' : 'bg-muted'}`} />
                <span>Uploaded</span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${progress >= 50 ? 'text-primary' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${progress >= 50 ? 'bg-primary' : 'bg-muted'}`} />
                <span>Editing</span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${progress >= 75 ? 'text-primary' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${progress >= 75 ? 'bg-primary' : 'bg-muted'}`} />
                <span>Review</span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${progress >= 100 ? 'text-primary' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${progress >= 100 ? 'bg-primary' : 'bg-muted'}`} />
                <span>Ready</span>
              </div>
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
        editedFiles={editedFiles}
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
        showUploadTab={showUploadTab}
        selectedFiles={selectedFiles}
        setRequestManagerOpen={setRequestManagerOpen}
        downloading={downloading}
        handleDownload={handleDownload}
        handleDeleteFiles={handleDeleteFiles}
        handleGenerateShareLink={handleGenerateShareLink}
        handleEditorDownloadRaw={handleEditorDownloadRaw}
        canDelete={canDelete}
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
        uploadedExtras={uploadedExtras}
        renderMediaGridPane={renderMediaGridPane}
        AdminUploadSection={AdminUploadSection}
        shoot={shoot}
        toast={toast}
        queryClient={queryClient}
        onShootUpdate={onShootUpdate}
        editedMediaTab={editedMediaTab}
        setEditedMediaTab={setEditedMediaTab}
        editedPhotos={editedPhotos}
        editedVideos={editedVideos}
        editedFloorplans={editedFloorplans}
        editedVirtualStaging={editedVirtualStaging}
        editedExtras={editedExtras}
        openViewer={openViewer}
        toggleSelection={toggleSelection}
        setSelectedFiles={setSelectedFiles}
        manualOrder={manualOrder}
        handleManualOrderChange={handleManualOrderChange}
        getImageUrl={getImageUrl}
        getSrcSet={getSrcSet}
        isPreviewableImage={isPreviewableImage}
        isVideoFile={isVideoFile}
        showHidden={showHidden}
        toggleFileHidden={toggleFileHidden}
      />
      <ShootDetailsMediaTabDialogs
        viewerOpen={viewerOpen}
        setViewerOpen={setViewerOpen}
        viewerFiles={viewerFiles}
        viewerIndex={viewerIndex}
        setViewerIndex={setViewerIndex}
        getImageUrl={getImageUrl}
        getSrcSet={getSrcSet}
        shoot={shoot}
        isAdmin={isAdmin}
        isClient={isClient}
        onShootUpdate={onShootUpdate}
        canInteractSingleMedia={canInteractSingleMedia}
        onToggleFavorite={handleToggleFavorite}
        onAddComment={handleAddComment}
        onToggleHidden={toggleFileHidden}
        onDownloadSingle={handleDownloadSingleFile}
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

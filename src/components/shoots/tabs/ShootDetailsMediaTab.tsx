import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
// FileUploader import removed - using RawUploadSection and EditedUploadSection instead
import { useAuth } from '@/components/auth/AuthProvider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { fotelloService, type EditingType } from '@/services/fotelloService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isRawFile } from '@/services/rawPreviewService';
import { useShootFiles, type MediaFile } from '@/hooks/useShootFiles';
import { useQueryClient } from '@tanstack/react-query';
import { ShootIssueManager } from './ShootIssueManager';

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
}

type MediaSubTab = 'photos' | 'videos' | 'iguide' | 'floorplans';

// MediaFile interface is imported from useShootFiles hook

export function ShootDetailsMediaTab({
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
}: ShootDetailsMediaTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Default tab based on role: clients see edited, others see uploaded
  const defaultTab = isClient ? 'edited' : 'uploaded';
  const [activeSubTab, setActiveSubTab] = useState<'uploaded' | 'edited' | 'upload'>(defaultTab);
  const [displayTab, setDisplayTab] = useState<'uploaded' | 'edited'>(defaultTab);
  const [uploadedMediaTab, setUploadedMediaTab] = useState<MediaSubTab>('photos');
  const [editedMediaTab, setEditedMediaTab] = useState<MediaSubTab>('photos');
  const [rawFiles, setRawFiles] = useState<MediaFile[]>([]);
  const [editedFiles, setEditedFiles] = useState<MediaFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerFiles, setViewerFiles] = useState<MediaFile[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [showAiEditDialog, setShowAiEditDialog] = useState(false);
  const [editingTypes, setEditingTypes] = useState<EditingType[]>([]);
  const [selectedEditingType, setSelectedEditingType] = useState<string>('');
  const [submittingAiEdit, setSubmittingAiEdit] = useState(false);
  const [sortOrder, setSortOrder] = useState<'name' | 'date' | 'time' | 'manual'>('time');
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [mediaViewMode, setMediaViewMode] = useState<'list' | 'grid'>(() => {
    try { return (localStorage.getItem('media-view-mode') as 'list' | 'grid') || 'list'; } catch { return 'list'; }
  });
  const toggleMediaViewMode = (mode: 'list' | 'grid') => {
    setMediaViewMode(mode);
    try { localStorage.setItem('media-view-mode', mode); } catch {}
  };
  const [requestManagerOpen, setRequestManagerOpen] = useState(false);

  useEffect(() => {
    if (isClient) {
      setActiveSubTab('edited');
      setDisplayTab('edited');
      setRawFiles([]);
      setSelectedFiles(new Set());
    }
  }, [isClient]);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedFiles));
    }
  }, [onSelectionChange, selectedFiles]);

  // Load editing types - only for admin/editor users (clients don't have access)
  const canAccessFotello = ['admin', 'superadmin', 'editor'].includes(role || '');
  
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

  // Update local state when data changes - use JSON.stringify to detect actual content changes
  // This prevents infinite loops from new array references with same content
  const rawFilesRef = useRef<string>('');
  useEffect(() => {
    const newRawFilesJson = JSON.stringify(rawFilesData.map(f => ({ id: f.id, url: f.url })));
    if (rawFilesRef.current !== newRawFilesJson) {
      rawFilesRef.current = newRawFilesJson;
      setRawFiles(rawFilesData);
    }
  }, [rawFilesData]);

  const editedFilesRef = useRef<string>('');
  useEffect(() => {
    const newEditedFilesJson = JSON.stringify(editedFilesData.map(f => ({ id: f.id, url: f.url })));
    if (editedFilesRef.current !== newEditedFilesJson) {
      editedFilesRef.current = newEditedFilesJson;
      setEditedFiles(editedFilesData);
    }
  }, [editedFilesData]);

  // Don't invalidate queries on every render - this causes infinite loops
  // The queries will automatically refetch when shoot.id changes due to React Query's queryKey
  // Only invalidate when explicitly needed (e.g., after file uploads)

  // Determine which tabs to show
  const showUploadTab = isAdmin || isPhotographer || isEditor;
  const canDownload = isAdmin || isClient || isEditor;

  // ── Drag-and-drop upload directly on tab content ──
  const [dragOverTab, setDragOverTab] = useState<'uploaded' | 'edited' | null>(null);
  const [directUploading, setDirectUploading] = useState(false);
  const [directUploadProgress, setDirectUploadProgress] = useState(0);
  const [directUploadTotal, setDirectUploadTotal] = useState(0);
  const [directUploadCompleted, setDirectUploadCompleted] = useState(0);
  const dragCounterRef = useRef(0);

  const handleDirectDrop = async (e: React.DragEvent<HTMLDivElement>, uploadType: 'raw' | 'edited') => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOverTab(null);

    if (!showUploadTab) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    setDirectUploading(true);
    setDirectUploadProgress(0);
    setDirectUploadTotal(files.length);
    setDirectUploadCompleted(0);

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];
    const CONCURRENT = 3;
    let completed = 0;
    const errors: string[] = [];

    const uploadOne = (file: File): Promise<{ success: boolean; error?: string }> =>
      new Promise((resolve) => {
        const fd = new FormData();
        const isVideo = isVideoUpload(file);
        fd.append('files[]', file);
        fd.append('upload_type', uploadType);
        if (isVideo) fd.append('service_category', 'video');

        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true });
          } else {
            let msg = 'Upload failed';
            try { msg = JSON.parse(xhr.responseText).message || msg; } catch {}
            resolve({ success: false, error: `${file.name}: ${msg}` });
          }
        });
        xhr.addEventListener('error', () => resolve({ success: false, error: `${file.name}: Network error` }));
        xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
        if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
        if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
        xhr.send(fd);
      });

    try {
      for (let i = 0; i < files.length; i += CONCURRENT) {
        const batch = files.slice(i, Math.min(i + CONCURRENT, files.length));
        const results = await Promise.all(batch.map(uploadOne));
        results.forEach((r) => {
          completed++;
          if (!r.success && r.error) errors.push(r.error);
        });
        setDirectUploadCompleted(completed);
        setDirectUploadProgress(Math.round((completed / files.length) * 100));
      }

      if (errors.length === files.length) {
        toast({ title: 'Upload Failed', description: 'All files failed to upload.', variant: 'destructive' });
      } else if (errors.length > 0) {
        toast({ title: 'Partial Success', description: `${files.length - errors.length}/${files.length} files uploaded.`, variant: 'destructive' });
      } else {
        toast({ title: 'Upload Complete', description: `${files.length} file(s) uploaded successfully.` });
      }

      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
      onShootUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Upload failed', variant: 'destructive' });
    } finally {
      setTimeout(() => {
        setDirectUploading(false);
        setDirectUploadProgress(0);
        setDirectUploadTotal(0);
        setDirectUploadCompleted(0);
      }, 600);
    }
  };

  const handleTabDragEnter = (e: React.DragEvent<HTMLDivElement>, tab: 'uploaded' | 'edited') => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (showUploadTab && e.dataTransfer.types.includes('Files')) {
      setDragOverTab(tab);
    }
  };

  const handleTabDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOverTab(null);
    }
  };

  const handleTabDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const normalizedShootStatus = String(shoot?.workflowStatus || (shoot as any)?.status || '').toLowerCase();
  
  // Determine if delete is allowed (before delivered status - admin, photographer, editor can delete)
  // Superadmin can always delete, even after delivery
  const DELIVERED_STATUSES = ['delivered', 'client_delivered', 'workflow_completed', 'finalized'];
  const isDelivered = DELIVERED_STATUSES.some(status => normalizedShootStatus.includes(status));
  const isSuperAdmin = role === 'superadmin';
  const canDelete = isSuperAdmin || ((isAdmin || isPhotographer || isEditor) && !isDelivered);
  const isScheduledShoot = normalizedShootStatus === 'scheduled' || normalizedShootStatus === 'booked';
  const hasAnyMedia = rawFiles.length > 0 || editedFiles.length > 0;

  // Determine if shoot is finalized (client can view photos)
  const FINALIZED_STATUSES = ['admin_verified', 'delivered', 'client_delivered', 'ready', 'workflow_completed', 'finalized'];
  const isShootFinalized = FINALIZED_STATUSES.some(status => normalizedShootStatus.includes(status));
  
  // Calculate progress for non-finalized shoots (for client progress indicator)
  const getShootProgress = () => {
    if (isShootFinalized) return 100;
    if (normalizedShootStatus.includes('scheduled') || normalizedShootStatus.includes('booked') || normalizedShootStatus.includes('requested')) return 10;
    if (normalizedShootStatus.includes('upload') || normalizedShootStatus.includes('raw')) return 30;
    if (normalizedShootStatus.includes('editing') || normalizedShootStatus.includes('in_progress')) return 50;
    if (normalizedShootStatus.includes('review') || normalizedShootStatus.includes('pending')) return 75;
    if (normalizedShootStatus.includes('complete')) return 90;
    return 25;
  };
  
  const getProgressLabel = () => {
    if (isShootFinalized) return 'Ready for download';
    if (normalizedShootStatus.includes('scheduled') || normalizedShootStatus.includes('booked')) return 'Shoot scheduled';
    if (normalizedShootStatus.includes('requested')) return 'Awaiting confirmation';
    if (normalizedShootStatus.includes('upload') || normalizedShootStatus.includes('raw')) return 'Photos uploaded';
    if (normalizedShootStatus.includes('editing') || normalizedShootStatus.includes('in_progress')) return 'Being edited';
    if (normalizedShootStatus.includes('review') || normalizedShootStatus.includes('pending')) return 'Under review';
    if (normalizedShootStatus.includes('complete')) return 'Almost ready';
    return 'In progress';
  };

  // Determine if shoot services include video
  const shootHasVideoService = useMemo(() => {
    const services = shoot.services || [];
    const videoKeywords = ['video', 'walkthrough', 'cinematic', 'drone video', 'aerial video', 'reel'];
    return services.some(s => videoKeywords.some(kw => s.toLowerCase().includes(kw)));
  }, [shoot.services]);

  // Build accept string based on services
  const uploadAcceptPhotosOnly = "image/*,.raw,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.x3f,.tiff,.tif,.heic,.heif";
  const uploadAcceptAll = "image/*,video/*,.raw,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.x3f,.tiff,.tif,.heic,.heif";
  const uploadAccept = shootHasVideoService ? uploadAcceptAll : uploadAcceptPhotosOnly;

  const isVideoUpload = (file: File): boolean => {
    const name = file.name.toLowerCase();
    if (file.type && file.type.toLowerCase().startsWith('video/')) {
      return true;
    }
    return /\.(mp4|mov|avi|mkv|wmv)$/.test(name);
  };

  // Check if a MediaFile is a video
  const isVideoFile = (file: MediaFile): boolean => {
    if (file.media_type === 'video') return true;
    const name = (file.filename || '').toLowerCase();
    const mime = (file.fileType || '').toLowerCase();
    if (mime.startsWith('video/')) return true;
    return /\.(mp4|mov|avi|mkv|wmv|webm)$/.test(name);
  };

  // Filter files into photos and videos
  const filterPhotoFiles = (files: MediaFile[]): MediaFile[] => 
    files.filter(f => !isVideoFile(f));
  
  const filterVideoFiles = (files: MediaFile[]): MediaFile[] => 
    files.filter(f => isVideoFile(f));

  // Computed filtered lists for uploaded (raw) files
  const uploadedPhotos = useMemo(() => filterPhotoFiles(rawFiles), [rawFiles]);
  const uploadedVideos = useMemo(() => filterVideoFiles(rawFiles), [rawFiles]);

  // Computed filtered lists for edited files
  const editedPhotos = useMemo(() => filterPhotoFiles(editedFiles), [editedFiles]);
  const editedVideos = useMemo(() => filterVideoFiles(editedFiles), [editedFiles]);

  // Get iGuide and floorplan data from shoot
  const iguideUrl =
    shoot?.iguideTourUrl ||
    shoot?.tourLinks?.iguide_branded ||
    shoot?.tourLinks?.iguide_mls ||
    shoot?.tourLinks?.iGuide ||
    (shoot as any)?.iguide_tour_url;
  const iguideFloorplansSource =
    shoot?.iguideFloorplans || (shoot as any)?.iguide_floorplans || [];
  const iguideFloorplans: Array<{ url: string; filename?: string }> = useMemo(() => {
    const fps = iguideFloorplansSource || [];
    if (!Array.isArray(fps)) return [];
    return fps.map((fp: any) => ({
      url: typeof fp === 'string' ? fp : (fp?.url || fp?.path || ''),
      filename: typeof fp === 'string' ? 'Floorplan' : (fp?.filename || 'Floorplan'),
    })).filter((fp: { url: string }) => fp.url);
  }, [iguideFloorplansSource]);

  // Get current filtered files based on active sub-tab
  const getFilteredFiles = (baseFiles: MediaFile[], subTab: MediaSubTab): MediaFile[] => {
    if (subTab === 'photos') return filterPhotoFiles(baseFiles);
    if (subTab === 'videos') return filterVideoFiles(baseFiles);
    return baseFiles;
  };

  // Get the currently displayed files based on display tab and sub-tab
  const getCurrentDisplayedFiles = (): MediaFile[] => {
    if (displayTab === 'uploaded') {
      if (uploadedMediaTab === 'photos') return uploadedPhotos;
      if (uploadedMediaTab === 'videos') return uploadedVideos;
      return rawFiles;
    } else {
      if (editedMediaTab === 'photos') return editedPhotos;
      if (editedMediaTab === 'videos') return editedVideos;
      return editedFiles;
    }
  };

  const currentDisplayedFiles = getCurrentDisplayedFiles();

  // Get image URL with fallback chain
  const getImageUrl = (file: MediaFile, size: 'thumb' | 'medium' | 'large' | 'original' = 'medium'): string => {
    const baseUrl = API_BASE_URL;
    const base = baseUrl.replace(/\/+$/, '');

    const encodeIfNeeded = (value: string): string => {
      try {
        return encodeURI(value);
      } catch {
        return value;
      }
    };

    const normalizeRelative = (value: string): string => {
      const v = value.replace(/^\/+/, '');
      if (v.startsWith('shoots/')) {
        return `${base}${encodeIfNeeded(`/storage/${v}`)}`;
      }
      return `${base}${encodeIfNeeded(`/${v}`)}`;
    };
    
    const resolveValue = (value: string): string => {
      if (/^https?:\/\//i.test(value)) return value;
      if (value.startsWith('/')) return `${base}${value}`;
      return normalizeRelative(value);
    };

    // Try size-specific URL first (backend provides pre-encoded URLs)
    const sizeUrl = file[size];
    if (sizeUrl) {
      return resolveValue(sizeUrl);
    }

    // Avoid loading originals for thumbnails/medium previews
    if (size === 'thumb') {
      if (file.placeholder_path) {
        return resolveValue(file.placeholder_path);
      }
      return '';
    }

    if (size === 'medium') {
      if (file.thumb) {
        return resolveValue(file.thumb);
      }
      return '';
    }

    if (size === 'large') {
      // For large, try medium first, then thumb - never load original for preview
      if (file.medium) return resolveValue(file.medium);
      if (file.thumb) return resolveValue(file.thumb);
      return '';
    }

    // Only allow original fallback when explicitly requesting 'original' size
    if (size !== 'original') {
      return '';
    }
    
    // Fallback to original - only for 'original' size
    if (file.original) {
      return resolveValue(encodeIfNeeded(file.original));
    }
    
    // Final fallback
    if (file.url) {
      return resolveValue(encodeIfNeeded(file.url));
    }
    
    if (file.path) {
      return normalizeRelative(file.path);
    }
    
    return '';
  };

  // Generate srcSet for responsive images
  const getSrcSet = (file: MediaFile): string => {
    const sizes = [];
    if (file.thumb) sizes.push(`${getImageUrl(file, 'thumb')} 300w`);
    if (file.medium) sizes.push(`${getImageUrl(file, 'medium')} 800w`);
    if (file.large) sizes.push(`${getImageUrl(file, 'large')} 1800w`);
    return sizes.join(', ');
  };

  // Check if file is image (including RAW files with processed thumbnails)
  const isPreviewableImage = (file: MediaFile): boolean => {
    // If RAW file has processed thumbnail, it's previewable
    if ((file.media_type === 'raw' || file.media_type === 'image') && file.thumbnail_path) {
      return true;
    }
    
    const name = file.filename.toLowerCase();
    const rawExt = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/.test(name);
    if (rawExt) return false;

    const mime = (file.fileType || '').toLowerCase();
    const rawMime = mime.includes('nef') || mime.includes('dng') || mime.includes('cr2') || mime.includes('cr3') || mime.includes('arw') || mime.includes('raf') || mime.includes('raw');
    if (rawMime) return false;

    if (mime.startsWith('image/')) {
      return true;
    }

    return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(name);
  };

  // Open viewer
  const openViewer = (index: number, files: MediaFile[]) => {
    setViewerIndex(index);
    setViewerFiles(files);
    setViewerOpen(true);
  };

  // Toggle file selection
  const toggleSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // Handle AI editing
  const handleAiEdit = async () => {
    if (!isAdmin) {
      toast({
        title: 'Not authorized',
        description: 'Only admins can submit AI edits at this time.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to edit',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedEditingType) {
      toast({
        title: 'No editing type selected',
        description: 'Please select an editing type',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingAiEdit(true);
    try {
      const fileIds = Array.from(selectedFiles).map(id => parseInt(id));
      await fotelloService.submitEditing({
        shoot_id: Number(shoot.id),
        file_ids: fileIds,
        editing_type: selectedEditingType,
        params: {},
      });

      toast({
        title: 'Success',
        description: `Submitted ${fileIds.length} image(s) for AI editing`,
      });

      setShowAiEditDialog(false);
      setSelectedFiles(new Set());
      onShootUpdate();
    } catch (error: any) {
      console.error('Failed to submit AI editing:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to submit editing job',
        variant: 'destructive',
      });
    } finally {
      setSubmittingAiEdit(false);
    }
  };

  // Download selected files
  const handleDownload = async (size: 'original' | 'small') => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to download',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(true);
    try {
      const headers = getApiHeaders();
      const fileIds = Array.from(selectedFiles);
      
      // Request download from backend
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/download`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_ids: fileIds,
          size: size === 'small' ? 'small' : 'original', // small = 1800x1200, original = full size
        }),
      });

      if (!res.ok) throw new Error('Download failed');

      // Get download URL or blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shoot-${shoot.id}-${size === 'small' ? 'small' : 'full'}-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: `Downloading ${selectedFiles.size} file(s) as ${size === 'small' ? 'small (1800x1200)' : 'full size'}`,
      });

      setSelectedFiles(new Set());
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download files',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  // Editor-specific download raw files (with activity logging and admin notification)
  const handleEditorDownloadRaw = async (downloadAll: boolean = true) => {
    const fileIds = downloadAll ? [] : Array.from(selectedFiles);
    
    if (!downloadAll && fileIds.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to download or use "Download All"',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(true);
    try {
      const headers = getApiHeaders();
      headers.Accept = 'application/json, application/zip';
      delete headers['Content-Type'];
      
      const queryParams = new URLSearchParams();
      if (!downloadAll && fileIds.length > 0) {
        queryParams.append('file_ids', fileIds.join(','));
      }
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/editor-download-raw?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

      const contentType = res.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        // Redirect response - open Dropbox link
        const data = await res.json();
        if (data.type === 'redirect' && data.url) {
          window.open(data.url, '_blank');
          toast({
            title: 'Download started',
            description: data.message || `Downloading ${data.file_count || 'all'} raw files. Switch to Edited tab to upload your edits.`,
          });
        }
      } else {
        // Direct blob download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shoot-${shoot.id}-raw-files-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Download started',
          description: 'Raw files downloaded. Switch to Edited tab to upload your edits.',
        });
      }

      // Auto-switch to Edited tab after download
      setSelectedFiles(new Set());
      setActiveSubTab('edited');
      setDisplayTab('edited');
      
    } catch (error: any) {
      toast({
        title: 'Download failed',
        description: error.message || 'Failed to download raw files',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  // Generate shareable ZIP link for editor
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  
  const handleGenerateShareLink = async (shareAll: boolean = true) => {
    const fileIds = shareAll ? [] : Array.from(selectedFiles);
    
    if (!shareAll && fileIds.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to share or use "Share All"',
        variant: 'destructive',
      });
      return;
    }

    setGeneratingShareLink(true);
    try {
      const headers = getApiHeaders();
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/generate-share-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_ids: shareAll ? [] : fileIds,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate share link' }));
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data = await res.json();
      setShareLink(data.share_link);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(data.share_link);
      
      toast({
        title: 'Share link generated!',
        description: 'Link copied to clipboard. Lifetime link.',
      });
      
    } catch (error: any) {
      toast({
        title: 'Failed to generate link',
        description: error.message || 'Failed to generate share link',
        variant: 'destructive',
      });
    } finally {
      setGeneratingShareLink(false);
    }
  };

  // Delete selected files
  const handleDeleteFiles = async () => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to delete',
        variant: 'destructive',
      });
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const headers = getApiHeaders();
      const fileIds = Array.from(selectedFiles).map(id => parseInt(id));
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/bulk-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ids: fileIds,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to delete files' }));
        throw new Error(errorData.message || 'Failed to delete files');
      }

      toast({
        title: 'Success',
        description: `Deleted ${selectedFiles.size} file(s) successfully`,
      });

      // Invalidate React Query cache to refresh files
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'all'] });
      
      setSelectedFiles(new Set());
      onShootUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete files',
        variant: 'destructive',
      });
    }
  };

  // Get current files based on active tab
  const currentFiles = activeSubTab === 'uploaded' ? rawFiles : editedFiles;

  // Edited Upload Section Component (for Editors)
  const EditedUploadSection = ({ shoot, onUploadComplete, isEditor = false }: { shoot: ShootData; onUploadComplete: () => void; isEditor?: boolean }) => {
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [editingNotes, setEditingNotes] = useState('');
    const [showChecklistDialog, setShowChecklistDialog] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileProgress, setFileProgress] = useState<Record<number, number>>({});
    const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({
      'interior_exposure': false,
      'interior_white_balance': false,
      'window_pulling': false,
      'straight_lines': false,
      'exterior_exposure': false,
      'exterior_clarity': false,
      'sky_replacement': false,
      'natural_shadows': false,
    });

    const checklistLabels: Record<string, string> = {
      'interior_exposure': 'Interior: Exposure balanced - room appears well-lit and inviting',
      'interior_white_balance': 'Interior: White balance corrected - neutral tones (no yellow or blue tint)',
      'window_pulling': 'Interior: Window pulling done perfectly - clear exterior view without halos or harsh edges, natural exposure',
      'straight_lines': 'Interior: Vertical and horizontal lines straightened - lens distortion corrected if needed',
      'exterior_exposure': 'Exterior: Proper exposure ensured',
      'exterior_clarity': 'Exterior: Clarity maintained',
      'sky_replacement': 'Exterior: Sky replacement (if needed) - natural blue sky, not overly saturated',
      'natural_shadows': 'Exterior: Natural shadows and lighting direction maintained',
    };

    const editingGuidelines = [
      {
        title: 'General Editing Requirements',
        items: [
          'Maintain a clean, natural, realistic editing style',
          'Avoid over-editing — images should look bright, clean, and true to life',
        ],
      },
    ];

    const allChecked = Object.values(checklistItems).every(v => v);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setUploadedFiles(prev => [...prev, ...files]);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []);
      setUploadedFiles(prev => [...prev, ...files]);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
    };

    const handleSubmitEdits = async () => {
      if (uploadedFiles.length === 0) {
        toast({
          title: 'No files',
          description: 'Please select files to upload',
          variant: 'destructive',
        });
        return;
      }

      // Show checklist dialog only for editors, not admins
      if (isEditor) {
        setShowChecklistDialog(true);
      } else {
        // For admins, skip checklist and upload directly
        handleConfirmSubmit();
      }
    };

    const handleChecklistComplete = () => {
      if (!allChecked) {
        toast({
          title: 'Checklist incomplete',
          description: 'Please complete all checklist items before submitting',
          variant: 'destructive',
        });
        return;
      }
      setShowChecklistDialog(false);
      handleConfirmSubmit();
    };

    // Upload a single edited file with progress tracking
    const uploadSingleEditedFile = (
      file: File, 
      fileIndex: number, 
      authorizationHeader: string | undefined,
      impersonationHeader: string | undefined,
      isFirstFile: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const formData = new FormData();
        const isVideo = isVideoUpload(file);
        formData.append('files[]', file);
        formData.append('upload_type', 'edited');
        if (isVideo) {
          formData.append('service_category', 'video');
        }
        
        // Only send metadata with first file
        if (isFirstFile) {
          if (editingNotes.trim()) {
            formData.append('editing_notes', editingNotes.trim());
          }
          formData.append('checklist', JSON.stringify(checklistItems));
        }

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const filePercent = Math.round((event.loaded / event.total) * 100);
            setFileProgress(prev => ({ ...prev, [fileIndex]: filePercent }));
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setFileProgress(prev => ({ ...prev, [fileIndex]: 100 }));
            resolve({ success: true });
          } else {
            let errorMsg = 'Upload failed';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMsg = errorData.message || errorMsg;
            } catch {}
            resolve({ success: false, error: `${file.name}: ${errorMsg}` });
          }
        });
        
        xhr.addEventListener('error', () => {
          resolve({ success: false, error: `${file.name}: Network error` });
        });
        
        xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
        if (authorizationHeader) {
          xhr.setRequestHeader('Authorization', authorizationHeader);
        }
        if (impersonationHeader) {
          xhr.setRequestHeader('X-Impersonate-User-Id', impersonationHeader);
        }
        xhr.send(formData);
      });
    };

    const handleConfirmSubmit = async () => {
      setUploading(true);
      setUploadProgress(0);
      
      // Initialize file progress for all files
      const initialProgress: Record<number, number> = {};
      uploadedFiles.forEach((_, index) => {
        initialProgress[index] = 0;
      });
      setFileProgress(initialProgress);
      
      const apiHeaders = getApiHeaders();
      const authorizationHeader = apiHeaders.Authorization;
      const impersonationHeader = apiHeaders['X-Impersonate-User-Id'];
      const CONCURRENT_UPLOADS = 3; // Upload 3 files concurrently
      const totalFiles = uploadedFiles.length;
      let completedFiles = 0;
      const errors: string[] = [];
      
      try {
        // Process files in concurrent batches
        for (let i = 0; i < totalFiles; i += CONCURRENT_UPLOADS) {
          const batch = uploadedFiles.slice(i, Math.min(i + CONCURRENT_UPLOADS, totalFiles));
          const batchPromises = batch.map((file, batchIndex) => {
            const fileIndex = i + batchIndex;
            return uploadSingleEditedFile(file, fileIndex, authorizationHeader, impersonationHeader, fileIndex === 0);
          });
          
          const results = await Promise.all(batchPromises);
          
          results.forEach((result) => {
            completedFiles++;
            if (!result.success && result.error) {
              errors.push(result.error);
            }
          });
          
          // Update overall progress
          const overallProgress = Math.round((completedFiles / totalFiles) * 100);
          setUploadProgress(overallProgress);
        }
        
        // Mark all files as complete
        const completeProgress: Record<number, number> = {};
        uploadedFiles.forEach((_, index) => {
          completeProgress[index] = 100;
        });
        setFileProgress(completeProgress);
        setUploadProgress(100);


        if (errors.length > 0) {
          toast({
            title: 'Partial Success',
            description: `${totalFiles - errors.length}/${totalFiles} files uploaded. ${errors.length} failed.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Success',
            description: `All ${totalFiles} edited files uploaded successfully`,
          });
        }
        
        // Small delay to show 100% before clearing
        setTimeout(() => {
          setUploadedFiles([]);
          setEditingNotes('');
          setUploadProgress(0);
          setFileProgress({});
          setChecklistItems(Object.fromEntries(Object.keys(checklistItems).map(k => [k, false])));
          onUploadComplete();
        }, 500);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to upload files',
          variant: 'destructive',
        });
        setUploadProgress(0);
        setFileProgress({});
      } finally {
        setUploading(false);
      }
    };

    // Get photographer notes from shoot
    const photographerNotes = typeof shoot.notes === 'object' 
      ? shoot.notes?.photographerNotes 
      : null;
    
    // Get existing edited count and expected count
    const existingEditedCount = shoot.editedPhotoCount || 0;
    const expectedFinalCount = shoot.expectedFinalCount || shoot.package?.expectedDeliveredCount || 0;
    const editedMissingCount = Math.max(0, expectedFinalCount - existingEditedCount - uploadedFiles.length);

    return (
      <div className="space-y-3 flex flex-col">
        {/* Photographer Notes for Editor */}
        {photographerNotes && (
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="font-medium text-blue-700 mb-1">Photographer Notes:</div>
              <p className="text-blue-600 text-sm whitespace-pre-wrap">{photographerNotes}</p>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Photo counts for editor */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">Expected</div>
            <div className="font-semibold text-base">{expectedFinalCount}</div>
          </div>
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">Uploaded</div>
            <div className="font-semibold text-base">{existingEditedCount + uploadedFiles.length}</div>
          </div>
          <div className={`p-2 border rounded ${editedMissingCount > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <div className="text-muted-foreground">{editedMissingCount > 0 ? 'Missing' : 'Complete'}</div>
            <div className={`font-semibold text-base ${editedMissingCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {editedMissingCount > 0 ? editedMissingCount : '✓'}
            </div>
          </div>
        </div>

        {/* Drag and Drop Upload Area */}
        {uploadedFiles.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-border/50 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer bg-card flex-1 flex items-center justify-center min-h-[400px] shadow-sm"
          >
            <input
              type="file"
              multiple
              accept={uploadAccept}
              onChange={handleFileSelect}
              className="hidden"
              id="edited-file-upload"
            />
            <label htmlFor="edited-file-upload" className="cursor-pointer flex flex-col items-center w-full">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ImageIcon className="h-10 w-10 text-primary/60" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No uploaded files yet</h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                {shootHasVideoService ? 'Upload photos and videos to get started.' : 'Upload photos to get started.'} You can drag and drop files or use the upload button.
              </p>
              <Button
                variant="default"
                size="lg"
                className="bg-primary hover:bg-primary/90"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  document.getElementById('edited-file-upload')?.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </label>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              multiple
              accept={uploadAccept}
              onChange={handleFileSelect}
              className="hidden"
              id="edited-file-upload"
            />
            <label htmlFor="edited-file-upload" className="cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium">Drag and drop more edited files here</div>
              <div className="text-xs text-muted-foreground mt-1">or click to browse</div>
            </label>
          </div>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {uploading ? `Uploading Files (${uploadProgress}%)` : `Selected Files (${uploadedFiles.length})`}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Progress indicator */}
                    {uploading && (
                      <div className="flex-shrink-0">
                        <CircularProgress progress={fileProgress[index] || 0} size={18} />
                      </div>
                    )}
                    <span className="text-xs truncate flex-1">{file.name}</span>
                    {/* Show percentage during upload */}
                    {uploading && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 w-8 text-right">
                        {fileProgress[index] || 0}%
                      </span>
                    )}
                  </div>
                  {!uploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editing Notes - Inline */}
        {uploadedFiles.length > 0 && !uploading && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Add any notes about the editing..."
              className="w-full min-h-[80px] p-2 border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>
        )}

        {/* Submit Button with Progress Bar */}
        <div className="space-y-2 pb-4">
          {/* Overall Progress Bar - shown during upload */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading {uploadedFiles.length} file(s)...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
          
          <Button
            onClick={handleSubmitEdits}
            disabled={uploading || uploadedFiles.length === 0}
            className="w-full relative overflow-hidden"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading... {uploadProgress}%
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Edited Files
              </>
            )}
          </Button>
        </div>

        {/* Checklist Dialog */}
        <Dialog open={showChecklistDialog} onOpenChange={setShowChecklistDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Pre-Upload Checklist & Guidelines</DialogTitle>
              <DialogDescription>
                Review the guidelines and confirm all checklist items are completed before submitting edited files.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
              {/* Editing Guidelines Section (Read-only) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <span className="text-base font-semibold">📌 Editing Guidelines</span>
                  <Badge variant="outline" className="text-xs">Reference Only</Badge>
                </div>
                
                {editingGuidelines.map((section, idx) => (
                  <div key={idx} className="space-y-2 pl-4">
                    <div className="font-medium text-sm text-muted-foreground">{section.title}</div>
                    <ul className="space-y-1.5 pl-4">
                      {section.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* Interior Editing Guidelines */}
                <div className="space-y-2 pl-4 pt-2">
                  <div className="font-medium text-sm text-muted-foreground">📌 Interior Editing</div>
                  <ul className="space-y-1.5 pl-4">
                    <li className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/60 mt-1">•</span>
                      <span>Window Pulling: Please do perfect window pulls - clear and visible exterior view without halos or harsh edges. Make sure exposure looks natural and not overly dark or artificial.</span>
                    </li>
                    <li className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/60 mt-1">•</span>
                      <span>Straight Lines / Perspective: Vertical and horizontal lines should be straight. Correct lens distortion if needed.</span>
                    </li>
                  </ul>
                </div>

                {/* Exterior Editing Guidelines */}
                <div className="space-y-2 pl-4 pt-2">
                  <div className="font-medium text-sm text-muted-foreground">📌 Exterior Editing</div>
                  <ul className="space-y-1.5 pl-4">
                    <li className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/60 mt-1">•</span>
                      <span>Sky Replacement (if needed): Use an attractive blue sky that looks natural. No dramatic or overly saturated skies. Maintain natural shadows and lighting direction.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 pb-3">
                  <span className="text-base font-semibold">✓ Checklist Items</span>
                  <Badge variant="default" className="text-xs">
                    {Object.values(checklistItems).filter(v => v).length} / {Object.keys(checklistItems).length} completed
                  </Badge>
                </div>
              </div>

              {/* Checklist Items Section */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground px-2">Interior Editing</div>
                  {['interior_exposure', 'interior_white_balance', 'window_pulling', 'straight_lines'].map((key) => (
                    <div key={key} className="flex items-start space-x-3 p-2.5 hover:bg-muted/50 rounded border border-transparent hover:border-border transition-colors">
                      <Checkbox
                        checked={checklistItems[key]}
                        onCheckedChange={(checked) => {
                          setChecklistItems(prev => ({ ...prev, [key]: checked as boolean }));
                        }}
                        id={`checklist-${key}`}
                        className="mt-0.5"
                      />
                      <label htmlFor={`checklist-${key}`} className="text-sm cursor-pointer flex-1 leading-relaxed">
                        {checklistLabels[key]}
                      </label>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 pt-2">
                  <div className="text-sm font-medium text-muted-foreground px-2">Exterior Editing</div>
                  {['exterior_exposure', 'exterior_clarity', 'sky_replacement', 'natural_shadows'].map((key) => (
                    <div key={key} className="flex items-start space-x-3 p-2.5 hover:bg-muted/50 rounded border border-transparent hover:border-border transition-colors">
                      <Checkbox
                        checked={checklistItems[key]}
                        onCheckedChange={(checked) => {
                          setChecklistItems(prev => ({ ...prev, [key]: checked as boolean }));
                        }}
                        id={`checklist-${key}`}
                        className="mt-0.5"
                      />
                      <label htmlFor={`checklist-${key}`} className="text-sm cursor-pointer flex-1 leading-relaxed">
                        {checklistLabels[key]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowChecklistDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleChecklistComplete} disabled={!allChecked}>
                Continue ({Object.values(checklistItems).filter(v => v).length}/{Object.keys(checklistItems).length})
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        </div>
    );
  };

  // Circular progress indicator component
  const CircularProgress = ({ progress, size = 16 }: { progress: number; size?: number }) => {
    const strokeWidth = 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;
    
    if (progress >= 100) {
      return (
        <div className="flex items-center justify-center" style={{ width: size, height: size }}>
          <Check className="h-3 w-3 text-green-500" />
        </div>
      );
    }
    
    return (
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-300"
        />
      </svg>
    );
  };

  // Helper type for photo service breakdown
  type PhotoService = { name: string; count: number };
  
  // Helper function to extract photo services with their counts from service names
  const extractPhotoServicesFromServices = (services: string[]): PhotoService[] => {
    if (!services || services.length === 0) return [];
    
    const photoServices: PhotoService[] = [];
    const photoPatterns = [
      /^(\d+)\s*(flash|hdr|exterior|interior|twilight)?\s*photos?/i,
      /^(\d+)\s*(flash|hdr|exterior|interior|twilight)/i,
    ];
    
    for (const service of services) {
      for (const pattern of photoPatterns) {
        const match = service.match(pattern);
        if (match) {
          photoServices.push({
            name: service,
            count: parseInt(match[1], 10),
          });
          break;
        }
      }
    }
    
    return photoServices;
  };
  
  // Helper function to get total photo count from services
  const extractPhotoCountFromServices = (services: string[]): number => {
    const photoServices = extractPhotoServicesFromServices(services);
    return photoServices.reduce((sum, s) => sum + s.count, 0);
  };

  // Helper function to check if shoot requires HDR bracketing
  // Standard/flash shoots don't need brackets - only HDR shoots do
  const isHdrShoot = (services: string[]): boolean => {
    if (!services || services.length === 0) return false;
    // Check if any service explicitly mentions HDR
    return services.some(service => /\bhdr\b/i.test(service));
  };

  // Raw Upload Section Component
  const RawUploadSection = ({ shoot, onUploadComplete }: { shoot: ShootData; onUploadComplete: () => void }) => {
    const [bracketType, setBracketType] = useState<'3-bracket' | '5-bracket'>(
      shoot.bracketMode === 3 ? '3-bracket' : '5-bracket'
    );
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [extraFiles, setExtraFiles] = useState<Set<string>>(new Set());
    const [editingNotes, setEditingNotes] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileProgress, setFileProgress] = useState<Record<number, number>>({});

    // Check if this is an HDR shoot (requires brackets) vs standard/flash (no brackets)
    const shootRequiresBrackets = isHdrShoot(shoot.services || []);

    // Use shoot's existing counts for display
    const existingRawCount = shoot.rawPhotoCount || 0;
    // Get photo services breakdown for display
    const photoServices = extractPhotoServicesFromServices(shoot.services || []);
    // Try to get expected photos from package, expectedFinalCount, or parse from services
    const expectedPhotos = shoot.package?.expectedDeliveredCount || shoot.expectedFinalCount || photoServices.reduce((sum, s) => sum + s.count, 0);
    // For standard/flash shoots, no bracket multiplier (1:1 ratio)
    const bracketMultiplier = shootRequiresBrackets ? (bracketType === '3-bracket' ? 3 : 5) : 1;
    const expectedRawCount = expectedPhotos * bracketMultiplier;
    const uploadedCount = uploadedFiles.length;
    const totalRawCount = existingRawCount + uploadedCount;
    const equivalentFinalPhotos = shootRequiresBrackets ? Math.floor(totalRawCount / bracketMultiplier) : totalRawCount;
    const missingCount = Math.max(0, expectedRawCount - totalRawCount);
    const isShort = totalRawCount < expectedRawCount;
    

    const MAX_FILE_SIZE_RAW = 500 * 1024 * 1024; // 500MB per file - effectively unlimited
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const validFiles: File[] = [];
      const oversizedFiles: string[] = [];
      
      files.forEach(file => {
        if (file.size > MAX_FILE_SIZE_RAW) {
          oversizedFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        } else {
          validFiles.push(file);
        }
      });
      
      if (oversizedFiles.length > 0) {
        toast({
          title: 'Some files are too large',
          description: `Max 50MB per file. Skipped: ${oversizedFiles.slice(0, 3).join(', ')}${oversizedFiles.length > 3 ? ` and ${oversizedFiles.length - 3} more` : ''}`,
          variant: 'destructive',
        });
      }
      
      if (validFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...validFiles]);
      }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []);
      const validFiles: File[] = [];
      const oversizedFiles: string[] = [];
      
      files.forEach(file => {
        if (file.size > MAX_FILE_SIZE_RAW) {
          oversizedFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        } else {
          validFiles.push(file);
        }
      });
      
      if (oversizedFiles.length > 0) {
        toast({
          title: 'Some files are too large',
          description: `Max 50MB per file. Skipped: ${oversizedFiles.slice(0, 3).join(', ')}${oversizedFiles.length > 3 ? ` and ${oversizedFiles.length - 3} more` : ''}`,
          variant: 'destructive',
        });
      }
      
      if (validFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...validFiles]);
      }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
    };

    const toggleExtra = (index: number) => {
      setExtraFiles(prev => {
        const newSet = new Set(prev);
        const fileId = String(index);
        if (newSet.has(fileId)) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
        return newSet;
      });
    };

    const handleSubmitRAW = async () => {
      if (uploadedFiles.length === 0) {
        toast({
          title: 'No files',
          description: 'Please select files to upload',
          variant: 'destructive',
        });
        return;
      }

      // Directly start upload (notes are inline now)
      handleConfirmSubmit();
    };

    // Upload a single file with progress tracking
    const uploadSingleFile = (
      file: File, 
      fileIndex: number, 
      authorizationHeader: string | undefined,
      impersonationHeader: string | undefined,
      isFirstFile: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const formData = new FormData();
        const isVideo = isVideoUpload(file);
        formData.append('files[]', file);
        formData.append('upload_type', 'raw');
        if (isVideo) {
          formData.append('service_category', 'video');
        }
        
        // Only send metadata with first file to avoid duplicate updates
        if (isFirstFile) {
          // Only send bracket_mode for HDR shoots
          if (shootRequiresBrackets) {
            formData.append('bracket_mode', bracketType === '3-bracket' ? '3' : '5');
          }
          if (extraFiles.has(String(fileIndex))) {
            formData.append('is_extra', 'true');
          }
          if (editingNotes.trim()) {
            formData.append('photographer_notes', editingNotes.trim());
          }
        } else {
          // Only send bracket_mode for HDR shoots
          if (shootRequiresBrackets) {
            formData.append('bracket_mode', bracketType === '3-bracket' ? '3' : '5');
          }
          if (extraFiles.has(String(fileIndex))) {
            formData.append('is_extra', 'true');
          }
        }

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const filePercent = Math.round((event.loaded / event.total) * 100);
            setFileProgress(prev => ({ ...prev, [fileIndex]: filePercent }));
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setFileProgress(prev => ({ ...prev, [fileIndex]: 100 }));
            resolve({ success: true });
          } else {
            let errorMsg = 'Upload failed';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMsg = errorData.message || errorMsg;
            } catch {}
            resolve({ success: false, error: `${file.name}: ${errorMsg}` });
          }
        });
        
        xhr.addEventListener('error', () => {
          resolve({ success: false, error: `${file.name}: Network error` });
        });
        
        xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
        if (authorizationHeader) {
          xhr.setRequestHeader('Authorization', authorizationHeader);
        }
        if (impersonationHeader) {
          xhr.setRequestHeader('X-Impersonate-User-Id', impersonationHeader);
        }
        xhr.send(formData);
      });
    };

    const handleConfirmSubmit = async () => {
      setUploading(true);
      setUploadProgress(0);
      
      // Initialize file progress for all files
      const initialProgress: Record<number, number> = {};
      uploadedFiles.forEach((_, index) => {
        initialProgress[index] = 0;
      });
      setFileProgress(initialProgress);
      
      const apiHeaders = getApiHeaders();
      const authorizationHeader = apiHeaders.Authorization;
      const impersonationHeader = apiHeaders['X-Impersonate-User-Id'];
      const CONCURRENT_UPLOADS = 3; // Upload 3 files concurrently
      const totalFiles = uploadedFiles.length;
      let completedFiles = 0;
      const errors: string[] = [];
      
      try {
        // Process files in concurrent batches
        for (let i = 0; i < totalFiles; i += CONCURRENT_UPLOADS) {
          const batch = uploadedFiles.slice(i, Math.min(i + CONCURRENT_UPLOADS, totalFiles));
          const batchPromises = batch.map((file, batchIndex) => {
            const fileIndex = i + batchIndex;
            return uploadSingleFile(file, fileIndex, authorizationHeader, impersonationHeader, fileIndex === 0);
          });
          
          const results = await Promise.all(batchPromises);
          
          results.forEach((result) => {
            completedFiles++;
            if (!result.success && result.error) {
              errors.push(result.error);
            }
          });
          
          // Update overall progress
          const overallProgress = Math.round((completedFiles / totalFiles) * 100);
          setUploadProgress(overallProgress);
        }
        
        // Mark all files as complete
        const completeProgress: Record<number, number> = {};
        uploadedFiles.forEach((_, index) => {
          completeProgress[index] = 100;
        });
        setFileProgress(completeProgress);
        setUploadProgress(100);

        const successCount = totalFiles - errors.length;
        
        if (successCount === 0) {
          // All failed - show error only
          toast({
            title: 'Upload Failed',
            description: `All ${totalFiles} files failed to upload. Please check your connection and try again.`,
            variant: 'destructive',
          });
          setUploadProgress(0);
          setFileProgress({});
          setUploading(false);
          return; // Don't clear files so user can retry
        } else if (errors.length > 0) {
          // Partial success
          toast({
            title: 'Partial Success',
            description: `${successCount}/${totalFiles} files uploaded. ${errors.length} failed.`,
            variant: 'destructive',
          });
        } else {
          // All succeeded
          toast({
            title: 'Success',
            description: `All ${totalFiles} RAW files uploaded successfully`,
          });
        }
        
        // Small delay to show 100% before clearing
        setTimeout(() => {
          setUploadedFiles([]);
          setExtraFiles(new Set());
          setEditingNotes('');
          setUploadProgress(0);
          setFileProgress({});
          onUploadComplete();
        }, 500);
      } catch (error: any) {
        console.error('RAW upload error:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to upload files',
          variant: 'destructive',
        });
        setUploadProgress(0);
        setFileProgress({});
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="space-y-3 flex flex-col">
        {/* Bracket Type Selector - Only show for HDR shoots */}
        {shootRequiresBrackets && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Bracket Type</label>
            <RadioGroup value={bracketType} onValueChange={(v) => setBracketType(v as '3-bracket' | '5-bracket')}>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3-bracket" id="3-bracket" />
                  <label htmlFor="3-bracket" className="text-sm cursor-pointer">3-Bracket</label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="5-bracket" id="5-bracket" />
                  <label htmlFor="5-bracket" className="text-sm cursor-pointer">5-Bracket</label>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Counters */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">Expected</div>
            <div className="font-semibold text-base">{expectedRawCount}</div>
            {photoServices.length > 0 && (
              <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                {photoServices.map((s, i) => (
                  <div key={i}>{s.name}: {shootRequiresBrackets ? s.count * bracketMultiplier : s.count}</div>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">Existing</div>
            <div className="font-semibold text-base">{existingRawCount + uploadedCount}</div>
          </div>
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">Extras</div>
            <div className="font-semibold text-base">{extraFiles.size}</div>
          </div>
        </div>
        
        {/* Missing photos warning */}
        {missingCount > 0 && totalRawCount > 0 && (
          <Alert className="bg-orange-500/10 border-orange-500/30">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              {missingCount} photo(s) missing. Expected {expectedRawCount} photos{shootRequiresBrackets ? ` (${expectedPhotos} final × ${bracketMultiplier} brackets)` : ''}, but only {totalRawCount} uploaded.
            </AlertDescription>
          </Alert>
        )}

        {/* Drag and Drop Upload Area */}
        {uploadedFiles.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-card flex items-center justify-center min-h-[250px] shadow-sm"
          >
            <input
              type="file"
              multiple
              accept={uploadAccept}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center w-full">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ImageIcon className="h-10 w-10 text-primary/60" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No uploaded files yet</h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                {shootHasVideoService ? 'Upload photos and videos to get started.' : 'Upload photos to get started.'} You can drag and drop files or use the upload button.
              </p>
              <Button
                variant="default"
                size="lg"
                className="bg-primary hover:bg-primary/90"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  document.getElementById('file-upload')?.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </label>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg p-3 text-center hover:border-primary/50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              multiple
              accept={uploadAccept}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex items-center justify-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">Drag and drop more files here or click to browse</div>
            </label>
          </div>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              {uploading ? `Uploading Files (${uploadProgress}%)` : `Selected Files (${uploadedFiles.length})`}
              {!uploading && <span className="text-xs text-muted-foreground font-normal">(mark extras by clicking on the checkmark)</span>}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Progress indicator or checkbox */}
                    {uploading ? (
                      <div className="flex-shrink-0">
                        <CircularProgress progress={fileProgress[index] || 0} size={18} />
                      </div>
                    ) : (
                      <Checkbox
                        checked={extraFiles.has(String(index))}
                        onCheckedChange={() => toggleExtra(index)}
                        id={`extra-${index}`}
                      />
                    )}
                    <label htmlFor={`extra-${index}`} className="text-xs cursor-pointer flex-1 truncate">
                      {file.name}
                    </label>
                    {/* Show percentage during upload */}
                    {uploading && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 w-8 text-right">
                        {fileProgress[index] || 0}%
                      </span>
                    )}
                  </div>
                  {!uploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                        setExtraFiles(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(String(index));
                          return newSet;
                        });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {extraFiles.size > 0 && !uploading && (
              <div className="text-xs text-muted-foreground">
                {extraFiles.size} file(s) marked as extras
              </div>
            )}
          </div>
        )}


        {/* Extras Section - Show below main uploads */}
        {extraFiles.size > 0 && uploadedFiles.length > 0 && (
          <div className="space-y-2 border-t pt-2">
            <div className="text-sm font-medium text-muted-foreground">Extras ({extraFiles.size})</div>
            <div className="max-h-24 overflow-y-auto space-y-1 border rounded p-2 bg-muted/30">
              {Array.from(extraFiles).map((fileId) => {
                const index = parseInt(fileId);
                const file = uploadedFiles[index];
                if (!file) return null;
                return (
                  <div key={index} className="flex items-center justify-between p-1.5 text-xs">
                    <span className="truncate flex-1">{file.name}</span>
                    <Badge variant="secondary" className="text-[10px]">Extra</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Editing Notes - Inline */}
        {uploadedFiles.length > 0 && !uploading && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes for Editor (Optional)</label>
            <textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Add any notes for the editor..."
              className="w-full min-h-[60px] max-h-[80px] p-2 border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
            />
          </div>
        )}

        {/* Submit Buttons with Progress Bar */}
        <div className="space-y-2">
          {/* Overall Progress Bar - shown during upload */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading {uploadedFiles.length} file(s)...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={handleSubmitRAW}
              disabled={uploading || uploadedFiles.length === 0}
              className="flex-1 relative overflow-hidden"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload RAW Photos
                </>
              )}
            </Button>
            
          </div>
        </div>
      </div>
    );
  };

  // Admin Upload Section - shows raw or edited uploader based on current context
  const AdminUploadSection = ({ 
    shoot, 
    onUploadComplete, 
    onEditedUploadComplete,
    uploadContext 
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
          <EditedUploadSection shoot={shoot} onUploadComplete={onEditedUploadComplete} isEditor={false} />
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
    const progress = getShootProgress();
    const progressLabel = getProgressLabel();
    
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
              Your photos are being professionally edited. We'll notify you when they're ready for viewing.
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
    <div className="flex flex-col h-full min-h-0 bg-background px-1 sm:px-4 lg:px-6" style={{ height: '100%', minHeight: '100%' }}>
      {/* Header - Tabs with Upload button inline on desktop, expand/collapse button */}
      <div className="border-b flex-shrink-0 bg-background pt-1 sm:pt-2">
        <div className="flex items-center justify-between gap-2">
          <Tabs value={activeSubTab === 'upload' ? displayTab : (activeSubTab === 'uploaded' || activeSubTab === 'edited' ? activeSubTab : defaultTab)} onValueChange={(v) => {
            if (v === 'media') {
              // Media tab defaults based on role
              if (isClient) {
                setActiveSubTab('edited');
                setDisplayTab('edited');
              } else {
                setActiveSubTab('uploaded');
                setDisplayTab('uploaded');
              }
            } else if (v === 'uploaded' && !isClient) {
              setActiveSubTab('uploaded');
              setDisplayTab('uploaded');
            } else if (v === 'edited' && !isPhotographer) {
              setActiveSubTab('edited');
              setDisplayTab('edited');
            }
          }} className="flex-1 min-w-0">
            <TabsList className="w-full justify-start h-7 sm:h-8 bg-background p-0 min-w-max sm:min-w-0 border-b">
              {/* Media tab - visible to all */}
              <TabsTrigger 
                value="media" 
                className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground whitespace-nowrap"
                onClick={() => {
                  // For clients, Media tab shows edited; for others, shows uploaded
                  if (isClient) {
                    setActiveSubTab('edited');
                    setDisplayTab('edited');
                  } else {
                    setActiveSubTab('uploaded');
                    setDisplayTab('uploaded');
                  }
                }}
              >
                Media
              </TabsTrigger>
              {/* Uploaded tab - hidden for clients (they only see edited media) */}
              {!isClient && (
              <TabsTrigger 
                value="uploaded" 
                className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground whitespace-nowrap"
                  onClick={() => {
                    setActiveSubTab('uploaded');
                    setDisplayTab('uploaded');
                  }}
                >
                  Raw Uploads ({rawFiles.length})
                </TabsTrigger>
              )}
              {/* Edited tab - hidden for photographers (they only see raw/uploaded media) */}
              {!isPhotographer && (
                <TabsTrigger 
                  value="edited" 
                  className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground whitespace-nowrap"
                  onClick={() => {
                    setActiveSubTab('edited');
                    setDisplayTab('edited');
                  }}
                >
                  Edited ({editedFiles.length})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          
          {/* List / Grid view toggle - visible on all screen sizes */}
          {(rawFiles.length > 0 || editedFiles.length > 0) && (
            <div className="flex sm:hidden items-center border rounded-md overflow-hidden flex-shrink-0">
              <button
                onClick={() => toggleMediaViewMode('list')}
                className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => toggleMediaViewMode('grid')}
                className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Upload and Download buttons - Inline on desktop, below on mobile */}
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            {/* Sort dropdown - hidden for editors */}
            {!isEditor && (rawFiles.length > 0 || editedFiles.length > 0) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    <span>Sort: {sortOrder === 'name' ? 'Name' : sortOrder === 'date' ? 'Date' : sortOrder === 'manual' ? 'Manual' : 'Time'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortOrder('time')}>
                    <span className={sortOrder === 'time' ? 'font-medium' : ''}>Time Captured</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder('name')}>
                    <span className={sortOrder === 'name' ? 'font-medium' : ''}>File Name</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder('date')}>
                    <span className={sortOrder === 'date' ? 'font-medium' : ''}>Date Added</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder('manual')}>
                    <span className={sortOrder === 'manual' ? 'font-medium' : ''}>Manual (Drag & Drop)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* List / Grid view toggle */}
            {(rawFiles.length > 0 || editedFiles.length > 0) && (
              <div className="flex items-center border rounded-md overflow-hidden">
                <button
                  onClick={() => toggleMediaViewMode('list')}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleMediaViewMode('grid')}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {/* Upload More button - only shown when files already exist */}
            {showUploadTab && (rawFiles.length > 0 || editedFiles.length > 0) && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-[11px] px-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setActiveSubTab('upload')}
              >
                <Upload className="h-3 w-3 mr-1" />
                <span>Upload More</span>
              </Button>
            )}
            {/* AI Edit, Download, Create Request, and Delete buttons for selected files */}
            {canDownload && selectedFiles.size > 0 && (
              <>
                {/* Hide AI Edit button for clients */}
                {!isClient && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] px-2 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => setShowAiEditDialog(true)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    <span>AI Edit ({selectedFiles.size})</span>
                  </Button>
                )}
                {/* Show Create Request button for clients when photos are selected */}
                {isClient && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] px-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setRequestManagerOpen(true)}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>Create Request ({selectedFiles.size})</span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" className="h-7 w-7 relative" disabled={downloading} title={`Download ${selectedFiles.size} file(s)`}>
                      <Download className="h-3.5 w-3.5" />
                      {selectedFiles.size > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                          {selectedFiles.size}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownload('original')}>
                      <Download className="h-4 w-4 mr-2" />
                      <div>
                        <div className="font-medium text-sm">Full Size</div>
                        <div className="text-xs text-muted-foreground">Original resolution</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload('small')}>
                      <Download className="h-4 w-4 mr-2" />
                      <div>
                        <div className="font-medium text-sm">Small Size</div>
                        <div className="text-xs text-muted-foreground">1800x1200px (optimized)</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {canDelete && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-7 w-7 relative bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleDeleteFiles}
                    title={`Delete ${selectedFiles.size} file(s)`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {selectedFiles.size > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-white text-red-600 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border border-red-300">
                        {selectedFiles.size}
                      </span>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
          
          {/* Expand/Collapse Button - Mobile only, on extreme right */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="sm:hidden flex items-center justify-center h-7 w-7 rounded hover:bg-muted/50 transition-colors flex-shrink-0"
              aria-label={isExpanded ? 'Collapse media' : 'Expand media'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Selected-file actions - Below tabs on mobile only */}
      {canDownload && selectedFiles.size > 0 && (
        <div className="mb-1.5 pb-1 border-b flex-shrink-0 sm:hidden">
          <div className="flex items-center justify-end gap-1.5">
            {/* AI Edit, Download, and Delete buttons for selected files */}
            {/* Hide AI Edit button for clients */}
            {!isClient && (
              <Button
                size="sm"
                className="h-7 text-[11px] px-2 w-full bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => setShowAiEditDialog(true)}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                <span>AI Edit</span>
              </Button>
            )}
            {/* Show Create Request button for clients when photos are selected */}
            {isClient && (
              <Button
                size="sm"
                className="h-7 text-[11px] px-2 w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setRequestManagerOpen(true)}
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                <span>Create Request</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" className="h-7 w-7 relative flex-shrink-0" disabled={downloading} title={`Download ${selectedFiles.size} file(s)`}>
                  <Download className="h-3.5 w-3.5" />
                  {selectedFiles.size > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {selectedFiles.size}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload('original')}>
                  <Download className="h-4 w-4 mr-2" />
                  <div>
                    <div className="font-medium text-sm">Full Size</div>
                    <div className="text-xs text-muted-foreground">Original resolution</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('small')}>
                  <Download className="h-4 w-4 mr-2" />
                  <div>
                    <div className="font-medium text-sm">Small Size</div>
                    <div className="text-xs text-muted-foreground">1800x1200px (optimized)</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canDelete && (
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7 relative flex-shrink-0 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteFiles}
                title={`Delete ${selectedFiles.size} file(s)`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selectedFiles.size > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-white text-red-600 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border border-red-300">
                    {selectedFiles.size}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content - Compact Overview-style layout */}
      <div className="flex-1 min-h-0 flex flex-col bg-background">
        {activeSubTab === 'upload' ? (
          /* Upload Tab Content */
          <div className="flex-1 flex flex-col min-h-0 p-2.5">
            <div className="border rounded-lg bg-card p-3 pb-6 flex flex-col">
              {isAdmin ? (
                /* Admins upload raw or edited files based on which tab they're on */
                <AdminUploadSection
                  shoot={shoot}
                  uploadContext={displayTab === 'edited' ? 'edited' : 'raw'}
                  onUploadComplete={() => {
                    toast({
                      title: 'Upload complete',
                      description: 'Files uploaded successfully',
                    });
                    // Invalidate React Query cache to refresh files
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                    onShootUpdate();
                    setActiveSubTab('uploaded');
                    setDisplayTab('uploaded');
                  }}
                  onEditedUploadComplete={() => {
                    toast({
                      title: 'Upload complete',
                      description: 'Edited files uploaded successfully',
                    });
                    // Invalidate React Query cache to refresh files
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                    onShootUpdate();
                    setActiveSubTab('edited');
                    setDisplayTab('edited');
                  }}
                />
              ) : isEditor ? (
                <EditedUploadSection
                  shoot={shoot}
                  isEditor={isEditor}
                    onUploadComplete={() => {
                      toast({
                        title: 'Upload complete',
                        description: 'Edited files uploaded successfully',
                      });
                      // Invalidate React Query cache to refresh files
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                      onShootUpdate();
                      setActiveSubTab('edited');
                      setDisplayTab('edited');
                    }}
                />
              ) : (
                <RawUploadSection
                  shoot={shoot}
                    onUploadComplete={() => {
                      toast({
                        title: 'Upload complete',
                        description: 'Files uploaded successfully',
                      });
                      // Invalidate React Query cache to refresh files
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                      onShootUpdate();
                      setActiveSubTab('uploaded');
                      setDisplayTab('uploaded');
                    }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-background" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Clients should only see edited media; raw uploads are hidden */}
            
            {/* Uploaded Media Tab - Hidden for clients */}
            {!isClient && displayTab === 'uploaded' && (
              <div
                className="flex-1 relative"
                style={{ minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
                onDragEnter={(e) => handleTabDragEnter(e, 'uploaded')}
                onDragLeave={handleTabDragLeave}
                onDragOver={handleTabDragOver}
                onDrop={(e) => handleDirectDrop(e, 'raw')}
              >
                {/* Drag overlay */}
                {dragOverTab === 'uploaded' && showUploadTab && (
                  <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2 text-primary">
                      <CloudUpload className="h-12 w-12" />
                      <span className="text-sm font-medium">Drop files to upload as Raw</span>
                    </div>
                  </div>
                )}
                {/* Direct upload progress bar */}
                {directUploading && displayTab === 'uploaded' && (
                  <div className="px-2.5 py-1.5 border-b bg-background flex-shrink-0">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Uploading {directUploadCompleted}/{directUploadTotal} file(s)...</span>
                      <span>{directUploadProgress}%</span>
                    </div>
                    <Progress value={directUploadProgress} className="h-1.5" />
                  </div>
                )}
                {/* Sub-tabs for Photos/Videos/iGuide/Floorplans */}
                <div className="sticky top-0 z-10 px-2.5 py-0.5 border-b bg-background" style={{ flexShrink: 0 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 overflow-x-auto">
                      <button
                        onClick={() => setUploadedMediaTab('photos')}
                        className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${uploadedMediaTab === 'photos' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        Photos ({uploadedPhotos.length})
                      </button>
                      {(shootHasVideoService || uploadedVideos.length > 0) && (
                        <button
                          onClick={() => setUploadedMediaTab('videos')}
                          className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${uploadedMediaTab === 'videos' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          Video ({uploadedVideos.length})
                        </button>
                      )}
                      {iguideUrl && (
                        <button
                          onClick={() => setUploadedMediaTab('iguide')}
                          className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${uploadedMediaTab === 'iguide' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          iGuide zip file
                        </button>
                      )}
                      {iguideFloorplans.length > 0 && (
                        <button
                          onClick={() => setUploadedMediaTab('floorplans')}
                          className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${uploadedMediaTab === 'floorplans' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          Floorplans ({iguideFloorplans.length})
                        </button>
                      )}
                    </div>
                    {showUploadTab && (
                      <Button
                        variant="default"
                        size="sm"
                        className="sm:hidden h-7 px-2.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setActiveSubTab('upload')}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload Files
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Sub-tab content */}
                <div style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
                  {uploadedMediaTab === 'photos' && (
                    uploadedPhotos.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
                          {/* Dashed circle with cloud icon */}
                          <div className="relative mb-6">
                            <div className="h-28 w-28 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                              <div className="h-20 w-20 rounded-full bg-muted dark:bg-slate-800/80 flex items-center justify-center">
                                <CloudUpload className="h-10 w-10 text-primary" />
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">No uploaded files yet</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            {shootHasVideoService ? 'Upload property photos and videos to get started.' : 'Upload property photos to get started.'} Our AI will automatically analyze assets for quality and categorization.
                          </p>
                          {showUploadTab && (
                            <Button
                              variant="default"
                              size="lg"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => setActiveSubTab('upload')}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Files
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full m-0 sm:m-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card overflow-y-auto p-1 sm:p-2.5">
                        <MediaGrid
                          files={uploadedPhotos}
                          onFileClick={(index) => openViewer(index, uploadedPhotos)}
                          selectedFiles={selectedFiles}
                          onSelectionChange={toggleSelection}
                          onSelectAll={() => {
                            if (selectedFiles.size === uploadedPhotos.length) {
                              setSelectedFiles(new Set());
                            } else {
                              setSelectedFiles(new Set(uploadedPhotos.map(f => f.id)));
                            }
                          }}
                          canSelect={canDownload}
                          sortOrder={sortOrder}
                          manualOrder={manualOrder}
                          onManualOrderChange={setManualOrder}
                          getImageUrl={getImageUrl}
                          getSrcSet={getSrcSet}
                          isImage={isPreviewableImage}
                          viewMode={mediaViewMode}
                        />
                      </div>
                    )
                  )}
                  
                  {uploadedMediaTab === 'videos' && (
                    uploadedVideos.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
                          {/* Dashed circle with cloud icon */}
                          <div className="relative mb-6">
                            <div className="h-28 w-28 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                              <div className="h-20 w-20 rounded-full bg-muted dark:bg-slate-800/80 flex items-center justify-center">
                                <CloudUpload className="h-10 w-10 text-primary" />
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">No uploaded videos yet</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Upload property videos to get started. Our AI will automatically analyze assets for quality and categorization.
                          </p>
                          {showUploadTab && (
                            <Button
                              variant="default"
                              size="lg"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => setActiveSubTab('upload')}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Videos
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full m-0 sm:m-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card overflow-y-auto p-1 sm:p-2.5">
                        <MediaGrid
                          files={uploadedVideos}
                          onFileClick={(index) => openViewer(index, uploadedVideos)}
                          selectedFiles={selectedFiles}
                          onSelectionChange={toggleSelection}
                          onSelectAll={() => {
                            if (selectedFiles.size === uploadedVideos.length) {
                              setSelectedFiles(new Set());
                            } else {
                              setSelectedFiles(new Set(uploadedVideos.map(f => f.id)));
                            }
                          }}
                          canSelect={canDownload}
                          sortOrder={sortOrder}
                          manualOrder={manualOrder}
                          onManualOrderChange={setManualOrder}
                          getImageUrl={getImageUrl}
                          getSrcSet={getSrcSet}
                          isImage={isPreviewableImage}
                          viewMode={mediaViewMode}
                        />
                      </div>
                    )
                  )}
                  
                  {uploadedMediaTab === 'iguide' && iguideUrl && (
                    <div className="h-full m-2.5 border rounded-lg bg-card p-4">
                      <div className="flex flex-col gap-4">
                        <div>
                          <h4 className="font-medium mb-2">iGuide 3D Tour</h4>
                          <a
                            href={iguideUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            View 3D Tour <ChevronRight className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="aspect-video w-full max-w-2xl rounded-lg overflow-hidden border">
                          <iframe
                            src={iguideUrl}
                            className="w-full h-full"
                            allowFullScreen
                            title="iGuide 3D Tour"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {uploadedMediaTab === 'floorplans' && iguideFloorplans.length > 0 && (
                    <div className="h-full m-2.5 border rounded-lg bg-card overflow-y-auto p-4">
                      <h4 className="font-medium mb-3">Floorplans ({iguideFloorplans.length})</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {iguideFloorplans.map((fp, idx) => (
                          <div key={idx} className="border rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileIcon className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">{fp.filename || `Floorplan ${idx + 1}`}</span>
                            </div>
                            <a
                              href={fp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edited Media Tab - Hidden for photographers */}
            {!isPhotographer && displayTab === 'edited' && (
              <div
                className="flex-1 relative"
                style={{ minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
                onDragEnter={(e) => handleTabDragEnter(e, 'edited')}
                onDragLeave={handleTabDragLeave}
                onDragOver={handleTabDragOver}
                onDrop={(e) => handleDirectDrop(e, 'edited')}
              >
                {/* Drag overlay */}
                {dragOverTab === 'edited' && showUploadTab && (
                  <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2 text-primary">
                      <CloudUpload className="h-12 w-12" />
                      <span className="text-sm font-medium">Drop files to upload as Edited</span>
                    </div>
                  </div>
                )}
                {/* Direct upload progress bar */}
                {directUploading && displayTab === 'edited' && (
                  <div className="px-2.5 py-1.5 border-b bg-background flex-shrink-0">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Uploading {directUploadCompleted}/{directUploadTotal} file(s)...</span>
                      <span>{directUploadProgress}%</span>
                    </div>
                    <Progress value={directUploadProgress} className="h-1.5" />
                  </div>
                )}
                {/* Sub-tabs for Photos/Videos/iGuide/Floorplans */}
                <div className="sticky top-0 z-10 px-2.5 py-0.5 border-b bg-background" style={{ flexShrink: 0 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 overflow-x-auto">
                      <button
                        onClick={() => setEditedMediaTab('photos')}
                        className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${editedMediaTab === 'photos' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        Photos ({editedPhotos.length})
                      </button>
                      {(shootHasVideoService || editedVideos.length > 0) && (
                        <button
                          onClick={() => setEditedMediaTab('videos')}
                          className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${editedMediaTab === 'videos' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          Video ({editedVideos.length})
                        </button>
                      )}
                      {iguideUrl && (
                        <button
                          onClick={() => setEditedMediaTab('iguide')}
                          className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${editedMediaTab === 'iguide' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          iGuide zip file
                        </button>
                      )}
                      {iguideFloorplans.length > 0 && (
                        <button
                          onClick={() => setEditedMediaTab('floorplans')}
                          className={`text-xs py-1 border-b-2 transition-colors whitespace-nowrap ${editedMediaTab === 'floorplans' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          Floorplans ({iguideFloorplans.length})
                        </button>
                      )}
                    </div>
                    {showUploadTab && (
                      <Button
                        variant="default"
                        size="sm"
                        className="sm:hidden h-7 px-2.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setActiveSubTab('upload')}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload Files
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Sub-tab content */}
                <div style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
                  {editedMediaTab === 'photos' && (
                    editedPhotos.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
                          {/* Dashed circle with cloud icon */}
                          <div className="relative mb-6">
                            <div className="h-28 w-28 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                              <div className="h-20 w-20 rounded-full bg-muted dark:bg-slate-800/80 flex items-center justify-center">
                                <CloudUpload className="h-10 w-10 text-primary" />
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">No edited files yet</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Upload edited photos and videos to get started. Our AI will automatically analyze assets for quality and categorization.
                          </p>
                          {showUploadTab && (
                            <Button
                              variant="default"
                              size="lg"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => setActiveSubTab('upload')}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Files
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full m-0 sm:m-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card overflow-y-auto p-1 sm:p-2.5">
                        <MediaGrid
                          files={editedPhotos}
                          onFileClick={(index) => openViewer(index, editedPhotos)}
                          selectedFiles={selectedFiles}
                          onSelectionChange={toggleSelection}
                          onSelectAll={() => {
                            if (selectedFiles.size === editedPhotos.length) {
                              setSelectedFiles(new Set());
                            } else {
                              setSelectedFiles(new Set(editedPhotos.map(f => f.id)));
                            }
                          }}
                          canSelect={canDownload}
                          sortOrder={sortOrder}
                          manualOrder={manualOrder}
                          onManualOrderChange={setManualOrder}
                          getImageUrl={getImageUrl}
                          getSrcSet={getSrcSet}
                          isImage={isPreviewableImage}
                          viewMode={mediaViewMode}
                        />
                      </div>
                    )
                  )}
                  
                  {editedMediaTab === 'videos' && (
                    editedVideos.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
                          {/* Dashed circle with cloud icon */}
                          <div className="relative mb-6">
                            <div className="h-28 w-28 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                              <div className="h-20 w-20 rounded-full bg-muted dark:bg-slate-800/80 flex items-center justify-center">
                                <CloudUpload className="h-10 w-10 text-primary" />
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">No edited videos yet</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Upload edited videos to get started. Our AI will automatically analyze assets for quality and categorization.
                          </p>
                          {showUploadTab && (
                            <Button
                              variant="default"
                              size="lg"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => setActiveSubTab('upload')}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Videos
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full m-0 sm:m-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card overflow-y-auto p-1 sm:p-2.5">
                        <MediaGrid
                          files={editedVideos}
                          onFileClick={(index) => openViewer(index, editedVideos)}
                          selectedFiles={selectedFiles}
                          onSelectionChange={toggleSelection}
                          onSelectAll={() => {
                            if (selectedFiles.size === editedVideos.length) {
                              setSelectedFiles(new Set());
                            } else {
                              setSelectedFiles(new Set(editedVideos.map(f => f.id)));
                            }
                          }}
                          canSelect={canDownload}
                          sortOrder={sortOrder}
                          manualOrder={manualOrder}
                          onManualOrderChange={setManualOrder}
                          getImageUrl={getImageUrl}
                          getSrcSet={getSrcSet}
                          isImage={isPreviewableImage}
                          viewMode={mediaViewMode}
                        />
                      </div>
                    )
                  )}
                  
                  {editedMediaTab === 'iguide' && iguideUrl && (
                    <div className="h-full m-2.5 border rounded-lg bg-card p-4">
                      <div className="flex flex-col gap-4">
                        <div>
                          <h4 className="font-medium mb-2">iGuide 3D Tour</h4>
                          <a
                            href={iguideUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            View 3D Tour <ChevronRight className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="aspect-video w-full max-w-2xl rounded-lg overflow-hidden border">
                          <iframe
                            src={iguideUrl}
                            className="w-full h-full"
                            allowFullScreen
                            title="iGuide 3D Tour"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {editedMediaTab === 'floorplans' && iguideFloorplans.length > 0 && (
                    <div className="h-full m-2.5 border rounded-lg bg-card overflow-y-auto p-4">
                      <h4 className="font-medium mb-3">Floorplans ({iguideFloorplans.length})</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {iguideFloorplans.map((fp, idx) => (
                          <div key={idx} className="border rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileIcon className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">{fp.filename || `Floorplan ${idx + 1}`}</span>
                            </div>
                            <a
                              href={fp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Viewer */}
      <MediaViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        files={viewerFiles}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
        getImageUrl={getImageUrl}
        getSrcSet={getSrcSet}
        shoot={shoot}
        isAdmin={isAdmin}
        onShootUpdate={onShootUpdate}
      />

      {/* AI Edit Dialog */}
      <Dialog open={showAiEditDialog} onOpenChange={setShowAiEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Edit Images</DialogTitle>
            <DialogDescription>
              Select an editing type to apply to {selectedFiles.size} selected image(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Editing Type</Label>
              <Select
                value={selectedEditingType}
                onValueChange={setSelectedEditingType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select editing type" />
                </SelectTrigger>
                <SelectContent>
                  {editingTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingTypes.find(t => t.id === selectedEditingType) && (
                <p className="text-sm text-muted-foreground">
                  {editingTypes.find(t => t.id === selectedEditingType)?.description}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAiEditDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAiEdit}
                disabled={submittingAiEdit || !selectedEditingType}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {submittingAiEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Manager Modal - for creating requests with selected photos */}
      <ShootIssueManager
        isOpen={requestManagerOpen}
        onClose={() => {
          setRequestManagerOpen(false);
          setSelectedFiles(new Set()); // Clear selection after closing
        }}
        shootId={shoot.id}
        isAdmin={isAdmin}
        isPhotographer={isPhotographer}
        isEditor={isEditor}
        isClient={isClient}
        onIssueUpdate={() => {
          onShootUpdate();
          setSelectedFiles(new Set()); // Clear selection after request is created
        }}
        preselectedMediaIds={Array.from(selectedFiles)}
      />
    </div>
  );
}

// Media Grid Component
interface MediaGridProps {
  files: MediaFile[];
  onFileClick: (index: number) => void;
  selectedFiles: Set<string>;
  onSelectionChange: (fileId: string) => void;
  onSelectAll?: () => void;
  canSelect: boolean;
  sortOrder?: 'name' | 'date' | 'time' | 'manual';
  manualOrder?: string[];
  onManualOrderChange?: (newOrder: string[]) => void;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  getSrcSet: (file: MediaFile) => string;
  isImage: (file: MediaFile) => boolean;
  viewMode?: 'list' | 'grid';
}

function MediaGrid({ 
  files, 
  onFileClick, 
  selectedFiles, 
  onSelectionChange,
  onSelectAll,
  canSelect,
  sortOrder = 'time',
  manualOrder = [],
  onManualOrderChange,
  getImageUrl,
  getSrcSet,
  isImage,
  viewMode = 'list',
}: MediaGridProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Sort files based on sortOrder, then separate regular and extra files
  const sortedFiles = useMemo(() => {
    if (sortOrder === 'manual' && manualOrder.length > 0) {
      // Sort by manual order
      const orderMap = new Map(manualOrder.map((id, idx) => [id, idx]));
      return [...files].sort((a, b) => {
        const idxA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const idxB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return idxA - idxB;
      });
    }
    
    return [...files].sort((a, b) => {
      if (sortOrder === 'name') {
        return (a.filename || '').localeCompare(b.filename || '');
      } else if (sortOrder === 'date') {
        const dateA = a.created_at || '';
        const dateB = b.created_at || '';
        return dateA.localeCompare(dateB);
      } else {
        // time - sort by captured_at
        const timeA = a.captured_at || a.created_at || '';
        const timeB = b.captured_at || b.created_at || '';
        return timeA.localeCompare(timeB);
      }
    });
  }, [files, sortOrder, manualOrder]);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    if (sortOrder !== 'manual') return;
    setDraggedId(fileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, fileId: string) => {
    if (sortOrder !== 'manual' || !draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (fileId !== draggedId) {
      setDragOverId(fileId);
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverId(null);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (sortOrder !== 'manual' || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    // Get current order or create from files
    const currentOrder = manualOrder.length > 0 
      ? [...manualOrder] 
      : sortedFiles.filter(f => !f.isExtra).map(f => f.id);
    
    const draggedIdx = currentOrder.indexOf(draggedId);
    const targetIdx = currentOrder.indexOf(targetId);
    
    if (draggedIdx !== -1 && targetIdx !== -1) {
      // Remove dragged item and insert at target position
      currentOrder.splice(draggedIdx, 1);
      currentOrder.splice(targetIdx, 0, draggedId);
      onManualOrderChange?.(currentOrder);
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };
  
  const regularFiles = sortedFiles.filter(f => !f.isExtra);
  const extraFiles = sortedFiles.filter(f => f.isExtra);

  // Helper function to format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Helper function to format date/time
  const formatDateTime = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '-';
    }
  };

  // Helper function to get resolution string
  const getResolution = (file: MediaFile): string => {
    if (file.width && file.height) {
      return `${file.width} × ${file.height}`;
    }
    return '-';
  };
  
  const renderFileCard = (file: MediaFile, index: number, isExtraSection: boolean = false) => {
    const isSelected = selectedFiles.has(file.id);
    const isImg = isImage(file);
    const isRaw = isRawFile(file.filename);
    const imageUrl = getImageUrl(file, 'medium');
    const srcSet = getSrcSet(file);
    const ext = file.filename.split('.').pop()?.toUpperCase();
    
    // Find the actual index in the full sorted array for viewer
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    
    const isDragging = draggedId === file.id;
    const isDragOver = dragOverId === file.id;
    
    return (
      <div
        key={file.id}
        draggable={sortOrder === 'manual' && !isExtraSection}
        onDragStart={(e) => handleDragStart(e, file.id)}
        onDragOver={(e) => handleDragOver(e, file.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, file.id)}
        onDragEnd={handleDragEnd}
        className={`relative aspect-square rounded overflow-hidden border cursor-pointer transition-all group ${
          isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
        } ${isExtraSection ? 'opacity-90' : ''} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${sortOrder === 'manual' && !isExtraSection ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={() => {
          onFileClick(actualIndex);
        }}
      >
        {/* Simple image display - backend generates thumbnails at upload time */}
        {/* For RAW files, only show image if we have a processed thumbnail (thumbnail_path set by backend) */}
        {/* For non-RAW files, show the image URL */}
        {(() => {
          // For RAW files, we need an actual processed thumbnail (thumbnail_path is only set on success)
          // Don't try to display original RAW file URLs - browsers can't render them
          const hasProcessedThumb = isRaw 
            ? !!(file.thumbnail_path || file.web_path)
            : true;
          const hasDisplayableImage = hasProcessedThumb && (file.thumb || imageUrl);
          const thumbSrc = file.thumb || getImageUrl(file, 'thumb');
          
          return hasDisplayableImage ? (
            <img
              src={thumbSrc}
              srcSet={!isRaw ? srcSet : undefined}
              sizes={!isRaw ? "(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw" : undefined}
              alt={file.filename}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // On error, hide image and show fallback
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.file-fallback') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null;
        })()}
        
        {/* Fallback placeholder - shown if no thumbnail or on load error */}
        <div 
          className="file-fallback w-full h-full items-center justify-center bg-muted absolute inset-0"
          style={{ display: (() => {
            const hasProcessedThumb = isRaw 
              ? !!(file.thumbnail_path || file.web_path)
              : true;
            const hasDisplayableImage = hasProcessedThumb && (file.thumb || imageUrl);
            return !hasDisplayableImage ? 'flex' : 'none';
          })() }}
        >
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-[10px] font-semibold uppercase">{ext || 'FILE'}</span>
          </div>
        </div>
        
        {/* Extra badge */}
        {file.isExtra && (
          <div className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
            EXTRA
          </div>
        )}
        
        {/* Hero badge */}
        {file.is_cover && !file.isExtra && (
          <div className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
            HERO
          </div>
        )}
        
        {isSelected && (
          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}
        
        {canSelect && (
          <div 
            className={`absolute ${file.isExtra ? 'top-5' : 'top-1'} left-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectionChange(file.id)}
              className="bg-background/80"
            />
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden whitespace-nowrap">
          <span className="inline-block group-hover:animate-marquee">
            {file.filename}
          </span>
        </div>
      </div>
    );
  };

  // List view row renderer
  const renderFileRow = (file: MediaFile, index: number, isExtraSection: boolean = false) => {
    const isSelected = selectedFiles.has(file.id);
    const isRaw = isRawFile(file.filename);
    const imageUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const isDragging = draggedId === file.id;
    const isDragOver = dragOverId === file.id;

    const hasProcessedThumb = isRaw 
      ? !!(file.thumbnail_path || file.web_path)
      : true;
    const hasDisplayableImage = hasProcessedThumb && (file.thumb || imageUrl);

    return (
      <div
        key={file.id}
        draggable={sortOrder === 'manual' && !isExtraSection}
        onDragStart={(e) => handleDragStart(e, file.id)}
        onDragOver={(e) => handleDragOver(e, file.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, file.id)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg border cursor-pointer transition-all group hover:bg-muted/50 ${
          isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
        } ${isExtraSection ? 'opacity-90' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${sortOrder === 'manual' && !isExtraSection ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={() => {
          onFileClick(actualIndex);
        }}
      >
        {/* Selection indicator - moved to left */}
        {canSelect && (
          <div 
            className="flex-shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectionChange(file.id);
            }}
          >
            {isSelected ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </div>
        )}

        {/* Thumbnail - wide aspect ratio */}
        <div className="relative w-20 h-12 sm:w-28 sm:h-16 flex-shrink-0 rounded overflow-hidden border bg-muted">
          {hasDisplayableImage ? (
            <img
              src={file.thumb || imageUrl}
              alt={file.filename}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.file-fallback') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="file-fallback w-full h-full items-center justify-center bg-muted absolute inset-0"
            style={{ display: !hasDisplayableImage ? 'flex' : 'none' }}
          >
            <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              <span className="text-[8px] font-semibold uppercase">{ext || 'FILE'}</span>
            </div>
          </div>
          {file.isExtra && (
            <div className="absolute top-0.5 left-0.5 bg-orange-500 text-white text-[6px] px-0.5 py-0 rounded font-medium">
              EXTRA
            </div>
          )}
        </div>

        {/* Filename - takes remaining space */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" title={file.filename}>
            {file.filename}
          </p>
          <p className="text-[10px] text-muted-foreground sm:hidden">
            {formatDateTime(file.captured_at || file.created_at)}
          </p>
        </div>

        {/* Shot Time - fixed width on right */}
        <div className="hidden sm:block w-36 flex-shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">Shot Time</p>
          <p className="text-xs">{formatDateTime(file.captured_at || file.created_at)}</p>
        </div>

        {/* Size - fixed width on right */}
        <div className="hidden sm:block w-20 flex-shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">Size</p>
          <p className="text-xs">{formatFileSize(file.fileSize)}</p>
        </div>

      </div>
    );
  };

  if (viewMode === 'grid') {
    return (
      <div className="space-y-2">
        {/* Select all for grid view */}
        {canSelect && files.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <div 
              className="cursor-pointer hover:text-foreground transition-colors text-muted-foreground"
              onClick={onSelectAll}
              title={selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
            >
              {selectedFiles.size === files.length ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : selectedFiles.size > 0 ? (
                <MinusCircle className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {selectedFiles.size > 0 ? `${selectedFiles.size} selected` : 'Select all'}
            </span>
          </div>
        )}

        {/* Regular files - grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
          {regularFiles.map((file, index) => renderFileCard(file, index, false))}
        </div>

        {/* Extra files section with separator */}
        {extraFiles.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-orange-500/30" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 px-2">
                Extras ({extraFiles.length})
              </span>
              <div className="flex-1 h-px bg-orange-500/30" />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
              {extraFiles.map((file, index) => renderFileCard(file, index, true))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header row - visible on larger screens */}
      <div className="hidden sm:flex items-center gap-3 px-2 py-1 text-[10px] text-muted-foreground font-medium border-b">
        {canSelect && (
          <div 
            className="w-4 flex-shrink-0 cursor-pointer hover:text-foreground transition-colors"
            onClick={onSelectAll}
            title={selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
          >
            {selectedFiles.size === files.length ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : selectedFiles.size > 0 ? (
              <MinusCircle className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </div>
        )}
        <div className="w-28 flex-shrink-0">Preview</div>
        <div className="flex-1">Filename</div>
        <div className="w-36 flex-shrink-0 text-right">Shot Time</div>
        <div className="w-20 flex-shrink-0 text-right">Size</div>
        <div className="w-6 flex-shrink-0"></div>
      </div>

      {/* Regular files */}
      <div className="space-y-1">
        {regularFiles.map((file, index) => renderFileRow(file, index, false))}
      </div>
      
      {/* Extra files section with separator */}
      {extraFiles.length > 0 && (
        <>
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-orange-500/30" />
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 px-2">
              Extras ({extraFiles.length})
            </span>
            <div className="flex-1 h-px bg-orange-500/30" />
          </div>
          <div className="space-y-1">
            {extraFiles.map((file, index) => renderFileRow(file, index, true))}
          </div>
        </>
      )}
    </div>
  );
}

// Media Viewer Component
interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  files: MediaFile[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  getSrcSet: (file: MediaFile) => string;
  shoot?: ShootData;
  isAdmin?: boolean;
  onShootUpdate?: () => void;
}

function MediaViewer({ 
  isOpen, 
  onClose, 
  files, 
  currentIndex, 
  onIndexChange,
  getImageUrl,
  getSrcSet,
  shoot,
  isAdmin = false,
  onShootUpdate,
}: MediaViewerProps) {
  const { toast } = useToast();
  
  const isImageFile = (file: MediaFile): boolean => {
    // If RAW file has processed thumbnail, it's displayable
    if ((file.media_type === 'raw' || file.media_type === 'image') && (file.thumbnail_path || file.thumb || file.medium)) {
      return true;
    }

    const name = file.filename.toLowerCase();
    const rawExt = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/.test(name);
    if (rawExt) return false;

    const mime = (file.fileType || '').toLowerCase();
    const rawMime = mime.includes('nef') || mime.includes('dng') || mime.includes('cr2') || mime.includes('cr3') || mime.includes('arw') || mime.includes('raf') || mime.includes('raw');
    if (rawMime) return false;

    if (mime.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(name);
  };
  const isPreviewableImage = (file: MediaFile): boolean => {
    // If RAW file has processed thumbnail, it's previewable
    if ((file.media_type === 'raw' || file.media_type === 'image') && (file.thumbnail_path || file.thumb || file.medium)) {
      return true;
    }

    const name = file.filename.toLowerCase();
    const rawExt = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/.test(name);
    if (rawExt) return false;

    const mime = (file.fileType || '').toLowerCase();
    const rawMime = mime.includes('nef') || mime.includes('dng') || mime.includes('cr2') || mime.includes('cr3') || mime.includes('arw') || mime.includes('raf') || mime.includes('raw');
    if (rawMime) return false;

    if (mime.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(name);
  };
  const [zoom, setZoom] = useState(1);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagging, setFlagging] = useState(false);
  const currentFile = files[currentIndex];

  const handleFlagImage = async () => {
    if (!shoot || !currentFile || !flagReason.trim()) return;
    
    setFlagging(true);
    try {
      const headers = getApiHeaders();
      
      // Create an issue linked to this media file
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          note: flagReason.trim(),
          mediaId: currentFile.id,
          assignedToRole: 'editor', // Auto-assign to editor for image corrections
        }),
      });

      if (!res.ok) throw new Error('Failed to create issue');

      // Also flag the file if endpoint exists
      try {
        await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/${currentFile.id}/flag`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            reason: flagReason.trim(),
            file_id: currentFile.id,
          }),
        });
      } catch (flagError) {
        console.warn('File flagging endpoint not available, issue created only');
      }

      toast({
        title: 'Success',
        description: 'Issue created and image flagged successfully',
      });
      setShowFlagDialog(false);
      setFlagReason('');
      onShootUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to flag image and create issue',
        variant: 'destructive',
      });
    } finally {
      setFlagging(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
      setZoom(1); // Reset zoom when navigating
    }
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      onIndexChange(currentIndex + 1);
      setZoom(1); // Reset zoom when navigating
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
        setZoom(1);
      } else if (e.key === 'ArrowRight' && currentIndex < files.length - 1) {
        onIndexChange(currentIndex + 1);
        setZoom(1);
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(prev => Math.min(prev + 0.25, 3));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(prev => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, files.length, onClose, onIndexChange]);

  if (!isOpen || !currentFile) return null;

  // Use medium size for viewer (1500px) - only load original when user explicitly requests
  const imageUrl = getImageUrl(currentFile, 'medium') || getImageUrl(currentFile, 'large');
  const srcSet = getSrcSet(currentFile);
  const isImg = isPreviewableImage(currentFile);
  const fileExt = currentFile?.filename?.split('.')?.pop()?.toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!fixed !inset-0 !translate-x-0 !translate-y-0 max-w-none max-h-none w-screen h-screen p-0 bg-black/95 backdrop-blur-md border-0 rounded-none [&>button:last-child]:hidden"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: 'none',
          width: '100vw',
          height: '100dvh',
          zIndex: 100,
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Media Viewer</DialogTitle>
          <DialogDescription>
            View and navigate through media files for this shoot
          </DialogDescription>
        </DialogHeader>
        {/* Glass blur overlay background */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 text-white hover:bg-white/20 rounded-full h-9 w-9 sm:h-10 sm:w-10"
            onClick={onClose}
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>

          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 sm:left-4 z-10 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
            </Button>
          )}

          {/* Top Metadata Bar */}
          {isImg && currentFile && (
            <div className="absolute top-12 sm:top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-md rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-4 text-white text-xs sm:text-sm max-w-[90vw]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{currentFile.filename}</span>
              </div>
              {currentFile.width && currentFile.height && (
                <div className="text-white/70 hidden sm:block">
                  {currentFile.width} × {currentFile.height}
                </div>
              )}
              {currentFile.fileSize && (
                <div className="text-white/70 hidden sm:block">
                  {(currentFile.fileSize / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
              {shoot && isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-white hover:bg-white/20"
                  onClick={async () => {
                    try {
                      const headers = getApiHeaders();
                      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/${currentFile.id}/cover`, {
                        method: 'POST',
                        headers,
                      });
                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                        console.error('Cover API error:', response.status, errorData);
                        throw new Error(errorData.message || `HTTP ${response.status}`);
                      }
                      toast({ title: 'Hero Image', description: 'Hero image updated successfully' });
                      onShootUpdate();
                    } catch (error) {
                      console.error('Set cover error:', error);
                      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to set hero image', variant: 'destructive' });
                    }
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Make Hero
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-center p-2 sm:p-8 overflow-auto" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            {isImg ? (
              <img
                src={imageUrl}
                srcSet={srcSet}
                sizes="95vw"
                alt={currentFile.filename}
                className="max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain select-none rounded-lg shadow-2xl"
                loading="eager"
                draggable={false}
              />
            ) : (
              <div className="text-white text-center">
                <FileIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4" />
                <p className="text-sm sm:text-base">{currentFile.filename}</p>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          {isImg && (
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-20 flex items-center gap-1 sm:gap-2 bg-black/60 backdrop-blur-md rounded-lg p-1 sm:p-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom out"
              >
                <span className="text-sm">−</span>
              </Button>
              <span className="text-white text-[10px] sm:text-xs min-w-[2.5rem] sm:min-w-[3rem] text-center font-medium">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                title="Zoom in"
              >
                <span className="text-sm">+</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-8 text-[10px] sm:text-xs text-white hover:bg-white/20 hidden sm:inline-flex"
                onClick={handleResetZoom}
                title="Reset zoom (0)"
              >
                Reset
              </Button>
            </div>
          )}

          {/* Flag Image Button (Admin only) */}
          {isAdmin && isImg && shoot && (
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 sm:top-4 right-14 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-10 h-7 sm:h-8 text-xs"
              onClick={() => setShowFlagDialog(true)}
            >
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Flag Issue</span>
              <span className="sm:hidden">Flag</span>
            </Button>
          )}

          {currentIndex < files.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 sm:right-4 z-10 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12"
              onClick={handleNext}
            >
              <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
            </Button>
          )}

          {/* Bottom Filmstrip */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md text-white p-2 sm:p-4 z-20">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">{currentFile.filename}</div>
                <div className="text-[10px] sm:text-xs text-gray-300">
                  {currentIndex + 1} of {files.length}
                </div>
              </div>
              <div className="text-xs text-gray-400 hidden sm:block">
                Use ← → arrow keys to navigate • + - to zoom • ESC to close
              </div>
            </div>
            
            {/* Filmstrip Thumbnails */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {files.map((file, index) => {
                const isActive = index === currentIndex;
                const fileImageUrl = getImageUrl(file, 'thumb');
                const fileIsImg = isImageFile(file);
                const fileIsRaw = isRawFile(file.filename);
                // For RAW files, only show thumbnail if processed (thumbnail_path exists)
                const hasDisplayableThumb = fileIsRaw 
                  ? !!(file.thumbnail_path || file.web_path)
                  : fileIsImg;
                
                return (
                  <button
                    key={file.id}
                    onClick={() => {
                      onIndexChange(index);
                      setZoom(1);
                    }}
                    className={`flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded overflow-hidden border-2 transition-all ${
                      isActive 
                        ? 'border-white ring-2 ring-white/50 scale-105' 
                        : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {hasDisplayableThumb && fileImageUrl ? (
                      <img
                        src={fileImageUrl}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full bg-muted items-center justify-center"
                      style={{ display: hasDisplayableThumb && fileImageUrl ? 'none' : 'flex' }}
                    >
                      <FileIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Flag Image Dialog */}
        {isAdmin && shoot && (
          <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Flag Image Issue</DialogTitle>
                <DialogDescription>
                  Flag this image for correction or re-editing. This will create an issue visible to the editor.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Issue Description</Label>
                  <Textarea
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Describe what needs to be corrected..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowFlagDialog(false);
                    setFlagReason('');
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleFlagImage} 
                    disabled={!flagReason.trim() || flagging}
                    variant="destructive"
                  >
                    {flagging ? 'Flagging...' : 'Flag Image'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}


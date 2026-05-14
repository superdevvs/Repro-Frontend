import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  ExternalLink,
  Image as ImageIcon,
  Info,
  ListChecks,
  Loader2,
  Maximize2,
  MessageCircle,
  Plus,
  RectangleVertical,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Wand2,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  autoenhanceService,
  type ConnectionStatus,
  type EditingJob,
  type EditingType,
} from '@/services/autoenhanceService';
import { API_BASE_URL } from '@/config/env';
import { useAuth } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { AiEditingStepper } from '@/components/ai-editing/AiEditingStepper';
import { AiEditingModePicker } from '@/components/ai-editing/AiEditingModePicker';
import { AiEditingJobCard } from '@/components/ai-editing/AiEditingJobCard';
import { AiEditingComparisonLightbox } from '@/components/ai-editing/AiEditingComparisonLightbox';
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AiMessageBubble } from '@/components/ai/AiMessageBubble';
import { sendAiMessage } from '@/services/aiService';
import type { AiMessage } from '@/types/ai';

interface ShootWithEditing {
  id: number;
  address: string;
  status: string;
  workflowStatus?: string;
  photo_count?: number;
  raw_photo_count?: number;
  edited_photo_count?: number;
  client_name?: string;
  created_at: string;
  thumbnail?: string | null;
  auto_edit_enabled?: boolean;
}

interface MediaFile {
  id: number;
  filename: string;
  url?: string;
  path?: string;
  thumb_url?: string;
  medium_url?: string;
  large_url?: string;
  original_url?: string;
  fileType?: string;
  workflowStage?: string;
  created_at?: string;
  isEdited?: boolean;
  isAiEdited?: boolean;
}

type ViewMode = 'activity' | 'chat' | 'select-shoot' | 'select-files' | 'configure';
type JobStatus = EditingJob['status'];
type StatusFilter = 'all' | JobStatus;
type EnhancementModeId = 'enhance' | 'sky_replace' | 'vertical_correction' | 'window_pull';

const editingTypeLabels: Record<string, string> = {
  enhance: 'Enhance',
  enhance_custom: 'Custom Autoenhance',
  sky_replace: 'Sky Replacement',
  hdr_merge: 'HDR Bracket Merge',
  vertical_correction: 'Vertical Correction',
  window_pull: 'Window Pull',
};

const STEPPER_STEPS = [
  { id: 'select-shoot', label: 'Shoot', description: 'Pick a property' },
  { id: 'select-files', label: 'Photos', description: 'Choose source images' },
  { id: 'configure', label: 'Configure', description: 'Mode, options & submit' },
];

const MAX_BATCH_SIZE = 100;
const COMBINABLE_MODE_IDS = new Set<string>(['enhance', 'sky_replace', 'vertical_correction', 'window_pull']);
const UNSUPPORTED_MODE_IDS = new Set<string>(['hdr_merge']);

const AiEditing = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('activity');

  const [shoots, setShoots] = useState<ShootWithEditing[]>([]);
  const [selectedShoot, setSelectedShoot] = useState<ShootWithEditing | null>(null);
  const [availableFiles, setAvailableFiles] = useState<MediaFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [editingTypes, setEditingTypes] = useState<EditingType[]>([]);
  const [selectedEnhancementIds, setSelectedEnhancementIds] = useState<Set<EnhancementModeId>>(new Set(['enhance']));
  const [jobs, setJobs] = useState<EditingJob[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);

  const [loadingShoots, setLoadingShoots] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mutatingJobId, setMutatingJobId] = useState<number | null>(null);
  const [quickSendRippleKey, setQuickSendRippleKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<StatusFilter>('all');
  const [jobShootFilter, setJobShootFilter] = useState('');

  // Recent-activity pagination
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPageSize, setJobsPageSize] = useState<number>(30);

  const [quickStartMode, setQuickStartMode] = useState<EnhancementModeId>('enhance');

  // Conversational tools chat state
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Inline image attachments selected via the + button on the prompt card.
  type AttachedImage = { id: string; file: File; previewUrl: string };
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [enhanceType, setEnhanceType] = useState<'neutral'>('neutral');
  const [lensCorrection, setLensCorrection] = useState(true);
  const [windowPullType, setWindowPullType] = useState<'ONLY_WINDOWS' | 'WITH_SKIES'>('ONLY_WINDOWS');
  const [cloudType, setCloudType] = useState<'CLEAR' | 'LOW_CLOUD' | 'LOW_CLOUD_LOW_SAT' | 'HIGH_CLOUD'>('CLEAR');
  const [notes, setNotes] = useState('');

  // HDR bracket merging — when set to 3 or 5, selected files are grouped in
  // selection order and each group is merged into a single enhanced output.
  const [bracketSize, setBracketSize] = useState<0 | 3 | 5>(0);

  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const [comparisonJob, setComparisonJob] = useState<EditingJob | null>(null);
  const [overviewShootId, setOverviewShootId] = useState<number | null>(null);

  const lastShiftAnchorRef = useRef<number | null>(null);

  const canUseAutoenhance = ['admin', 'superadmin', 'editing_manager', 'editor'].includes(user?.role || '');

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
  }, []);

  const resolveImageUrl = useCallback((value?: string | null) => {
    if (!value) return '';
    if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) return value;
    return `${API_BASE_URL}/${value.replace(/^\/+/, '')}`;
  }, []);

  const getImageUrl = useCallback(
    (file: MediaFile, size: 'thumb' | 'medium' | 'large' | 'original' = 'medium') => {
      if (size === 'thumb') return resolveImageUrl(file.thumb_url || file.medium_url || file.url || file.path);
      if (size === 'medium') return resolveImageUrl(file.medium_url || file.large_url || file.url || file.path);
      if (size === 'large') return resolveImageUrl(file.large_url || file.original_url || file.url || file.path);
      return resolveImageUrl(file.original_url || file.large_url || file.url || file.path);
    },
    [resolveImageUrl],
  );

  const parseJsonResponse = useCallback(async (response: Response) => {
    if (response.status === 204) return {};
    const text = await response.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }, []);

  const loadConnectionStatus = useCallback(async () => {
    try {
      const status = await autoenhanceService.getConnectionStatus();
      setConnection(status);
    } catch (error) {
      console.warn('Failed to fetch Autoenhance connection status', error);
      setConnection({ success: false, status: 503, message: 'Status unavailable' });
    }
  }, []);

  const loadEditingTypes = useCallback(async () => {
    try {
      const types = await autoenhanceService.getEditingTypes();
      setEditingTypes(types);
    } catch (error) {
      console.error('Failed to load Autoenhance editing types:', error);
      toast({
        title: 'Editing modes unavailable',
        description: 'Falling back to built-in Autoenhance modes.',
      });
    }
  }, [toast]);

  const loadShoots = useCallback(async () => {
    setLoadingShoots(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) return;
      const tabs = ['scheduled', 'completed', 'delivered'];
      const responses = await Promise.all(
        tabs.map((tab) =>
          fetch(`${API_BASE_URL}/api/shoots?tab=${tab}&per_page=200&no_cache=true`, {
            headers: getAuthHeaders(),
          }),
        ),
      );
      if (responses.some((response) => response.status === 401)) {
        toast({ title: 'Authentication Error', description: 'Please log in again', variant: 'destructive' });
        return;
      }
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error('Failed to load shoots');
      const payloads = await Promise.all(responses.map((response) => parseJsonResponse(response)));
      const shootsById = new Map<number, ShootWithEditing>();
      payloads.forEach((data) => {
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        items.forEach((shoot: any) => {
          const mappedShoot: ShootWithEditing = {
            id: shoot.id,
            address: shoot.address || `Shoot #${shoot.id}`,
            status: shoot.status || 'pending',
            workflowStatus: shoot.workflowStatus || shoot.workflow_status || shoot.status,
            photo_count:
              shoot.photo_count ?? shoot.photoCount ?? shoot.files_count ?? (Array.isArray(shoot.files) ? shoot.files.length : 0),
            raw_photo_count: shoot.raw_photo_count ?? shoot.rawPhotoCount,
            edited_photo_count: shoot.edited_photo_count ?? shoot.editedPhotoCount,
            client_name: shoot.client?.name || shoot.client_name || shoot.user?.name,
            created_at: shoot.created_at || shoot.createdAt || new Date().toISOString(),
            thumbnail:
              shoot.thumbnail ||
              shoot.hero_image ||
              shoot.heroImage ||
              shoot.cover_image ||
              (Array.isArray(shoot.preview_images) ? shoot.preview_images[0] : null),
            auto_edit_enabled: shoot.auto_edit_enabled || false,
          };
          shootsById.set(mappedShoot.id, mappedShoot);
        });
      });
      const ordered = Array.from(shootsById.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setShoots(ordered);
    } catch (error) {
      console.error('Failed to load shoots:', error);
      toast({ title: 'Error', description: 'Failed to load shoots. Please try again.', variant: 'destructive' });
    } finally {
      setLoadingShoots(false);
    }
  }, [getAuthHeaders, parseJsonResponse, toast]);

  const loadShootFiles = useCallback(
    async (shootId: number) => {
      setLoadingFiles(true);
      try {
        const responses = await Promise.all(
          ['raw', 'edited'].map((type) =>
            fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=${type}`, { headers: getAuthHeaders() }),
          ),
        );
        const failed = responses.find((response) => !response.ok && response.status !== 404);
        if (failed) throw new Error('Failed to load shoot files');

        const payloads = await Promise.all(
          responses.map((response) => (response.ok ? parseJsonResponse(response) : Promise.resolve({ data: [] }))),
        );
        // Accept JPEG/PNG/etc AND camera RAW formats (NEF/CR2/CR3/ARW/DNG/RAF/ORF/RW2 etc.)
        // so that RAW-only shoots are listed correctly in the picker.
        const allowedExt = /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif|nef|cr2|cr3|crw|arw|dng|raf|orf|rw2|nrw|sr2|srf|pef|x3f|3fr|fff|iiq|mrw|mef|kdc|dcr|erf|nrw|rwl)$/i;
        const filesById = new Map<number, MediaFile>();
        payloads.forEach((data, payloadIndex) => {
          const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          items
            .filter((file: any) => allowedExt.test(file.filename || file.stored_filename || ''))
            .forEach((file: any) => {
              const id = Number(file.id);
              if (!Number.isFinite(id)) return;
              // Don't let the second pass (?type=edited) overwrite a raw entry — once
              // we've recorded a file from the raw bucket, keep it.
              if (filesById.has(id) && payloadIndex === 1) return;
              const stage = String(file.workflow_stage || file.workflowStage || '').toLowerCase();
              const mediaType = String(file.media_type || file.mediaType || '').toLowerCase();
              const isAiEdited = file.is_ai_edited === true;
              // Trust the file's own metadata, not the query bucket: a file is
              // "edited" only if it self-identifies as such.
              const isEdited =
                isAiEdited
                || mediaType === 'edited'
                || mediaType === 'final'
                || stage === 'completed'
                || stage === 'edited';
              filesById.set(id, {
                id,
                filename: file.filename || file.stored_filename || `file-${file.id}`,
                url: file.url,
                path: file.path,
                thumb_url: file.thumb_url || file.thumb || file.thumbnail_url,
                medium_url: file.medium_url || file.medium || file.web_url,
                large_url: file.large_url || file.large || file.original_url,
                original_url: file.original_url || file.original,
                fileType: file.fileType || file.file_type,
                workflowStage: stage,
                created_at: file.created_at || file.createdAt,
                isEdited,
                isAiEdited,
              } as MediaFile);
            });
        });
        setAvailableFiles(Array.from(filesById.values()));
      } catch (error) {
        console.error('Failed to load shoot files:', error);
        setAvailableFiles([]);
        toast({ title: 'Error', description: 'Failed to load shoot files', variant: 'destructive' });
      } finally {
        setLoadingFiles(false);
      }
    },
    [getAuthHeaders, parseJsonResponse, toast],
  );

  const loadJobs = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoadingJobs(true);
      try {
        const response = await autoenhanceService.listJobs({ per_page: 30 });
        setJobs(response.data);
      } catch (error) {
        console.error('Failed to load Autoenhance jobs:', error);
        if (showLoader) {
          toast({ title: 'Error', description: 'Failed to load Autoenhance jobs', variant: 'destructive' });
        }
      } finally {
        if (showLoader) setLoadingJobs(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadShoots();
    loadEditingTypes();
    loadJobs();
    loadConnectionStatus();
  }, [loadConnectionStatus, loadEditingTypes, loadJobs, loadShoots]);

  useEffect(() => {
    const hasActive = jobs.some((job) => ['pending', 'processing'].includes(job.status));
    if (!hasActive) return;
    const interval = window.setInterval(() => loadJobs(false), 8000);
    return () => window.clearInterval(interval);
  }, [jobs, loadJobs]);

  useEffect(() => {
    if (selectedShoot) {
      loadShootFiles(selectedShoot.id);
    } else {
      setAvailableFiles([]);
      setSelectedFiles(new Set());
    }
  }, [loadShootFiles, selectedShoot]);

  const rawFiles = useMemo(
    () => availableFiles.filter((file) => !file.isEdited && !file.isAiEdited),
    [availableFiles],
  );
  const editedFiles = useMemo(
    () => availableFiles.filter((file) => file.isEdited || file.isAiEdited),
    [availableFiles],
  );
  const sourceFiles = useMemo(
    () => (rawFiles.length > 0 ? rawFiles : availableFiles.filter((file) => !file.isAiEdited)),
    [availableFiles, rawFiles],
  );
  const usingEditedSources = rawFiles.length === 0 && sourceFiles.length > 0;

  const filteredShoots = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return shoots;
    return shoots.filter(
      (shoot) =>
        shoot.address.toLowerCase().includes(term) ||
        String(shoot.id).includes(term) ||
        (shoot.client_name || '').toLowerCase().includes(term),
    );
  }, [searchTerm, shoots]);

  // Reset to the first page whenever the filtered result set can change.
  useEffect(() => {
    setJobsPage(1);
  }, [jobStatusFilter, jobShootFilter, jobsPageSize]);

  const filteredJobs = useMemo(() => {
    const term = jobShootFilter.trim().toLowerCase();
    return jobs.filter((job) => {
      if (jobStatusFilter !== 'all' && job.status !== jobStatusFilter) return false;
      if (term) {
        const haystack = `${job.shoot?.address || ''} ${job.shoot_id} ${job.source_file?.filename || ''} ${job.editing_type}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [jobShootFilter, jobStatusFilter, jobs]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return {
      active: jobs.filter((job) => ['pending', 'processing'].includes(job.status)).length,
      completed: jobs.filter((job) => job.status === 'completed').length,
      failed: jobs.filter((job) => job.status === 'failed').length,
      today: jobs.filter((job) => {
        const created = job.created_at ? new Date(job.created_at) : null;
        return created && created >= todayStart;
      }).length,
    };
  }, [jobs]);

  const selectedRawFiles = useMemo(
    () => sourceFiles.filter((file) => selectedFiles.has(file.id)),
    [sourceFiles, selectedFiles],
  );

  const selectedModeList = useMemo(() => Array.from(selectedEnhancementIds), [selectedEnhancementIds]);
  const selectedModeLabel = useMemo(
    () => selectedModeList.map((id) => editingTypeLabels[id] || id).join(' + '),
    [selectedModeList],
  );
  const submitEditingType = selectedModeList.length === 1 ? selectedModeList[0] : 'enhance_custom';
  const isAutoenhanceConfigured = connection?.success !== false;

  const buildSubmitParams = () => {
    const params: Record<string, any> = {
      notes: notes.trim() || undefined,
      editing_options: selectedModeList,
      enhance: selectedEnhancementIds.has('enhance'),
      lens_correction: lensCorrection,
      vertical_correction: selectedEnhancementIds.has('vertical_correction'),
    };
    if (selectedEnhancementIds.has('enhance')) {
      params.enhance_type = enhanceType;
    }
    if (selectedEnhancementIds.has('sky_replace')) {
      params.sky_replacement = true;
      params.cloud_type = cloudType;
    }
    if (selectedEnhancementIds.has('window_pull')) {
      params.window_pull_type = windowPullType;
    }
    Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);
    return params;
  };

  const startNewEdit = () => {
    if (!canUseAutoenhance) return;
    setSelectedShoot(null);
    setSelectedFiles(new Set());
    setSearchTerm('');
    lastShiftAnchorRef.current = null;
    setViewMode('select-shoot');
  };

  const startQuickEdit = (modeId: EnhancementModeId) => {
    if (!canUseAutoenhance) return;
    setSelectedEnhancementIds(new Set([modeId]));
    setQuickStartMode(modeId);
    startNewEdit();
  };

  const firstName = (user?.name || '').split(' ')[0] || 'there';

  const goToActivity = useCallback(() => {
    setViewMode('activity');
    lastShiftAnchorRef.current = null;
  }, []);

  // -----------------------------------------------------------------------
  // Conversational tools (chat with Robbie scoped to AI editing)
  // -----------------------------------------------------------------------
  const submitChatMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatSending) return;

      setViewMode('chat');
      setChatSending(true);
      setChatSuggestions([]);

      const optimisticUser: AiMessage = {
        id: `tmp-${Date.now()}`,
        sender: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, optimisticUser]);

      try {
        const response = await sendAiMessage({
          sessionId: chatSessionId,
          message: trimmed,
          context: {
            page: 'ai_editing',
            intent: chatSessionId ? undefined : 'edit_photos',
          } as any,
        });

        setChatSessionId(response.sessionId);
        if (Array.isArray(response.messages)) {
          setChatMessages(response.messages);
        }
        setChatSuggestions(response.meta?.suggestions ?? []);
      } catch (error: any) {
        const detail =
          error?.response?.data?.error || error?.message || 'Failed to reach Robbie. Try again in a moment.';
        toast({ title: 'Chat error', description: detail, variant: 'destructive' });
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            content: detail,
            createdAt: new Date().toISOString(),
            metadata: { type: 'error', tool_status: 'error' },
          },
        ]);
      } finally {
        setChatSending(false);
      }
    },
    [chatSending, chatSessionId, toast]
  );

  const openChatWithPrefill = useCallback(
    (prefill: string, options?: { send?: boolean }) => {
      if (options?.send) {
        void submitChatMessage(prefill);
        return;
      }
      setViewMode('chat');
      setJobShootFilter(prefill);
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('input[data-ai-editing-prompt]');
        input?.focus();
        if (input && typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 30);
    },
    [submitChatMessage]
  );

  const resetChat = useCallback(() => {
    // Returning to activity — drop the session so the next visit starts clean.
    setChatMessages([]);
    setChatSessionId(null);
    setChatSuggestions([]);
    setJobShootFilter('');
    setAttachedImages((current) => {
      current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
    setViewMode('activity');
  }, []);

  // -----------------------------------------------------------------------
  // Image attachments (inline file picker on the prompt card)
  // -----------------------------------------------------------------------
  const triggerImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImagesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: AttachedImage[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });
    if (accepted.length === 0) {
      toast({
        title: 'No images selected',
        description: 'Please pick image files (JPG, PNG, HEIC, WebP, TIFF, etc).',
        variant: 'destructive',
      });
      return;
    }
    setAttachedImages((current) => [...current, ...accepted]);
  }, [toast]);

  const removeAttachedImage = useCallback((id: string) => {
    setAttachedImages((current) => {
      const target = current.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((img) => img.id !== id);
    });
  }, []);

  const clearAttachedImages = useCallback(() => {
    setAttachedImages((current) => {
      current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  // Revoke any object URLs left over when the page unmounts.
  useEffect(() => {
    return () => {
      attachedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // We intentionally don't depend on attachedImages here — revoking happens in
    // removeAttachedImage / clearAttachedImages / resetChat for live updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Send the current draft + attachments. Attached images are STAGED on the server
   * (not yet submitted to Autoenhance), then a chat message with their staged_ids
   * is sent so Robbie can ask follow-up questions about mode + params and only
   * commit the jobs after confirmation.
   */
  const submitDraftWithAttachments = useCallback(async () => {
    const draft = jobShootFilter.trim();
    const images = attachedImages;

    if (!draft && images.length === 0) return;

    // Snapshot then clear input + attachments immediately for snappy UX.
    setJobShootFilter('');
    setAttachedImages([]);

    if (images.length === 0) {
      // Text-only path — nothing new here, just hand off to normal chat.
      if (draft) await submitChatMessage(draft);
      return;
    }

    // Move into chat view so the upload progress + Robbie's questions show up.
    setViewMode('chat');

    const uploadStart = new Date().toISOString();
    const summary = images.length === 1
      ? `Uploading 1 image for AI editing…`
      : `Uploading ${images.length} images for AI editing…`;
    const fileList = images.map((img) => `• ${img.file.name}`).join('\n');
    const optimisticUserMsg: AiMessage = {
      id: `tmp-upload-${Date.now()}`,
      sender: 'user',
      content: `${summary}\n${fileList}${draft ? `\n\n${draft}` : ''}`,
      createdAt: uploadStart,
    };
    setChatMessages((prev) => [...prev, optimisticUserMsg]);
    setChatSending(true);

    try {
      // Phase 1 — stage on server (fast, no Autoenhance call yet).
      const stageResp = await autoenhanceService.stageImages(images.map((img) => img.file));
      const staged = stageResp.staged ?? [];
      const skipped = stageResp.skipped ?? [];

      if (staged.length === 0) {
        const reason = skipped[0]?.reason ?? 'unknown error';
        setChatMessages((prev) => [
          ...prev,
          {
            id: `stage-err-${Date.now()}`,
            sender: 'assistant',
            content: `I couldn't stage those uploads: ${reason}`,
            createdAt: new Date().toISOString(),
            metadata: { type: 'stage_error', tool_status: 'error' },
          },
        ]);
        toast({ title: 'Upload failed', description: reason, variant: 'destructive' });
        return;
      }

      const stagedIds = staged.map((s) => s.id);

      // Phase 2 — hand off to Robbie's chat. The flow's `start` step sees
      // `staged_ids` in the context and asks the user which pipeline + params.
      // Manually post to the chat API so we can include `staged_ids` in context.
      const message = draft
        ? draft
        : `I uploaded ${staged.length} image${staged.length === 1 ? '' : 's'} — please edit them.`;

      const response = await sendAiMessage({
        sessionId: chatSessionId,
        message,
        context: {
          page: 'ai_editing',
          intent: chatSessionId ? undefined : 'edit_photos',
          staged_ids: stagedIds,
        } as any,
      });

      setChatSessionId(response.sessionId);
      if (Array.isArray(response.messages)) {
        setChatMessages(response.messages);
      }
      setChatSuggestions(response.meta?.suggestions ?? []);

      if (skipped.length > 0) {
        toast({
          title: `${skipped.length} file${skipped.length === 1 ? '' : 's'} skipped`,
          description: skipped[0]?.reason ?? 'See chat for details.',
        });
      }

      // Activity refresh isn't useful here yet (no jobs created until Robbie
      // commits) — call it after the user confirms in chat.
    } catch (error: any) {
      const detail =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to upload images.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: `stage-err-${Date.now()}`,
          sender: 'assistant',
          content: `I couldn't upload those images: ${detail}`,
          createdAt: new Date().toISOString(),
          metadata: { type: 'stage_error', tool_status: 'error' },
        },
      ]);
      toast({ title: 'Upload failed', description: detail, variant: 'destructive' });
    } finally {
      setChatSending(false);
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    }
  }, [attachedImages, chatSessionId, jobShootFilter, submitChatMessage, toast]);

  // Auto-scroll chat to bottom whenever messages arrive
  useEffect(() => {
    if (viewMode !== 'chat') return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, viewMode]);

  // Refresh Activity whenever Robbie tells us new jobs were created so the user
  // sees them immediately when they click Back from chat.
  const lastJobsRefreshKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const last = chatMessages[chatMessages.length - 1];
    if (last.sender !== 'assistant') return;
    const meta: any = last.metadata || {};
    const hasJobsAction = Array.isArray(meta.actions)
      && meta.actions.some((a: any) => a?.type === 'view_editing_jobs');
    const isSuccess = meta.tool_status === 'success';
    if (!hasJobsAction && !isSuccess) return;
    const key = `${last.id}-${last.createdAt}`;
    if (lastJobsRefreshKeyRef.current === key) return;
    lastJobsRefreshKeyRef.current = key;
    void loadJobs(false);
  }, [chatMessages, loadJobs]);

  // Drive Autoenhance jobs to completion on local dev (no webhooks reach localhost).
  // While any job is in `processing`, ask the backend to poll the provider every
  // ~8 seconds. When updates land, refresh the Activity list so cards flip state.
  const hasProcessingJobs = useMemo(
    () => jobs.some((j) => j.status === 'processing'),
    [jobs]
  );
  useEffect(() => {
    if (!hasProcessingJobs) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await autoenhanceService.pollProcessingJobs();
        if (!cancelled && (result.updated?.length ?? 0) > 0) {
          await loadJobs(false);
        }
      } catch (error) {
        // Polling errors are non-fatal — quiet warning only.
        // eslint-disable-next-line no-console
        console.warn('Autoenhance poll failed', error);
      }
    };
    // Kick once immediately, then every 8 seconds.
    void tick();
    const handle = window.setInterval(tick, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [hasProcessingJobs, loadJobs]);

  const selectShoot = (shoot: ShootWithEditing) => {
    setSelectedShoot(shoot);
    setSelectedFiles(new Set());
    lastShiftAnchorRef.current = null;
    setViewMode('select-files');
  };

  const toggleFile = (fileId: number, event?: React.MouseEvent) => {
    setSelectedFiles((current) => {
      const next = new Set(current);

      if (event?.shiftKey && lastShiftAnchorRef.current !== null) {
        const ids = sourceFiles.map((file) => file.id);
        const a = ids.indexOf(lastShiftAnchorRef.current);
        const b = ids.indexOf(fileId);
        if (a !== -1 && b !== -1) {
          const [start, end] = a < b ? [a, b] : [b, a];
          for (let index = start; index <= end; index++) next.add(ids[index]);
          return next;
        }
      }

      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      lastShiftAnchorRef.current = fileId;
      return next;
    });
  };

  const selectAllRawFiles = useCallback(() => {
    if (sourceFiles.length === 0) return;
    if (sourceFiles.length > MAX_BATCH_SIZE) {
      toast({
        title: 'Large batch',
        description: `Selecting ${MAX_BATCH_SIZE} of ${sourceFiles.length} photos. Submit in multiple batches if needed.`,
      });
    }
    setSelectedFiles(new Set(sourceFiles.slice(0, MAX_BATCH_SIZE).map((file) => file.id)));
  }, [sourceFiles, toast]);

  const clearSelection = () => {
    setSelectedFiles(new Set());
    lastShiftAnchorRef.current = null;
  };

  const submitAutoenhance = async () => {
    if (!selectedShoot || selectedFiles.size === 0) return;

    // HDR bracket validation: file count must be a multiple of bracket size.
    if (bracketSize !== 0 && selectedFiles.size % bracketSize !== 0) {
      toast({
        title: 'Bracket count mismatch',
        description: `Selected ${selectedFiles.size} photo(s) — for ${bracketSize}-shot brackets, pick a multiple of ${bracketSize}.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const fileIds = Array.from(selectedFiles);
      if (bracketSize !== 0) {
        const result = await autoenhanceService.submitBracketEditing({
          shoot_id: selectedShoot.id,
          file_ids: fileIds,
          bracket_size: bracketSize,
          editing_type: submitEditingType,
          params: buildSubmitParams(),
        });
        const bracketCount = Array.isArray(result) ? result.length : Math.floor(fileIds.length / bracketSize);
        toast({
          title: 'HDR brackets submitted',
          description: `${bracketCount} bracket job(s) queued (${bracketSize} photos each). Track progress in Activity.`,
        });
      } else {
        await autoenhanceService.submitEditing({
          shoot_id: selectedShoot.id,
          file_ids: fileIds,
          editing_type: submitEditingType,
          params: buildSubmitParams(),
        });
        toast({
          title: 'Submitted to Autoenhance',
          description: `${selectedFiles.size} image(s) queued. Track progress in Activity.`,
        });
      }
      setSelectedFiles(new Set());
      lastShiftAnchorRef.current = null;
      setNotes('');
      setViewMode('activity');
      setJobStatusFilter('all');
      await loadJobs(false);
    } catch (error: any) {
      const description =
        error?.response?.data?.message || error?.message || 'Failed to submit Autoenhance job';
      toast({ title: 'Submission failed', description, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryJob = useCallback(
    async (job: EditingJob) => {
      setMutatingJobId(job.id);
      try {
        await autoenhanceService.retryJob(job.id);
        toast({ title: 'Job re-queued', description: `Job #${job.id} has been queued for retry.` });
        await loadJobs(false);
      } catch (error: any) {
        const description =
          error?.response?.data?.message || error?.message || 'Failed to retry job';
        toast({ title: 'Retry failed', description, variant: 'destructive' });
      } finally {
        setMutatingJobId(null);
      }
    },
    [loadJobs, toast],
  );

  const handleCancelJob = useCallback(
    async (job: EditingJob) => {
      setMutatingJobId(job.id);
      try {
        await autoenhanceService.cancelJob(job.id);
        toast({ title: 'Job cancelled', description: `Job #${job.id} cancelled.` });
        await loadJobs(false);
      } catch (error: any) {
        const description =
          error?.response?.data?.message || error?.message || 'Failed to cancel job';
        toast({ title: 'Cancel failed', description, variant: 'destructive' });
      } finally {
        setMutatingJobId(null);
      }
    },
    [loadJobs, toast],
  );

  const handleOpenComparison = useCallback((job: EditingJob) => {
    setComparisonJob(job);
  }, []);

  const handleOpenShoot = useCallback(
    (job: EditingJob) => {
      if (job.shoot_id) setOverviewShootId(job.shoot_id);
    },
    [],
  );

  const toggleEnhancementMode = (modeId: string) => {
    if (!COMBINABLE_MODE_IDS.has(modeId)) {
      toast({
        title: 'HDR workflow is separate',
        description: 'HDR bracket merging requires Autoenhance order/bracket processing and is not part of combined single-image enhancement yet.',
      });
      return;
    }

    setSelectedEnhancementIds((current) => {
      const next = new Set(current);
      const typedModeId = modeId as EnhancementModeId;
      if (next.has(typedModeId)) {
        if (next.size === 1) return next;
        next.delete(typedModeId);
      } else {
        next.add(typedModeId);
      }
      return next;
    });
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if (event.key === 'Escape') {
        if (previewFile) {
          setPreviewFile(null);
          return;
        }
        if (comparisonJob) return;
        if (viewMode === 'configure') setViewMode('select-files');
        else if (viewMode === 'select-files') setViewMode('select-shoot');
        else if (viewMode === 'select-shoot') goToActivity();
      }

      if (viewMode === 'select-files' && (event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        selectAllRawFiles();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [comparisonJob, goToActivity, previewFile, selectAllRawFiles, viewMode]);

  const renderConnectionAlert = () => {
    if (isAutoenhanceConfigured) return null;
    return (
      <Card className="border-amber-300/60 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Autoenhance is not configured</p>
              <p className="text-xs">{connection?.message || 'Add an API key in Settings → Integrations to enable AI editing.'}</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="self-start sm:self-auto">
            <a href="/settings?tab=integrations">
              <Settings2 className="mr-2 h-3.5 w-3.5" />
              Open settings
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderStatTile = (
    label: string,
    value: number,
    accent: string,
    onClick: () => void,
    Icon: React.ElementType,
    description?: string,
    isActive = false,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-3 sm:p-4 text-left transition-all hover:shadow-md',
        isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40',
      )}
    >
      <span aria-hidden className={cn('absolute inset-0 -z-0 bg-gradient-to-br opacity-80', accent)} />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold leading-none">{value}</p>
          {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border bg-background/80 backdrop-blur')}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-foreground/80" />
        </div>
      </div>
    </button>
  );

  const renderHeroStats = () => (
    <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-[1.7fr_repeat(4,minmax(0,1fr))]">
      {/* Prominent "Edit a shoot" action card — matches Navbar "Book Shoot" gradient */}
      <button
        type="button"
        onClick={startNewEdit}
        disabled={!canUseAutoenhance || !isAutoenhanceConfigured}
        className={cn(
          'group relative col-span-2 overflow-hidden rounded-xl border border-primary/20 p-3 text-left text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/20 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 sm:p-4 lg:col-span-1',
          'bg-[linear-gradient(135deg,hsl(var(--primary)/0.95)_0%,hsl(var(--primary)/0.78)_52%,hsl(var(--accent)/0.9)_100%)]',
          (!canUseAutoenhance || !isAutoenhanceConfigured) && 'opacity-50 cursor-not-allowed hover:translate-y-0',
        )}
        aria-label="Edit a shoot — start the 3-step wizard"
      >
        {/* Radial highlight (matches Book Shoot button) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_25%_10%,hsl(var(--primary-foreground)/0.24),hsl(var(--primary-foreground)/0)_58%)]"
        />
        <div className="relative z-10 flex h-full items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary-foreground/25 bg-primary-foreground/15 shadow-sm backdrop-blur sm:h-12 sm:w-12">
            <ListChecks className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight sm:text-base">Edit a shoot</p>
            <p className="mt-0.5 truncate text-[11px] text-primary-foreground/85 sm:text-xs">
              Pick a property → choose photos → enhance
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>

      {renderStatTile(
        'Active',
        stats.active,
        'from-blue-500/15 via-blue-500/5 to-transparent',
        () => {
          setJobStatusFilter('processing');
          setViewMode('activity');
        },
        Loader2,
        'Pending + processing',
        jobStatusFilter === 'processing',
      )}
      {renderStatTile(
        'Completed',
        stats.completed,
        'from-emerald-500/15 via-emerald-500/5 to-transparent',
        () => {
          setJobStatusFilter('completed');
          setViewMode('activity');
        },
        CheckCircle2,
        'Recent successes',
        jobStatusFilter === 'completed',
      )}
      {renderStatTile(
        'Failed',
        stats.failed,
        'from-red-500/15 via-red-500/5 to-transparent',
        () => {
          setJobStatusFilter('failed');
          setViewMode('activity');
        },
        XCircle,
        'Need attention',
        jobStatusFilter === 'failed',
      )}
      {renderStatTile(
        'Today',
        stats.today,
        'from-violet-500/15 via-violet-500/5 to-transparent',
        () => {
          setJobStatusFilter('all');
          setViewMode('activity');
        },
        Sparkles,
        'Submitted today',
        false,
      )}
    </div>
  );

  const renderHero = () => {
    const quickStartChips: { id: EnhancementModeId; label: string; Icon: React.ElementType }[] = [
      { id: 'enhance', label: 'Enhance photos', Icon: Wand2 },
      { id: 'sky_replace', label: 'Sky replacement', Icon: Cloud },
      { id: 'vertical_correction', label: 'Vertical correction', Icon: RectangleVertical },
      { id: 'window_pull', label: 'Window pull', Icon: Sun },
    ];

    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 px-4 py-8 sm:px-8 sm:py-12"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.3, ease: 'easeOut' }}
            className="space-y-1"
          >
            <p className="text-sm text-muted-foreground">Hi {firstName}</p>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold leading-tight sm:text-4xl">
              <span>Enhance property photos with AI</span>
              <Button
                size="icon"
                onClick={startNewEdit}
                disabled={!canUseAutoenhance || !isAutoenhanceConfigured}
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="Start a new edit"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.3, ease: 'easeOut' }}
            className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur sm:p-4"
          >
            <Input
              data-ai-editing-prompt
              value={jobShootFilter}
              onChange={(event) => setJobShootFilter(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  (jobShootFilter.trim() || attachedImages.length > 0)
                ) {
                  event.preventDefault();
                  void submitDraftWithAttachments();
                }
              }}
              placeholder={
                attachedImages.length > 0
                  ? `Add a note or hit send to process ${attachedImages.length} image${attachedImages.length === 1 ? '' : 's'}…`
                  : 'Ask Robbie to edit photos, check status, or pick a quick action...'
              }
              className="h-10 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
                  onClick={triggerImagePicker}
                  disabled={!canUseAutoenhance || chatSending}
                  aria-label="Attach images"
                  title="Attach images"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    handleImagesSelected(event.target.files);
                    // Reset the input value so the same file can be re-selected if needed.
                    event.target.value = '';
                  }}
                />
                {attachedImages.length > 0 && (
                  <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {attachedImages.map((img) => (
                      <div
                        key={img.id}
                        className="group relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted shadow-sm"
                        title={img.file.name}
                      >
                        <img
                          src={img.previewUrl}
                          alt={img.file.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${img.file.name}`}
                          onClick={() => removeAttachedImage(img.id)}
                          className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {attachedImages.length > 1 && (
                      <button
                        type="button"
                        onClick={clearAttachedImages}
                        className="ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Select value={quickStartMode} onValueChange={(value) => setQuickStartMode(value as EnhancementModeId)}>
                  <SelectTrigger className="h-8 gap-1 rounded-full border-0 bg-transparent px-3 text-xs hover:bg-muted focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enhance">Enhance</SelectItem>
                    <SelectItem value="sky_replace">Sky replace</SelectItem>
                    <SelectItem value="vertical_correction">Vertical</SelectItem>
                    <SelectItem value="window_pull">Window pull</SelectItem>
                  </SelectContent>
                </Select>
                <motion.button
                  type="button"
                  onClick={() => {
                    setQuickSendRippleKey((key) => key + 1);
                    if (jobShootFilter.trim() || attachedImages.length > 0) {
                      void submitDraftWithAttachments();
                    } else {
                      startQuickEdit(quickStartMode);
                    }
                  }}
                  disabled={!canUseAutoenhance || submitting || chatSending}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  aria-label="Start quick edit"
                  style={{ aspectRatio: '1 / 1' }}
                  className="group relative inline-flex aspect-square h-10 w-10 shrink-0 grow-0 basis-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-blue-500 via-blue-500 to-indigo-500 p-0 text-white shadow-[0_6px_20px_-6px_rgba(59,130,246,0.55)] ring-1 ring-white/20 transition-[box-shadow,filter] duration-200 hover:shadow-[0_10px_28px_-8px_rgba(59,130,246,0.7)] hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(120%_80%_at_30%_20%,rgba(255,255,255,0.45),rgba(255,255,255,0)_55%)]"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-[1px] rounded-full ring-1 ring-inset ring-white/15"
                  />
                  <AnimatePresence>
                    <motion.span
                      key={quickSendRippleKey}
                      aria-hidden
                      initial={{ scale: 0, opacity: 0.45 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      className="pointer-events-none absolute inset-0 rounded-full bg-white/40"
                    />
                  </AnimatePresence>
                  {submitting || chatSending ? (
                    <Loader2 className="relative h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="relative h-4 w-4 -translate-y-[1px] transition-transform duration-200 motion-safe:group-hover:-rotate-12 motion-safe:group-hover:translate-x-[1px]" />
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          <div className="-mx-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:p-0">
            <div className="mx-auto grid w-max grid-flow-col grid-rows-3 place-items-center gap-x-1 gap-y-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
              {quickStartChips.map(({ id, label, Icon }, index) => (
                <motion.button
                  key={id}
                  type="button"
                  onClick={() => startQuickEdit(id)}
                  disabled={!canUseAutoenhance}
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.24 + index * 0.06, duration: 0.28, ease: 'easeOut' }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-border/60 bg-card/60 px-2 py-1 text-center text-[11px] font-medium leading-none text-foreground transition-colors hover:border-primary/40 hover:bg-card disabled:cursor-not-allowed disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
                >
                  <Icon className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
                  {label}
                </motion.button>
              ))}
              {stats.failed > 0 && (
                <motion.button
                  type="button"
                  onClick={() => setJobStatusFilter('failed')}
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.24 + quickStartChips.length * 0.06, duration: 0.28, ease: 'easeOut' }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-red-300/60 bg-red-500/10 px-2 py-1 text-center text-[11px] font-medium leading-none text-red-700 transition-colors hover:bg-red-500/15 dark:border-red-900/50 dark:text-red-200 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
                >
                  <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {stats.failed} failed
                </motion.button>
              )}
              <motion.button
                type="button"
                onClick={() => loadJobs()}
                disabled={loadingJobs}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.24 + (quickStartChips.length + 1) * 0.06, duration: 0.28, ease: 'easeOut' }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-border/60 bg-card/60 px-2 py-1 text-center text-[11px] font-medium leading-none text-muted-foreground transition-colors hover:bg-card disabled:cursor-not-allowed sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
              >
                <RefreshCw className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', loadingJobs && 'animate-spin')} />
                Refresh
              </motion.button>
            </div>
          </div>
        </div>
      </motion.section>
    );
  };

  const renderChat = () => {
    const showThinking = chatSending && (chatMessages.length === 0 || chatMessages[chatMessages.length - 1]?.sender === 'user');

    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative flex h-[calc(100vh-9rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-background to-violet-500/5"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-background/60 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={resetChat} className="h-8 gap-1.5 px-2 text-xs">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="hidden h-6 w-px bg-border/60 sm:block" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">AI Editing tools</h2>
              <p className="truncate text-[11px] text-muted-foreground">
                Ask Robbie to edit photos, check status, or run a quick action.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setChatMessages([]);
              setChatSessionId(null);
              setChatSuggestions([]);
            }}
            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            disabled={chatMessages.length === 0 || chatSending}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            New chat
          </Button>
        </div>

        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {chatMessages.length === 0 && !chatSending && (
              <div className="rounded-2xl border border-border/40 bg-card/60 p-4 text-sm text-muted-foreground sm:p-6">
                <p className="font-medium text-foreground">Hi {firstName}! Tell me what you'd like to do.</p>
                <p className="mt-1 text-xs">Try: <span className="italic">"Edit photos for 24 Ocean Avenue"</span> or pick one of the suggestions below.</p>
              </div>
            )}
            {chatMessages.map((message) => (
              <AiMessageBubble key={message.id} message={message} />
            ))}
            {showThinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Robbie is thinking…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/40 bg-background/80 px-3 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto max-w-3xl space-y-2">
            {chatSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chatSuggestions.slice(0, 5).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={chatSending}
                    onClick={() => void submitChatMessage(suggestion)}
                    className="inline-flex items-center rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-2 shadow-sm">
              {attachedImages.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {attachedImages.map((img) => (
                    <div
                      key={img.id}
                      className="group relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted shadow-sm"
                      title={img.file.name}
                    >
                      <img src={img.previewUrl} alt={img.file.name} className="h-full w-full object-cover" loading="lazy" />
                      <button
                        type="button"
                        aria-label={`Remove ${img.file.name}`}
                        onClick={() => removeAttachedImage(img.id)}
                        className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {attachedImages.length > 1 && (
                    <button
                      type="button"
                      onClick={clearAttachedImages}
                      className="ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={triggerImagePicker}
                  disabled={chatSending}
                  className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Attach images"
                  title="Attach images"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Input
                  data-ai-editing-prompt
                  value={jobShootFilter}
                  onChange={(event) => setJobShootFilter(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      (jobShootFilter.trim() || attachedImages.length > 0)
                    ) {
                      event.preventDefault();
                      void submitDraftWithAttachments();
                    }
                  }}
                  placeholder={
                    attachedImages.length > 0
                      ? `Add a note or hit send to process ${attachedImages.length} image${attachedImages.length === 1 ? '' : 's'}…`
                      : 'Type a message…'
                  }
                  disabled={chatSending}
                  className="h-10 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  size="icon"
                  onClick={() => {
                    if (!jobShootFilter.trim() && attachedImages.length === 0) return;
                    void submitDraftWithAttachments();
                  }}
                  disabled={chatSending || (!jobShootFilter.trim() && attachedImages.length === 0)}
                  className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  aria-label="Send message"
                >
                  {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    );
  };

  const renderActivity = () => (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b border-border/60 bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base sm:text-lg">Recent activity</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Track Autoenhance jobs, retry failures, or open completed results.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={jobShootFilter}
              onChange={(event) => setJobShootFilter(event.target.value)}
              placeholder="Filter by address, file..."
              className="h-9 pl-8 text-xs sm:text-sm"
            />
          </div>
          <Select value={jobStatusFilter} onValueChange={(value) => setJobStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="h-9 w-[120px] sm:w-[140px] text-xs sm:text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => loadJobs()} disabled={loadingJobs} className="h-9">
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loadingJobs && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {loadingJobs ? (
          <HorizontalLoader message="Loading Autoenhance jobs..." />
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">
                {jobs.length === 0 ? 'No Autoenhance jobs yet' : 'No jobs match these filters'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {jobs.length === 0
                  ? 'Submit raw photos to start your first batch.'
                  : 'Try clearing the filters or pick a different status.'}
              </p>
            </div>
            {jobs.length === 0 ? (
              <Button onClick={startNewEdit} disabled={!canUseAutoenhance}>
                <Sparkles className="mr-2 h-4 w-4" />
                Start your first edit
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setJobStatusFilter('all');
                  setJobShootFilter('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (() => {
          const total = filteredJobs.length;
          const totalPages = Math.max(1, Math.ceil(total / jobsPageSize));
          const safePage = Math.min(jobsPage, totalPages);
          const startIdx = (safePage - 1) * jobsPageSize;
          const endIdx = Math.min(startIdx + jobsPageSize, total);
          const pageJobs = filteredJobs.slice(startIdx, endIdx);

          return (
            <div className="space-y-3">
              <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
                {pageJobs.map((job) => (
                  <AiEditingJobCard
                    key={job.id}
                    job={job}
                    editingTypeLabels={editingTypeLabels}
                    resolveImageUrl={resolveImageUrl}
                    onCompare={handleOpenComparison}
                    onCancel={handleCancelJob}
                    onRetry={handleRetryJob}
                    onOpenSource={handleOpenShoot}
                    isMutating={mutatingJobId === job.id}
                  />
                ))}
              </div>

              {/* Pagination footer — counts + page size + prev/next */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs sm:text-sm">
                <div className="text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{startIdx + 1}</span>–
                  <span className="font-medium text-foreground">{endIdx}</span> of{' '}
                  <span className="font-medium text-foreground">{total}</span>
                  {total !== jobs.length && (
                    <span className="ml-1 text-muted-foreground/80">(filtered from {jobs.length})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground">Per page</label>
                  <Select value={String(jobsPageSize)} onValueChange={(v) => setJobsPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[72px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-1 text-muted-foreground">
                      Page <span className="font-medium text-foreground">{safePage}</span> / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setJobsPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );

  const renderShootCard = (shoot: ShootWithEditing) => {
    const imageUrl = resolveImageUrl(shoot.thumbnail);
    const isSelected = selectedShoot?.id === shoot.id;
    const photos = shoot.photo_count ?? shoot.raw_photo_count ?? 0;
    return (
      <button
        key={shoot.id}
        type="button"
        onClick={() => selectShoot(shoot)}
        className={cn(
          'group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:shadow-md',
          isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40',
        )}
      >
        <div className="relative aspect-[16/10] w-full bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={shoot.address}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div className="absolute right-2 top-2 flex flex-wrap items-center gap-1 justify-end max-w-[70%]">
            <Badge variant="secondary" className="text-[10px] capitalize">
              {(shoot.workflowStatus || shoot.status || '').replace(/_/g, ' ')}
            </Badge>
            {photos > 0 && (
              <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur">
                <ImageIcon className="mr-1 h-3 w-3" />
                {photos}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-1 p-3 sm:p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{shoot.address}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {shoot.client_name ? `${shoot.client_name} · ` : ''}
            {shoot.created_at ? format(new Date(shoot.created_at), 'MMM d, yyyy') : '—'}
          </p>
        </div>
      </button>
    );
  };

  const renderSelectShoot = () => (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b border-border/60 bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base sm:text-lg">Choose a shoot</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Pick the property containing the source photos you want to enhance.
          </CardDescription>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search address, client, or shoot ID..."
            className="pl-10"
            autoFocus
          />
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {loadingShoots ? (
          <HorizontalLoader message="Loading shoots..." />
        ) : filteredShoots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">No matching shoots</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? 'Try a different address, client name, or shoot ID.'
                  : 'There are no shoots available yet. Create a shoot first.'}
              </p>
            </div>
            <Button variant="outline" onClick={loadShoots}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredShoots.map(renderShootCard)}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderFileTile = (file: MediaFile) => {
    const imageUrl = getImageUrl(file, 'medium');
    const isSelected = selectedFiles.has(file.id);
    return (
      <div
        key={file.id}
        className={cn(
          'group relative overflow-hidden rounded-lg border bg-card transition-all',
          isSelected
            ? 'border-primary ring-2 ring-primary/40 shadow-sm shadow-primary/10'
            : 'border-border hover:border-primary/40 hover:shadow-sm',
        )}
      >
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={(event) => toggleFile(file.id, event)}
          className="block w-full text-left"
        >
          <div className="relative aspect-[4/3] w-full bg-muted">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={file.filename}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <span
              className={cn(
                'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-white/80 bg-black/40 text-white opacity-0 group-hover:opacity-100',
              )}
            >
              {isSelected ? '✓' : ''}
            </span>
          </div>
          <div className="px-2 pb-2 pt-1.5">
            <p className="truncate text-xs font-medium">{file.filename}</p>
            <p className="text-[10px] text-muted-foreground">#{file.id}</p>
          </div>
        </button>
        <button
          type="button"
          aria-label={`Preview ${file.filename}`}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewFile(file);
          }}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderSelectFiles = () => (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b border-border/60 bg-muted/30 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base sm:text-lg">Select source photos</CardTitle>
          <CardDescription className="text-xs sm:text-sm line-clamp-2">
            {selectedShoot?.address || 'Pick raw photos to send to Autoenhance.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[11px]">
            {selectedFiles.size} selected
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={selectAllRawFiles}
            disabled={sourceFiles.length === 0}
          >
            Select all{sourceFiles.length > MAX_BATCH_SIZE ? ` (first ${MAX_BATCH_SIZE})` : ''}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={clearSelection}
            disabled={selectedFiles.size === 0}
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {loadingFiles ? (
          <HorizontalLoader message="Loading shoot files..." />
        ) : sourceFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">No raw photos available</h3>
              <p className="text-sm text-muted-foreground">
                Upload source photos to this shoot before submitting to Autoenhance.
              </p>
            </div>
            <Button variant="outline" onClick={() => selectedShoot && loadShootFiles(selectedShoot.id)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {usingEditedSources && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                No raw-stage photos were found, so showing available non-Autoenhance source images for this shoot.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {sourceFiles.map(renderFileTile)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
              <span>
                Showing {sourceFiles.length} source photo{sourceFiles.length === 1 ? '' : 's'}.
                {!usingEditedSources && editedFiles.length > 0 && ` ${editedFiles.length} already-edited image(s) hidden.`}
              </span>
              <span className="hidden sm:inline">
                Tip: <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Shift</kbd>+click to select a range,{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl</kbd>+
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">A</kbd> to select all.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderModeOptions = () => {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {selectedEnhancementIds.has('enhance') && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Enhance style</Label>
            <Select value={enhanceType} onValueChange={(value) => setEnhanceType(value as typeof enhanceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Autoenhance API version 5 supports neutral style; unsupported styles are not sent.
            </p>
          </div>
        )}

        <div className="space-y-3 rounded-lg border p-3 sm:p-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="lens-correction" className="text-sm">Lens correction</Label>
            <Switch id="lens-correction" checked={lensCorrection} onCheckedChange={setLensCorrection} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Vertical correction</Label>
              <p className="text-[11px] text-muted-foreground">
                Toggle the Vertical Correction card to include or remove it.
              </p>
            </div>
            <Badge variant={selectedEnhancementIds.has('vertical_correction') ? 'default' : 'secondary'}>
              {selectedEnhancementIds.has('vertical_correction') ? 'Included' : 'Off'}
            </Badge>
          </div>
        </div>

        {selectedEnhancementIds.has('sky_replace') && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cloud type</Label>
            <Select value={cloudType} onValueChange={(value) => setCloudType(value as typeof cloudType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLEAR">Clear</SelectItem>
                <SelectItem value="LOW_CLOUD">Low cloud</SelectItem>
                <SelectItem value="LOW_CLOUD_LOW_SAT">Low cloud neutral</SelectItem>
                <SelectItem value="HIGH_CLOUD">High cloud</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedEnhancementIds.has('window_pull') && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Window pull type</Label>
            <Select value={windowPullType} onValueChange={(value) => setWindowPullType(value as typeof windowPullType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONLY_WINDOWS">Only windows</SelectItem>
                <SelectItem value="WITH_SKIES">Windows with skies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  const renderConfigure = () => (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Enhancement options</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Select one or more Autoenhance options to combine in the same job.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiEditingModePicker
              modes={editingTypes}
              selectedModeIds={selectedEnhancementIds}
              onToggle={toggleEnhancementMode}
              disabledModeIds={UNSUPPORTED_MODE_IDS}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mode options</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Tune options for the selected enhancement combination.
            </CardDescription>
          </CardHeader>
          <CardContent>{renderModeOptions()}</CardContent>
        </Card>

        {/* HDR bracket merging — group selected photos into 3- or 5-shot brackets,
            each merged into a single enhanced output. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">HDR brackets</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Merge multiple exposures of the same scene into one enhanced image. Select photos in
              bracket order — every {bracketSize || 'N'} consecutive selected photos becomes one bracket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {([0, 3, 5] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setBracketSize(size)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition',
                    bracketSize === size
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <div className="text-sm font-semibold">
                    {size === 0 ? 'Off' : `${size}-shot`}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {size === 0 ? 'Single-image enhance' : `Merge groups of ${size}`}
                  </div>
                </button>
              ))}
            </div>
            {bracketSize !== 0 && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                {selectedFiles.size === 0 ? (
                  <span className="text-muted-foreground">
                    Pick at least {bracketSize} photos to form your first bracket.
                  </span>
                ) : selectedFiles.size % bracketSize === 0 ? (
                  <span className="text-foreground">
                    <strong>{Math.floor(selectedFiles.size / bracketSize)}</strong> bracket
                    {Math.floor(selectedFiles.size / bracketSize) === 1 ? '' : 's'} ×{' '}
                    <strong>{bracketSize}</strong> photos ={' '}
                    <strong>{selectedFiles.size}</strong> source photos →{' '}
                    <strong>{Math.floor(selectedFiles.size / bracketSize)}</strong> enhanced output
                    {Math.floor(selectedFiles.size / bracketSize) === 1 ? '' : 's'}.
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300">
                    Selected {selectedFiles.size} photos — needs to be a multiple of {bracketSize}
                    {' '}({Math.floor(selectedFiles.size / bracketSize) * bracketSize} or{' '}
                    {(Math.floor(selectedFiles.size / bracketSize) + 1) * bracketSize}).
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Optional internal context attached to this batch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Twilight retake, prioritize sky replacement..."
              className="min-h-[88px]"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Review</CardTitle>
            <CardDescription className="text-xs">{selectedShoot?.address}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shoot</span>
                <span className="font-medium">#{selectedShoot?.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Selected images</span>
                <span className="font-medium">{selectedFiles.size}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Options</span>
                <span className="text-right font-medium">{selectedModeLabel}</span>
              </div>
              {bracketSize !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">HDR brackets</span>
                  <span className="font-medium">
                    {Math.floor(selectedFiles.size / bracketSize)} × {bracketSize}-shot
                    {selectedFiles.size > 0 && selectedFiles.size % bracketSize !== 0 && ' (mismatch)'}
                  </span>
                </div>
              )}
            </div>

            {selectedRawFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {selectedRawFiles.slice(0, 8).map((file) => {
                  const url = getImageUrl(file, 'thumb');
                  return (
                    <div key={file.id} className="aspect-square overflow-hidden rounded-md border bg-muted">
                      {url ? (
                        <img
                          src={url}
                          alt={file.filename}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            (event.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {selectedRawFiles.length > 8 && (
                  <div className="flex aspect-square items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground">
                    +{selectedRawFiles.length - 8}
                  </div>
                )}
              </div>
            )}

            {(() => {
              const bracketActive = bracketSize !== 0;
              const bracketCountMismatch =
                bracketActive && selectedFiles.size > 0 && selectedFiles.size % bracketSize !== 0;
              const bracketCount = bracketActive ? Math.floor(selectedFiles.size / bracketSize) : 0;
              const submitDisabled =
                submitting
                || selectedFiles.size === 0
                || !isAutoenhanceConfigured
                || bracketCountMismatch
                || (bracketActive && bracketCount === 0);

              const buttonLabel = submitting
                ? 'Submitting...'
                : bracketActive
                  ? `Submit ${bracketCount} HDR bracket${bracketCount === 1 ? '' : 's'}`
                  : `Submit ${selectedFiles.size} image${selectedFiles.size === 1 ? '' : 's'}`;

              return (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={submitAutoenhance}
                  disabled={submitDisabled}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {buttonLabel}
                </Button>
              );
            })()}

            {!isAutoenhanceConfigured && (
              <p className="rounded-md border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                Autoenhance is not configured. Add your API key in Settings → Integrations.
              </p>
            )}

            <div className="flex items-start gap-2 rounded-md border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5" />
              <span>
                Each image is queued individually. Track progress, retry failures, or compare results in Activity.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStepper = () => (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <AiEditingStepper
          steps={STEPPER_STEPS}
          currentStepId={viewMode === 'activity' ? STEPPER_STEPS[0].id : viewMode}
          onStepClick={(stepId) => {
            if (stepId === 'select-shoot') setViewMode('select-shoot');
            else if (stepId === 'select-files' && selectedShoot) setViewMode('select-files');
            else if (stepId === 'configure' && selectedShoot && selectedFiles.size > 0) setViewMode('configure');
          }}
          isStepReachable={(stepId) => {
            if (stepId === 'select-shoot') return true;
            if (stepId === 'select-files') return Boolean(selectedShoot);
            if (stepId === 'configure') return Boolean(selectedShoot) && selectedFiles.size > 0;
            return false;
          }}
        />
      </CardContent>
    </Card>
  );

  const stepActionLabel = (() => {
    if (viewMode === 'select-shoot') return selectedShoot ? 'Continue' : 'Pick a shoot';
    if (viewMode === 'select-files') return selectedFiles.size === 0 ? 'Select photos' : `Continue · ${selectedFiles.size}`;
    if (submitting) return 'Submitting...';
    if (bracketSize !== 0) {
      const count = Math.floor(selectedFiles.size / bracketSize);
      return `Submit · ${count} bracket${count === 1 ? '' : 's'}`;
    }
    return `Submit · ${selectedFiles.size}`;
  })();

  const stepCanAdvance = (() => {
    if (viewMode === 'select-shoot') return Boolean(selectedShoot);
    if (viewMode === 'select-files') return selectedFiles.size > 0;
    const bracketMismatch =
      bracketSize !== 0 && (selectedFiles.size === 0 || selectedFiles.size % bracketSize !== 0);
    return selectedFiles.size > 0 && isAutoenhanceConfigured && !submitting && !bracketMismatch;
  })();

  const handleStepNext = () => {
    if (viewMode === 'select-shoot' && selectedShoot) setViewMode('select-files');
    else if (viewMode === 'select-files' && selectedFiles.size > 0) setViewMode('configure');
    else if (viewMode === 'configure') submitAutoenhance();
  };

  const handleStepBack = () => {
    if (viewMode === 'select-shoot') goToActivity();
    else if (viewMode === 'select-files') setViewMode('select-shoot');
    else if (viewMode === 'configure') setViewMode('select-files');
  };

  const renderEditFlow = () => (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={goToActivity} className="px-2">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to activity
        </Button>
        {selectedShoot && (
          <Badge variant="outline" className="max-w-[60vw] truncate">
            {selectedShoot.address}
          </Badge>
        )}
      </div>
      {renderStepper()}
      {viewMode === 'select-shoot' && renderSelectShoot()}
      {viewMode === 'select-files' && renderSelectFiles()}
      {viewMode === 'configure' && renderConfigure()}
    </div>
  );

  const renderEditFlowFooter = () => {
    if (viewMode === 'activity' || viewMode === 'chat') return null;
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-3 py-2 backdrop-blur sm:px-6"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={handleStepBack}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
          <div className="hidden text-xs text-muted-foreground sm:block">
            {viewMode === 'select-shoot'
              ? 'Step 1 of 3'
              : viewMode === 'select-files'
              ? 'Step 2 of 3'
              : 'Step 3 of 3'}
          </div>
          <Button size="sm" onClick={handleStepNext} disabled={!stepCanAdvance}>
            {viewMode === 'configure' ? (
              <Sparkles className="mr-1.5 h-4 w-4" />
            ) : (
              <ArrowRight className="mr-1.5 h-4 w-4" />
            )}
            {stepActionLabel}
          </Button>
        </div>
      </div>
    );
  };

  const previewUrl = previewFile ? getImageUrl(previewFile, 'large') : '';
  const enhancedUrlForComparison = comparisonJob?.output_file?.url
    ? resolveImageUrl(comparisonJob.output_file.url)
    : comparisonJob?.output_file?.thumb_url
    ? resolveImageUrl(comparisonJob.output_file.thumb_url)
    : comparisonJob?.edited_image_url
    ? resolveImageUrl(comparisonJob.edited_image_url)
    : null;
  const sourceUrlForComparison = comparisonJob
    ? comparisonJob.source_file?.thumb_url
      ? resolveImageUrl(comparisonJob.source_file.thumb_url)
      : resolveImageUrl(comparisonJob.original_image_url)
    : null;
  const comparisonTitle = comparisonJob
    ? `${editingTypeLabels[comparisonJob.editing_type] || comparisonJob.editing_type} · Job #${comparisonJob.id}`
    : '';
  const comparisonSubtitle = comparisonJob?.shoot?.address || '';

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-32 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0">
        {viewMode !== 'activity' && viewMode !== 'chat' && (
          <PageHeader
            title="AI Editing"
            description="Enhance property photos with Autoenhance — submit, track, and review results in one place."
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => loadJobs()} disabled={loadingJobs}>
                  <RefreshCw className={cn('mr-1.5 h-4 w-4', loadingJobs && 'animate-spin')} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button size="sm" onClick={startNewEdit} disabled={!canUseAutoenhance}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">New edit</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </div>
            }
          />
        )}

        {!canUseAutoenhance ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">Access restricted</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your role does not have access to AI editing. Contact your admin if you need access.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {renderConnectionAlert()}

            {viewMode === 'chat' ? (
              renderChat()
            ) : viewMode === 'activity' ? (
              <>
                {renderHero()}
                {renderHeroStats()}
                {stats.failed > 0 && (
                  <Card className="border-red-300/60 bg-red-50/70 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
                    <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p className="text-sm">
                          {stats.failed} job{stats.failed === 1 ? '' : 's'} failed recently. Review and retry to recover.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="self-start sm:self-auto"
                        onClick={() => setJobStatusFilter('failed')}
                      >
                        Show failed jobs
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {renderActivity()}
              </>
            ) : (
              renderEditFlow()
            )}
          </>
        )}

        {renderEditFlowFooter()}
      </div>

      <Dialog open={Boolean(previewFile)} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b bg-background/95 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{previewFile?.filename}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {previewFile?.created_at ? format(new Date(previewFile.created_at), 'MMM d, yyyy h:mm a') : '—'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewFile(null)} aria-label="Close preview">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-black">
              {previewUrl ? (
                <img src={previewUrl} alt={previewFile?.filename} className="max-h-[80vh] w-full object-contain" />
              ) : (
                <div className="flex h-[40vh] w-full items-center justify-center text-sm text-muted-foreground">
                  Preview unavailable.
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-4 py-2 text-xs text-muted-foreground">
              <span>File #{previewFile?.id}</span>
              {previewFile && (
                <Button
                  size="sm"
                  variant={selectedFiles.has(previewFile.id) ? 'default' : 'outline'}
                  onClick={() => toggleFile(previewFile.id)}
                >
                  {selectedFiles.has(previewFile.id) ? 'Selected' : 'Select photo'}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AiEditingComparisonLightbox
        open={Boolean(comparisonJob)}
        onOpenChange={(open) => !open && setComparisonJob(null)}
        originalUrl={sourceUrlForComparison}
        enhancedUrl={enhancedUrlForComparison}
        title={comparisonTitle}
        subtitle={comparisonSubtitle}
      />

      {overviewShootId && (
        <ShootDetailsModal
          shootId={overviewShootId}
          isOpen={Boolean(overviewShootId)}
          onClose={() => setOverviewShootId(null)}
          initialTab="overview"
        />
      )}
    </DashboardLayout>
  );
};

export default AiEditing;

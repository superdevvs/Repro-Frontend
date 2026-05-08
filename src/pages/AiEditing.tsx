import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
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
import { useToast } from '@/hooks/use-toast';
import { autoenhanceService, type EditingJob, type EditingType } from '@/services/autoenhanceService';
import { API_BASE_URL } from '@/config/env';
import { useAuth } from '@/components/auth/AuthProvider';

interface ShootWithEditing {
  id: number;
  address: string;
  status: string;
  workflowStatus?: string;
  photo_count?: number;
  created_by?: string;
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
}

type ViewMode = 'overview' | 'select-shoot' | 'select-files' | 'review';
type JobStatus = EditingJob['status'];

const statusConfig: Record<JobStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Loader2 },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-800 border-slate-200', icon: XCircle },
};

const editingTypeLabels: Record<string, string> = {
  enhance: 'Enhance',
  sky_replace: 'Sky Replacement',
  hdr_merge: 'HDR Bracket Merge',
  vertical_correction: 'Vertical Correction',
  window_pull: 'Window Pull',
};

const AiEditing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [shoots, setShoots] = useState<ShootWithEditing[]>([]);
  const [selectedShoot, setSelectedShoot] = useState<ShootWithEditing | null>(null);
  const [availableFiles, setAvailableFiles] = useState<MediaFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [editingTypes, setEditingTypes] = useState<EditingType[]>([]);
  const [selectedEditingType, setSelectedEditingType] = useState('enhance');
  const [jobs, setJobs] = useState<EditingJob[]>([]);
  const [loadingShoots, setLoadingShoots] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | JobStatus>('all');
  const [enhanceType, setEnhanceType] = useState('neutral');
  const [verticalCorrection, setVerticalCorrection] = useState(true);
  const [lensCorrection, setLensCorrection] = useState(true);
  const [windowPullType, setWindowPullType] = useState('NONE');
  const [cloudType, setCloudType] = useState('CLEAR');
  const [bracketCount, setBracketCount] = useState(5);
  const [notes, setNotes] = useState('');

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

  const getImageUrl = useCallback((file: MediaFile, size: 'thumb' | 'medium' | 'large' | 'original' = 'medium') => {
    if (size === 'thumb') return resolveImageUrl(file.thumb_url || file.medium_url || file.url || file.path);
    if (size === 'medium') return resolveImageUrl(file.medium_url || file.large_url || file.url || file.path);
    if (size === 'large') return resolveImageUrl(file.large_url || file.original_url || file.url || file.path);
    return resolveImageUrl(file.original_url || file.large_url || file.url || file.path);
  }, [resolveImageUrl]);

  const loadEditingTypes = useCallback(async () => {
    try {
      const types = await autoenhanceService.getEditingTypes();
      setEditingTypes(types);
      if (types.length > 0 && !types.some((type) => type.id === selectedEditingType)) {
        setSelectedEditingType(types[0].id);
      }
    } catch (error) {
      console.error('Failed to load Autoenhance editing types:', error);
      toast({
        title: 'Autoenhance options unavailable',
        description: 'Using built-in Autoenhance options for now.',
      });
    }
  }, [selectedEditingType, toast]);

  const loadShoots = useCallback(async () => {
    setLoadingShoots(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) return;
      const tabs = ['scheduled', 'completed', 'delivered'];
      const responses = await Promise.all(
        tabs.map((tab) => fetch(`${API_BASE_URL}/api/shoots?tab=${tab}&per_page=200&no_cache=true`, { headers: getAuthHeaders() }))
      );
      if (responses.some((response) => response.status === 401)) {
        toast({ title: 'Authentication Error', description: 'Please log in again', variant: 'destructive' });
        return;
      }
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error('Failed to load shoots');
      const payloads = await Promise.all(responses.map((response) => response.json()));
      const shootsById = new Map<number, ShootWithEditing>();
      payloads.forEach((data) => {
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        items.forEach((shoot: any) => {
          const mappedShoot: ShootWithEditing = {
            id: shoot.id,
            address: shoot.address || `Shoot #${shoot.id}`,
            status: shoot.status || 'pending',
            workflowStatus: shoot.workflowStatus || shoot.workflow_status || shoot.status,
            photo_count: shoot.photo_count || shoot.photoCount || shoot.files_count || shoot.files?.length || 0,
            created_by: shoot.created_by || shoot.user?.name || shoot.client?.name || 'Unknown',
            created_at: shoot.created_at || shoot.createdAt || new Date().toISOString(),
            thumbnail: shoot.thumbnail || shoot.hero_image || shoot.cover_image || (Array.isArray(shoot.preview_images) ? shoot.preview_images[0] : null),
            auto_edit_enabled: shoot.auto_edit_enabled || false,
          };
          shootsById.set(mappedShoot.id, mappedShoot);
        });
      });
      setShoots(Array.from(shootsById.values()));
    } catch (error) {
      console.error('Failed to load shoots:', error);
      toast({ title: 'Error', description: 'Failed to load shoots. Please try again.', variant: 'destructive' });
    } finally {
      setLoadingShoots(false);
    }
  }, [getAuthHeaders, toast]);

  const loadShootFiles = useCallback(async (shootId: number) => {
    setLoadingFiles(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files`, { headers: getAuthHeaders() });
      if (!response.ok) {
        if (response.status === 404) {
          setAvailableFiles([]);
          return;
        }
        throw new Error('Failed to load shoot files');
      }
      const data = await response.json();
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const files = items
        .filter((file: any) => /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/i.test(file.filename || ''))
        .map((file: any) => ({
          id: file.id,
          filename: file.filename || `file-${file.id}`,
          url: file.url,
          path: file.path,
          thumb_url: file.thumb_url || file.thumb || file.thumbnail_url,
          medium_url: file.medium_url || file.medium || file.web_url,
          large_url: file.large_url || file.large || file.original_url,
          original_url: file.original_url || file.original,
          fileType: file.fileType || file.file_type,
          workflowStage: file.workflow_stage || file.workflowStage,
          created_at: file.created_at || file.createdAt,
          isEdited: ['completed', 'edited'].includes(String(file.workflow_stage || file.workflowStage || '').toLowerCase()) || file.media_type === 'edited',
        }));
      setAvailableFiles(files);
    } catch (error) {
      console.error('Failed to load shoot files:', error);
      setAvailableFiles([]);
      toast({ title: 'Error', description: 'Failed to load shoot files', variant: 'destructive' });
    } finally {
      setLoadingFiles(false);
    }
  }, [getAuthHeaders, toast]);

  const loadJobs = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingJobs(true);
    try {
      const response = await autoenhanceService.listJobs({ per_page: 20 });
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to load Autoenhance jobs:', error);
      toast({ title: 'Error', description: 'Failed to load Autoenhance jobs', variant: 'destructive' });
    } finally {
      if (showLoader) setLoadingJobs(false);
    }
  }, [toast]);

  useEffect(() => {
    loadShoots();
    loadEditingTypes();
    loadJobs();
  }, [loadEditingTypes, loadJobs, loadShoots]);

  useEffect(() => {
    const hasActiveJobs = jobs.some((job) => ['pending', 'processing'].includes(job.status));
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => loadJobs(false), 10000);
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

  const rawFiles = useMemo(() => availableFiles.filter((file) => !file.isEdited), [availableFiles]);
  const editedFiles = useMemo(() => availableFiles.filter((file) => file.isEdited), [availableFiles]);
  const filteredShoots = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return shoots;
    return shoots.filter((shoot) => shoot.address.toLowerCase().includes(term) || String(shoot.id).includes(term));
  }, [searchTerm, shoots]);
  const filteredJobs = useMemo(() => {
    if (jobStatusFilter === 'all') return jobs;
    return jobs.filter((job) => job.status === jobStatusFilter);
  }, [jobStatusFilter, jobs]);
  const activeJobs = jobs.filter((job) => ['pending', 'processing'].includes(job.status)).length;
  const completedJobs = jobs.filter((job) => job.status === 'completed').length;
  const failedJobs = jobs.filter((job) => job.status === 'failed').length;

  const selectedRawFiles = useMemo(() => rawFiles.filter((file) => selectedFiles.has(file.id)), [rawFiles, selectedFiles]);
  const selectedEditingTypeMeta = editingTypes.find((type) => type.id === selectedEditingType);

  const buildSubmitParams = () => {
    const params: Record<string, any> = { notes: notes.trim() || undefined };
    if (selectedEditingType === 'enhance') {
      params.enhance_type = enhanceType;
      params.vertical_correction = verticalCorrection;
      params.lens_correction = lensCorrection;
      params.window_pull_type = windowPullType;
    }
    if (selectedEditingType === 'sky_replace') {
      params.cloud_type = cloudType;
    }
    if (selectedEditingType === 'hdr_merge') {
      params.hdr = true;
      params.bracket_count = bracketCount;
    }
    if (selectedEditingType === 'vertical_correction') {
      params.vertical_correction = true;
    }
    if (selectedEditingType === 'window_pull') {
      params.window_pull_type = windowPullType === 'NONE' ? 'ONLY_WINDOWS' : windowPullType;
    }
    Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);
    return params;
  };

  const getStatusBadge = (status: JobStatus) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.className}>
        <Icon className={`mr-1 h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  };

  const startNewEdit = () => {
    setSelectedShoot(null);
    setSelectedFiles(new Set());
    setSearchTerm('');
    setViewMode('select-shoot');
  };

  const selectShoot = (shoot: ShootWithEditing) => {
    setSelectedShoot(shoot);
    setSelectedFiles(new Set());
    setViewMode('select-files');
  };

  const toggleFile = (fileId: number) => {
    setSelectedFiles((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const selectAllRawFiles = () => {
    setSelectedFiles(new Set(rawFiles.map((file) => file.id)));
  };

  const submitAutoenhance = async () => {
    if (!selectedShoot || selectedFiles.size === 0) return;
    setSubmitting(true);
    try {
      await autoenhanceService.submitEditing({
        shoot_id: selectedShoot.id,
        file_ids: Array.from(selectedFiles),
        editing_type: selectedEditingType,
        params: buildSubmitParams(),
      });
      toast({ title: 'Submitted to Autoenhance', description: `${selectedFiles.size} image(s) submitted for processing.` });
      setSelectedFiles(new Set());
      setViewMode('overview');
      await loadJobs(false);
    } catch (error: any) {
      toast({
        title: 'Submission failed',
        description: error?.response?.data?.message || error?.message || 'Failed to submit Autoenhance job',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Start an Autoenhance edit
            </CardTitle>
            <CardDescription>Select a shoot, choose source photos, configure Autoenhance options, and submit jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={startNewEdit} disabled={!canUseAutoenhance} className="bg-primary hover:bg-primary/90 text-white">
              <Upload className="mr-2 h-4 w-4" />
              New Autoenhance Edit
            </Button>
            {!canUseAutoenhance && <p className="mt-3 text-sm text-muted-foreground">Your role does not have access to Autoenhance submissions.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Jobs</CardDescription>
            <CardTitle>{activeJobs}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle>{completedJobs}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Recent Autoenhance jobs</CardTitle>
            <CardDescription>Track submitted image enhancements and review failures.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={jobStatusFilter} onValueChange={(value) => setJobStatusFilter(value as 'all' | JobStatus)}>
              <SelectTrigger className="w-40">
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
            <Button variant="outline" onClick={() => loadJobs()} disabled={loadingJobs}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingJobs ? (
            <HorizontalLoader message="Loading Autoenhance jobs..." />
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">No Autoenhance jobs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Start a new edit to submit images to Autoenhance.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <div key={job.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Job #{job.id}</span>
                      {getStatusBadge(job.status)}
                      <Badge variant="secondary">{editingTypeLabels[job.editing_type] || job.editing_type}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Shoot #{job.shoot_id}{job.shoot_file_id ? ` · File #${job.shoot_file_id}` : ''} · {job.created_at ? format(new Date(job.created_at), 'MMM d, yyyy h:mm a') : '—'}
                    </div>
                    {job.error_message && <div className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{job.error_message}</div>}
                  </div>
                  <div className="flex gap-2">
                    {job.edited_image_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={resolveImageUrl(job.edited_image_url)} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open result
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderSelectShoot = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setViewMode('overview')} className="mb-2 px-0">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to overview
          </Button>
          <h2 className="text-2xl font-semibold">Choose a shoot</h2>
          <p className="text-sm text-muted-foreground">Select the shoot containing photos you want to process with Autoenhance.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search shoots..." className="pl-10" />
        </div>
      </div>
      {loadingShoots ? (
        <HorizontalLoader message="Loading shoots..." />
      ) : filteredShoots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No shoots found</h3>
            <p className="text-muted-foreground">Try adjusting your search or refresh shoots.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredShoots.map((shoot) => {
            const imageUrl = resolveImageUrl(shoot.thumbnail);
            return (
              <Card key={shoot.id} className="cursor-pointer transition-colors hover:border-primary" onClick={() => selectShoot(shoot)}>
                <CardContent className="p-0">
                  {imageUrl ? <img src={imageUrl} alt={shoot.address} className="h-44 w-full rounded-t-lg object-cover" /> : <div className="flex h-44 items-center justify-center rounded-t-lg bg-muted"><ImageIcon className="h-10 w-10 text-muted-foreground" /></div>}
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold leading-tight">{shoot.address}</h3>
                      <Badge variant="outline">{shoot.workflowStatus || shoot.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{shoot.photo_count || 0} photos · {shoot.created_at ? format(new Date(shoot.created_at), 'MMM d, yyyy') : '—'}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderFileCard = (file: MediaFile) => {
    const imageUrl = getImageUrl(file, 'medium');
    const isSelected = selectedFiles.has(file.id);
    return (
      <button key={file.id} type="button" onClick={() => toggleFile(file.id)} className={`group overflow-hidden rounded-lg border text-left transition ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/60'}`}>
        <div className="relative aspect-[4/3] bg-muted">
          {imageUrl ? <img src={imageUrl} alt={file.filename} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>}
          <div className="absolute left-2 top-2">
            <Badge className={isSelected ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-foreground'}>{isSelected ? 'Selected' : 'Select'}</Badge>
          </div>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium">{file.filename}</p>
          <p className="text-xs text-muted-foreground">File #{file.id}</p>
        </div>
      </button>
    );
  };

  const renderSelectFiles = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setViewMode('select-shoot')} className="mb-2 px-0">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Change shoot
          </Button>
          <h2 className="text-2xl font-semibold">Select source photos</h2>
          <p className="text-sm text-muted-foreground">{selectedShoot?.address}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={selectAllRawFiles} disabled={rawFiles.length === 0}>Select all raw</Button>
          <Button variant="outline" onClick={() => setSelectedFiles(new Set())}>Clear</Button>
          <Button onClick={() => setViewMode('review')} disabled={selectedFiles.size === 0} className="bg-primary hover:bg-primary/90 text-white">
            Continue ({selectedFiles.size})
          </Button>
        </div>
      </div>
      {loadingFiles ? (
        <HorizontalLoader message="Loading shoot files..." />
      ) : rawFiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No raw photos available</h3>
            <p className="text-muted-foreground">Upload source photos to this shoot before submitting to Autoenhance.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{rawFiles.map(renderFileCard)}</div>
          {editedFiles.length > 0 && <p className="text-sm text-muted-foreground">{editedFiles.length} edited/completed image(s) hidden from source selection.</p>}
        </div>
      )}
    </div>
  );

  const renderAutoenhanceOptions = () => (
    <Card>
      <CardHeader>
        <CardTitle>Autoenhance options</CardTitle>
        <CardDescription>{selectedEditingTypeMeta?.description || 'Choose how Autoenhance should process the selected images.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Processing mode</Label>
          <Select value={selectedEditingType} onValueChange={setSelectedEditingType}>
            <SelectTrigger><SelectValue placeholder="Select Autoenhance mode" /></SelectTrigger>
            <SelectContent>
              {(editingTypes.length ? editingTypes : Object.entries(editingTypeLabels).map(([id, name]) => ({ id, name, description: '' }))).map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedEditingType === 'enhance' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Enhance style</Label>
              <Select value={enhanceType} onValueChange={setEnhanceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4"><Label>Vertical correction</Label><Switch checked={verticalCorrection} onCheckedChange={setVerticalCorrection} /></div>
              <div className="flex items-center justify-between gap-4"><Label>Lens correction</Label><Switch checked={lensCorrection} onCheckedChange={setLensCorrection} /></div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Window pull</Label>
              <Select value={windowPullType} onValueChange={setWindowPullType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="ONLY_WINDOWS">Only windows</SelectItem>
                  <SelectItem value="WINDOWS_WITH_SKIES">Windows with skies</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {selectedEditingType === 'sky_replace' && (
          <div className="space-y-2">
            <Label>Cloud type</Label>
            <Select value={cloudType} onValueChange={setCloudType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLEAR">Clear</SelectItem>
                <SelectItem value="LOW_CLOUD">Low cloud</SelectItem>
                <SelectItem value="HIGH_CLOUD">High cloud</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedEditingType === 'hdr_merge' && (
          <div className="space-y-2">
            <Label>Bracket count</Label>
            <Input type="number" min={2} max={9} value={bracketCount} onChange={(event) => setBracketCount(Number(event.target.value) || 5)} />
          </div>
        )}

        {selectedEditingType === 'window_pull' && (
          <div className="space-y-2">
            <Label>Window pull type</Label>
            <Select value={windowPullType === 'NONE' ? 'ONLY_WINDOWS' : windowPullType} onValueChange={setWindowPullType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ONLY_WINDOWS">Only windows</SelectItem>
                <SelectItem value="WINDOWS_WITH_SKIES">Windows with skies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional internal instructions for this Autoenhance batch..." />
        </div>
      </CardContent>
    </Card>
  );

  const renderReview = () => (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setViewMode('select-files')} className="px-0">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to photos
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Review selection</CardTitle>
            <CardDescription>{selectedShoot?.address}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{selectedRawFiles.map(renderFileCard)}</div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-5">
        {renderAutoenhanceOptions()}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Shoot</span><span className="font-medium">#{selectedShoot?.id}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Selected images</span><span className="font-medium">{selectedFiles.size}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Mode</span><span className="font-medium">{editingTypeLabels[selectedEditingType] || selectedEditingType}</span></div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-white" onClick={submitAutoenhance} disabled={submitting || selectedFiles.size === 0}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Submit to Autoenhance
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 px-2 pt-3 pb-3 sm:p-6">
        <PageHeader
          title="Autoenhance Editing"
          description="Submit property photos to Autoenhance, track processing, and review completed outputs."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => loadJobs()} disabled={loadingJobs}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
                Refresh jobs
              </Button>
              <Button onClick={startNewEdit} className="bg-primary hover:bg-primary/90 text-white">
                <Sparkles className="mr-2 h-4 w-4" />
                New Edit
              </Button>
            </div>
          }
        />

        {failedJobs > 0 && (
          <Card className="border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5" />
              <span>{failedJobs} recent Autoenhance job(s) failed. Review the job list for details.</span>
            </CardContent>
          </Card>
        )}

        {viewMode === 'overview' && renderOverview()}
        {viewMode === 'select-shoot' && renderSelectShoot()}
        {viewMode === 'select-files' && renderSelectFiles()}
        {viewMode === 'review' && renderReview()}
      </div>
    </DashboardLayout>
  );
};

export default AiEditing;

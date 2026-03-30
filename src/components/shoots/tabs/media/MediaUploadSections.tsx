import React, { useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Check, Loader2, Upload, X } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useUpload } from '@/context/UploadContext';
import {
  triggerDashboardOverviewRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
  triggerShootListRefresh,
} from '@/realtime/realtimeRefreshBus';
import { UploadDropzone, UploadProgressCard } from './MediaUploadPanels';

type ShootMediaServiceObject = {
  name?: string;
  service_name?: string;
  title?: string;
  count?: number | string;
  quantity?: number | string;
  photo_count?: number | string;
};

type ShootWithMediaServiceObjects = ShootData & {
  serviceObjects?: ShootMediaServiceObject[];
  service_objects?: ShootMediaServiceObject[];
  editor_notes?: string;
  editorNotes?: string;
};

const FULL_UPLOAD_ACCEPT = 'image/*,video/*,application/pdf,.pdf,.raw,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.x3f,.erf,.kdc,.mef,.mos,.mrw,.bay,.bmq,.cap,.cine,.dc2,.dcr,.drf,.eip,.gpr,.mdc,.mdf,.mrw,.obm,.ptx,.pxn,.r3d,.rdc,.rmf';

const triggerUploadRefreshes = (shootId: string | number) => {
  triggerShootDetailRefresh(shootId);
  triggerShootHistoryRefresh();
  triggerShootListRefresh();
  triggerDashboardOverviewRefresh();
};

function isVideoUpload(file: File): boolean {
  return Boolean(file.type && file.type.toLowerCase().startsWith('video/')) || /\.(mp4|mov|m4v|avi|mkv|wmv|webm|mpg|mpeg|3gp)$/i.test(file.name);
}

function isEditedFloorplanByName(name: string): boolean {
  const lower = name.toLowerCase();
  return ['floorplan', 'floor-plan', 'floor_plan', 'fp_', 'fp-', 'layout', 'blueprint'].some((p) => lower.includes(p));
}

function isHdrShoot(services: string[]): boolean {
  return Array.isArray(services) && services.some((service) => /\bhdr\b/i.test(service));
}

function extractPhotoServicesFromServiceObjects(shoot: ShootData): Array<{ name: string; count: number }> {
  const photoServices: Array<{ name: string; count: number }> = [];
  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  const serviceObjects = legacyShoot.serviceObjects || legacyShoot.service_objects || [];
  if (!Array.isArray(serviceObjects)) return photoServices;
  serviceObjects.forEach((service) => {
    const name = String(service?.name || service?.service_name || service?.title || '').trim();
    const count = Number(service?.count || service?.quantity || service?.photo_count || 0);
    if (name && count > 0 && !/video/i.test(name)) photoServices.push({ name, count });
  });
  return photoServices;
}

function extractPhotoServicesFromServices(services: string[]): Array<{ name: string; count: number }> {
  return (services || [])
    .map((service) => String(service || '').trim())
    .filter(Boolean)
    .filter((service) => !/video/i.test(service))
    .map((service) => ({ name: service, count: 1 }));
}

function reindexSelectionSet(set: Set<string>, removedIndex: number) {
  const next = new Set<string>();
  set.forEach((value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric === removedIndex) return;
    next.add(String(numeric > removedIndex ? numeric - 1 : numeric));
  });
  return next;
}

function CircularProgress({ progress, size = 16 }: { progress: number; size?: number }) {
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
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted-foreground/20" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-primary transition-all duration-300" />
    </svg>
  );
}

interface EditedUploadSectionProps {
  shoot: ShootData;
  onUploadComplete: () => void;
  isEditor?: boolean;
}

export function EditedUploadSection({ shoot, onUploadComplete, isEditor = false }: EditedUploadSectionProps) {
  const { toast } = useToast();
  const { trackUpload, uploads } = useUpload();
  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileProgress, setFileProgress] = useState<Record<number, number>>({});
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({
    interior_exposure: false,
    interior_white_balance: false,
    window_pulling: false,
    straight_lines: false,
    exterior_exposure: false,
    exterior_clarity: false,
    sky_replacement: false,
    natural_shadows: false,
  });

  const shootHasVideoService = useMemo(() => (shoot.services || []).some((service) => /video/i.test(String(service))), [shoot]);
  const allChecked = Object.values(checklistItems).every(Boolean);
  const uploadAccept = FULL_UPLOAD_ACCEPT;
  const activeUploads = uploads.filter((u) => u.shootId === String(shoot.id) && u.uploadType === 'edited' && u.status === 'uploading');
  const existingEditedCount = shoot.editedPhotoCount || 0;
  const expectedFinalCount = shoot.expectedFinalCount || shoot.package?.expectedDeliveredCount || 0;
  const editedMissingCount = Math.max(0, expectedFinalCount - existingEditedCount - uploadedFiles.length);
  const photographerNotes = String(legacyShoot.editor_notes || legacyShoot.editorNotes || (typeof shoot.notes === 'object' && shoot.notes?.editingNotes) || '').trim();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setUploadedFiles((prev) => [...prev, ...files]);
    event.target.value = '';
  };

  const handleConfirmSubmit = async () => {
    setUploading(true);
    setUploadProgress(0);
    const initialProgress: Record<number, number> = {};
    uploadedFiles.forEach((_, index) => { initialProgress[index] = 0; });
    setFileProgress(initialProgress);

    try {
      const apiHeaders = getApiHeaders();
      const authorizationHeader = apiHeaders.Authorization;
      const impersonationHeader = apiHeaders['X-Impersonate-User-Id'];
      const CONCURRENT_UPLOADS = 3;
      const filesToUpload = [...uploadedFiles];
      const notesSnapshot = editingNotes.trim();
      const checklistSnapshot = { ...checklistItems };
      const totalFiles = filesToUpload.length;
      const errors: string[] = [];

      trackUpload({
        shootId: shoot.id,
        shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
        fileCount: totalFiles,
        fileNames: filesToUpload.map((file) => file.name),
        uploadType: 'edited',
        uploadFn: async (onProgress) => {
          let completedFiles = 0;

          const uploadSingleEditedFile = (file: File, fileIndex: number, isFirstFile: boolean): Promise<{ success: boolean; error?: string }> => {
            return new Promise((resolve) => {
              const formData = new FormData();
              const isVideo = isVideoUpload(file);
              formData.append('files[]', file);
              formData.append('upload_type', 'edited');
              if (isVideo) formData.append('service_category', 'video');
              if (!isVideo && isEditedFloorplanByName(file.name)) formData.append('media_type', 'floorplan');
              if (isFirstFile) {
                if (notesSnapshot) formData.append('editing_notes', notesSnapshot);
                formData.append('checklist', JSON.stringify(checklistSnapshot));
              }

              const xhr = new XMLHttpRequest();
              xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                  const filePercent = Math.round((event.loaded / event.total) * 100);
                  setFileProgress((prev) => ({ ...prev, [fileIndex]: filePercent }));
                }
              });
              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  setFileProgress((prev) => ({ ...prev, [fileIndex]: 100 }));
                  resolve({ success: true });
                } else {
                  let errorMsg = 'Upload failed';
                  try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMsg = errorData.message || errorMsg;
                  } catch {
                    // Ignore malformed error payloads and keep the fallback message.
                  }
                  resolve({ success: false, error: `${file.name}: ${errorMsg}` });
                }
              });
              xhr.addEventListener('error', () => resolve({ success: false, error: `${file.name}: Network error` }));
              xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
              if (authorizationHeader) xhr.setRequestHeader('Authorization', authorizationHeader);
              if (impersonationHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonationHeader);
              xhr.send(formData);
            });
          };

          for (let i = 0; i < totalFiles; i += CONCURRENT_UPLOADS) {
            const batch = filesToUpload.slice(i, Math.min(i + CONCURRENT_UPLOADS, totalFiles));
            const results = await Promise.all(batch.map((file, batchIndex) => uploadSingleEditedFile(file, i + batchIndex, i + batchIndex === 0)));
            results.forEach((result) => {
              completedFiles += 1;
              if (!result.success && result.error) errors.push(result.error);
            });
            const progress = Math.round((completedFiles / totalFiles) * 100);
            setUploadProgress(progress);
            onProgress(progress);
          }

          const completeProgress: Record<number, number> = {};
          filesToUpload.forEach((_, index) => { completeProgress[index] = 100; });
          setFileProgress(completeProgress);
          setUploadProgress(100);
        },
        onComplete: () => {
          if (errors.length > 0) {
            toast({
              title: 'Partial Success',
              description: `${totalFiles - errors.length}/${totalFiles} files uploaded. ${errors.length} failed.`,
              variant: 'destructive',
            });
          } else {
            toast({ title: 'Success', description: `All ${totalFiles} edited files uploaded successfully` });
          }
          setUploading(false);
          setUploadedFiles([]);
          setEditingNotes('');
          triggerUploadRefreshes(shoot.id);
          onUploadComplete();
        },
        onError: (errorMessage) => {
          setUploading(false);
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
          });
        },
      });
    } catch (error) {
      setUploading(false);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload edited files',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitEdits = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'No files', description: 'Please select files to upload', variant: 'destructive' });
      return;
    }
    if (isEditor) {
      setShowChecklistDialog(true);
    } else {
      await handleConfirmSubmit();
    }
  };

  const handleChecklistComplete = () => {
    if (!allChecked) {
      toast({ title: 'Checklist incomplete', description: 'Please complete all checklist items before submitting', variant: 'destructive' });
      return;
    }
    setShowChecklistDialog(false);
    void handleConfirmSubmit();
  };

  return (
    <div className="space-y-3 flex flex-col">
      {photographerNotes && (
        <Alert className="bg-blue-500/10 border-blue-500/30">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="font-medium text-blue-700 mb-1">Photographer Notes:</div>
            <p className="text-blue-600 text-sm whitespace-pre-wrap">{photographerNotes}</p>
          </AlertDescription>
        </Alert>
      )}

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

      {activeUploads.map((activeUpload) => (
        <UploadProgressCard
          key={activeUpload.id}
          fileCount={activeUpload.fileCount}
          fileNames={activeUpload.fileNames}
          progress={activeUpload.progress}
          note="Your upload is running in the background. You can close this dialog and come back anytime."
        />
      ))}

      <UploadDropzone
        empty={uploadedFiles.length === 0}
        accept={uploadAccept}
        inputId="edited-file-upload"
        title="No uploaded files yet"
        description={`${shootHasVideoService ? 'Upload photos and videos to get started.' : 'Upload photos to get started.'} You can drag and drop files or use the upload button.`}
        buttonLabel="Upload Files"
        browseLabel="Drag and drop more edited files here or click to browse"
        onBrowse={() => document.getElementById('edited-file-upload')?.click()}
        onDrop={(e) => {
          e.preventDefault();
          setUploadedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files || [])]);
        }}
        onDragOver={(e) => e.preventDefault()}
        onFileSelect={handleFileSelect}
      />

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {uploading ? `Uploading Files (${uploadProgress}%)` : `Selected Files (${uploadedFiles.length})`}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {uploading && <CircularProgress progress={fileProgress[index] || 0} size={18} />}
                  <span className="text-xs truncate flex-1">{file.name}</span>
                  {uploading && <span className="text-[10px] text-muted-foreground flex-shrink-0 w-8 text-right">{fileProgress[index] || 0}%</span>}
                </div>
                {!uploading && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== index))}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && !uploading && (
        <div className="space-y-2">
          <Label>Notes (Optional)</Label>
          <Textarea value={editingNotes} onChange={(e) => setEditingNotes(e.target.value)} placeholder="Add any notes about the editing..." className="min-h-[80px]" />
        </div>
      )}

      <div className="space-y-2 pb-4">
        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading {uploadedFiles.length} file(s)...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}
        <Button onClick={handleSubmitEdits} disabled={uploading || uploadedFiles.length === 0} className="w-full relative overflow-hidden">
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

      <Dialog open={showChecklistDialog} onOpenChange={setShowChecklistDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Pre-Upload Checklist & Guidelines</DialogTitle>
            <DialogDescription>Review and confirm all checklist items before submitting edited files.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">Checklist Items</span>
                <Badge variant="default" className="text-xs">
                  {Object.values(checklistItems).filter(Boolean).length} / {Object.keys(checklistItems).length} completed
                </Badge>
              </div>
              {(['interior_exposure', 'interior_white_balance', 'window_pulling', 'straight_lines', 'exterior_exposure', 'exterior_clarity', 'sky_replacement', 'natural_shadows'] as const).map((key) => (
                <div key={key} className="flex items-start space-x-3 p-2.5 hover:bg-muted/50 rounded border border-transparent hover:border-border transition-colors">
                  <Checkbox checked={checklistItems[key]} onCheckedChange={(checked) => setChecklistItems((prev) => ({ ...prev, [key]: checked as boolean }))} id={`checklist-${key}`} className="mt-0.5" />
                  <label htmlFor={`checklist-${key}`} className="text-sm cursor-pointer flex-1 leading-relaxed">
                    {key.replace(/_/g, ' ')}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowChecklistDialog(false)}>Cancel</Button>
            <Button onClick={handleChecklistComplete} disabled={!allChecked}>Continue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RawUploadSectionProps {
  shoot: ShootData;
  onUploadComplete: () => void;
}

export function RawUploadSection({ shoot, onUploadComplete }: RawUploadSectionProps) {
  const { toast } = useToast();
  const { trackUpload, uploads } = useUpload();
  const [bracketType, setBracketType] = useState<'3-bracket' | '5-bracket'>(shoot.bracketMode === 3 ? '3-bracket' : '5-bracket');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extraFiles, setExtraFiles] = useState<Set<string>>(new Set());
  const [floorplanFiles, setFloorplanFiles] = useState<Set<string>>(new Set());
  const [virtualStagingFiles, setVirtualStagingFiles] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState('');
  const dragCounterRef = useRef(0);

  const activeUploads = uploads.filter((u) => u.shootId === String(shoot.id) && u.uploadType === 'raw' && u.status === 'uploading');
  const uploading = activeUploads.length > 0;
  const shootHasVideoService = useMemo(() => (shoot.services || []).some((service) => /video/i.test(String(service))), [shoot]);
  const shootRequiresBrackets = isHdrShoot(shoot.services || []);
  const existingRawCount = shoot.rawPhotoCount || 0;
  const photoServicesFromObjects = extractPhotoServicesFromServiceObjects(shoot);
  const photoServices = photoServicesFromObjects.length > 0 ? photoServicesFromObjects : extractPhotoServicesFromServices(shoot.services || []);
  const photoServicesExpectedCount = photoServices.reduce((sum, service) => sum + service.count, 0);
  const expectedPhotos = photoServicesExpectedCount || shoot.package?.expectedDeliveredCount || shoot.expectedFinalCount || 0;
  const bracketMultiplier = shootRequiresBrackets ? (bracketType === '3-bracket' ? 3 : 5) : 1;
  const expectedRawCount = expectedPhotos * bracketMultiplier;
  const uploadedCount = uploadedFiles.length;
  const totalRawCount = existingRawCount + uploadedCount;
  const missingCount = Math.max(0, expectedRawCount - totalRawCount);
  const uploadAccept = FULL_UPLOAD_ACCEPT;

  const getFileClassification = (index: number): 'extra' | 'floorplan' | 'virtual_staging' | null => {
    const fileId = String(index);
    if (extraFiles.has(fileId)) return 'extra';
    if (floorplanFiles.has(fileId)) return 'floorplan';
    if (virtualStagingFiles.has(fileId)) return 'virtual_staging';
    return null;
  };

  const setFileClassification = (index: number, classification: 'extra' | 'floorplan' | 'virtual_staging' | null) => {
    const fileId = String(index);
    setExtraFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      if (classification === 'extra') next.add(fileId);
      return next;
    });
    setFloorplanFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      if (classification === 'floorplan') next.add(fileId);
      return next;
    });
    setVirtualStagingFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      if (classification === 'virtual_staging') next.add(fileId);
      return next;
    });
  };

  const toggleFileClassification = (index: number, classification: 'extra' | 'floorplan' | 'virtual_staging') => {
    const current = getFileClassification(index);
    setFileClassification(index, current === classification ? null : classification);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    const oversizedFiles: string[] = [];
    files.forEach((file) => {
      if (file.size > 500 * 1024 * 1024) {
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
      const startIdx = uploadedFiles.length;
      setUploadedFiles((prev) => [...prev, ...validFiles]);
      setFloorplanFiles((prev) => {
        const next = new Set(prev);
        validFiles.forEach((file, index) => {
          if (isEditedFloorplanByName(file.name)) next.add(String(startIdx + index));
        });
        return next;
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    const validFiles: File[] = [];
    const oversizedFiles: string[] = [];
    files.forEach((file) => {
      if (file.size > 500 * 1024 * 1024) {
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
      const startIdx = uploadedFiles.length;
      setUploadedFiles((prev) => [...prev, ...validFiles]);
      setFloorplanFiles((prev) => {
        const next = new Set(prev);
        validFiles.forEach((file, index) => {
          if (isEditedFloorplanByName(file.name)) next.add(String(startIdx + index));
        });
        return next;
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleConfirmSubmit = async () => {
    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];
    const CONCURRENT = 3;
    const filesToUpload = [...uploadedFiles];
    const notesSnapshot = editingNotes.trim();
    const bracketTypeSnapshot = bracketType;
    const extraFilesSnapshot = new Set(extraFiles);
    const floorplanFilesSnapshot = new Set(floorplanFiles);
    const virtualStagingFilesSnapshot = new Set(virtualStagingFiles);
    const errors: string[] = [];

    const getUploadMediaTypeFromSnapshot = (fileIndex: number, isVideo: boolean): 'floorplan' | 'extra' | 'virtual_staging' | null => {
      const fileId = String(fileIndex);
      let classification: 'extra' | 'floorplan' | 'virtual_staging' | null = null;
      if (extraFilesSnapshot.has(fileId)) classification = 'extra';
      if (floorplanFilesSnapshot.has(fileId)) classification = 'floorplan';
      if (virtualStagingFilesSnapshot.has(fileId)) classification = 'virtual_staging';
      if (!classification) return null;
      if (classification === 'floorplan' && isVideo) return null;
      if (classification === 'virtual_staging' && isVideo) return null;
      return classification;
    };

    trackUpload({
      shootId: shoot.id,
      shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
      fileCount: filesToUpload.length,
      fileNames: filesToUpload.map((f) => f.name),
      uploadType: 'raw',
      uploadFn: async (onProgress) => {
        let completed = 0;
        const uploadOne = (file: File, fileIndex: number): Promise<{ success: boolean; error?: string }> => new Promise((resolve) => {
          const fd = new FormData();
          const isVideo = isVideoUpload(file);
          fd.append('files[]', file);
          fd.append('upload_type', 'raw');
          if (isVideo) fd.append('service_category', 'video');
          const uploadMediaType = getUploadMediaTypeFromSnapshot(fileIndex, isVideo);
          if (uploadMediaType) {
            fd.append('media_type', uploadMediaType);
            if (uploadMediaType === 'extra') fd.append('is_extra', 'true');
          }
          if (shootRequiresBrackets) {
            fd.append('bracket_mode', bracketTypeSnapshot === '3-bracket' ? '3' : '5');
          }
          if (notesSnapshot) fd.append('photographer_notes', notesSnapshot);

          const xhr = new XMLHttpRequest();
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ success: true });
            } else {
              let msg = 'Upload failed';
              try { msg = JSON.parse(xhr.responseText).message || msg; } catch {
                // Ignore malformed error payloads and keep the fallback message.
              }
              resolve({ success: false, error: `${file.name}: ${msg}` });
            }
          });
          xhr.addEventListener('error', () => resolve({ success: false, error: `${file.name}: Network error` }));
          xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
          if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
          if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
          xhr.send(fd);
        });

        for (let i = 0; i < filesToUpload.length; i += CONCURRENT) {
          const batch = filesToUpload.slice(i, Math.min(i + CONCURRENT, filesToUpload.length));
          const results = await Promise.all(batch.map((file, batchIndex) => uploadOne(file, i + batchIndex)));
          results.forEach((result) => {
            completed += 1;
            if (!result.success && result.error) errors.push(result.error);
          });
          onProgress(Math.round((completed / filesToUpload.length) * 100));
        }

        if (errors.length === filesToUpload.length) {
          throw new Error(`All ${filesToUpload.length} files failed to upload`);
        }
      },
      onComplete: () => {
        if (errors.length > 0) {
          toast({ title: 'Partial Success', description: `${filesToUpload.length - errors.length}/${filesToUpload.length} files uploaded. ${errors.length} failed.`, variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: `All ${filesToUpload.length} raw files uploaded successfully` });
        }
        setUploadedFiles([]);
        setExtraFiles(new Set());
        setFloorplanFiles(new Set());
        setVirtualStagingFiles(new Set());
        setEditingNotes('');
        triggerUploadRefreshes(shoot.id);
        onUploadComplete();
      },
      onError: (errorMessage) => {
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      },
    });
  };

  const handleSubmitRAW = () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'No files', description: 'Please select files to upload', variant: 'destructive' });
      return;
    }
    void handleConfirmSubmit();
  };

  return (
    <div className="space-y-3 flex flex-col flex-1">
      {shootRequiresBrackets && (
        <div className="space-y-2">
          <Label>Bracket Type</Label>
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

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="p-2 border rounded bg-muted/50">
          <div className="text-muted-foreground">Expected</div>
          <div className="font-semibold text-base">{expectedPhotos * bracketMultiplier}</div>
          {photoServices.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
              {photoServices.map((service, index) => <div key={index}>{service.name}: {shootRequiresBrackets ? service.count * bracketMultiplier : service.count}</div>)}
            </div>
          )}
        </div>
        <div className="p-2 border rounded bg-muted/50">
          <div className="text-muted-foreground">Existing</div>
          <div className="font-semibold text-base">{existingRawCount + uploadedFiles.length}</div>
        </div>
        <div className="p-2 border rounded bg-muted/50">
          <div className="text-muted-foreground">Extras</div>
          <div className="font-semibold text-base">{extraFiles.size}</div>
        </div>
        <div className="p-2 border rounded bg-muted/50">
          <div className="text-muted-foreground">VS</div>
          <div className="font-semibold text-base">{virtualStagingFiles.size}</div>
        </div>
      </div>

      {missingCount > 0 && totalRawCount > 0 && (
        <Alert className="bg-orange-500/10 border-orange-500/30">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700">
            {missingCount} photo(s) missing. Expected {expectedRawCount} photos{shootRequiresBrackets ? ` (${expectedPhotos} final × ${bracketMultiplier} brackets)` : ''}, but only {totalRawCount} uploaded.
          </AlertDescription>
        </Alert>
      )}

      {activeUploads.map((activeUpload) => (
        <UploadProgressCard
          key={activeUpload.id}
          fileCount={activeUpload.fileCount}
          fileNames={activeUpload.fileNames}
          progress={activeUpload.progress}
          note="You can close this dialog while upload continues in the background."
        />
      ))}

      <UploadDropzone
        empty={uploadedFiles.length === 0}
        accept={uploadAccept}
        inputId="file-upload"
        title="No uploaded files yet"
        description={`${shootHasVideoService ? 'Upload photos and videos to get started.' : 'Upload photos to get started.'} You can drag and drop files or use the upload button.`}
        buttonLabel="Upload Files"
        browseLabel="Drag and drop more files here or click to browse"
        onBrowse={() => document.getElementById('file-upload')?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onFileSelect={handleFileSelect}
      />

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            Selected Files ({uploadedFiles.length})
            <span className="text-xs text-muted-foreground font-normal">(EX = extra, FP = floorplan, VS = virtual staging)</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs flex-1 truncate">{file.name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isVideoUpload(file) && (
                      <>
                        <button type="button" className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${floorplanFiles.has(String(index)) ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`} onClick={() => toggleFileClassification(index, 'floorplan')} title={floorplanFiles.has(String(index)) ? 'Unmark as floorplan' : 'Move to Floorplans tab'}>FP</button>
                        <button type="button" className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${virtualStagingFiles.has(String(index)) ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`} onClick={() => toggleFileClassification(index, 'virtual_staging')} title={virtualStagingFiles.has(String(index)) ? 'Unmark as virtual staging' : 'Move to Virtual Staging tab'}>VS</button>
                      </>
                    )}
                    <button type="button" className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${extraFiles.has(String(index)) ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`} onClick={() => toggleFileClassification(index, 'extra')} title={extraFiles.has(String(index)) ? 'Unmark as extra' : 'Move to Extras tab'}>EX</button>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                  setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
                  setExtraFiles((prev) => reindexSelectionSet(prev, index));
                  setFloorplanFiles((prev) => reindexSelectionSet(prev, index));
                  setVirtualStagingFiles((prev) => reindexSelectionSet(prev, index));
                }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-1.5">
          <Label>Notes for Editor (Optional)</Label>
          <Textarea
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            placeholder="Add any notes for the editor..."
            className="min-h-[60px] max-h-[80px] resize-none"
          />
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="flex gap-2">
          <Button onClick={handleSubmitRAW} disabled={uploading || uploadedFiles.length === 0} className="flex-1 relative overflow-hidden">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? `Upload ${uploadedFiles.length} More Files` : 'Upload RAW Photos'}
          </Button>
        </div>
      )}
    </div>
  );
}

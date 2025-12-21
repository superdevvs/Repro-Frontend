import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { FileUploader } from '@/components/media/FileUploader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { fotelloService, type EditingType } from '@/services/fotelloService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
}

interface MediaFile {
  id: string;
  filename: string;
  url?: string;
  path?: string;
  fileType?: string;
  workflowStage?: string;
  isExtra?: boolean;
  // Image size URLs from backend
  thumb?: string;
  medium?: string;
  large?: string;
  original?: string;
  // Size info
  width?: number;
  height?: number;
  fileSize?: number;
}

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
}: ShootDetailsMediaTabProps) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'uploaded' | 'edited' | 'upload'>('uploaded');
  const [displayTab, setDisplayTab] = useState<'uploaded' | 'edited'>('uploaded');
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

  // Load editing types
  useEffect(() => {
    const loadEditingTypes = async () => {
      try {
        const types = await fotelloService.getEditingTypes();
        setEditingTypes(types);
        if (types.length > 0) {
          setSelectedEditingType(types[0].id);
        }
      } catch (error) {
        console.error('Failed to load editing types:', error);
      }
    };
    loadEditingTypes();
  }, []);

  // Load files
  useEffect(() => {
    if (!shoot.id) return;
    const loadFiles = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        };

        const mapFiles = (json: any): MediaFile[] =>
          (json?.data || json || []).map((f: any) => ({
            id: String(f.id),
            filename: f.filename || f.stored_filename,
            url: f.url || f.path,
            path: f.path,
            fileType: f.file_type || f.fileType,
            workflowStage: f.workflow_stage || f.workflowStage,
            isExtra: f.is_extra || false,
            // Image sizes from backend
            thumb: f.thumb_url || f.thumb,
            medium: f.medium_url || f.medium,
            large: f.large_url || f.large,
            original: f.original_url || f.original || f.url || f.path,
            width: f.width,
            height: f.height,
            fileSize: f.file_size || f.fileSize,
          }));

        const [rawRes, editedRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files?type=raw`, { headers }),
          fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files?type=edited`, { headers }),
        ]);

        if (!rawRes.ok && rawRes.status !== 404) {
          throw new Error('Failed to load raw files');
        }
        if (!editedRes.ok && editedRes.status !== 404) {
          throw new Error('Failed to load edited files');
        }

        const rawJson = rawRes.ok ? await rawRes.json() : { data: [] };
        const editedJson = editedRes.ok ? await editedRes.json() : { data: [] };

        setRawFiles(mapFiles(rawJson));
        setEditedFiles(mapFiles(editedJson));
      } catch (error) {
        console.error('Error loading files:', error);
        // Set empty arrays on error to prevent UI issues
        setRawFiles([]);
        setEditedFiles([]);
      }
    };
    
    loadFiles();
  }, [shoot.id, onShootUpdate]);

  // Determine which tabs to show
  const showUploadTab = isAdmin || isPhotographer || isEditor;
  const canDownload = isAdmin || isClient || isEditor;

  const normalizedShootStatus = String(shoot?.workflowStatus || (shoot as any)?.status || '').toLowerCase();
  const isScheduledShoot = normalizedShootStatus === 'scheduled' || normalizedShootStatus === 'booked';
  const hasAnyMedia = rawFiles.length > 0 || editedFiles.length > 0;

  // Get image URL with fallback chain
  const getImageUrl = (file: MediaFile, size: 'thumb' | 'medium' | 'large' | 'original' = 'medium'): string => {
    const baseUrl = API_BASE_URL;
    const base = baseUrl.replace(/\/+$/, '');

    const encodeIfNeeded = (value: string): string => {
      // Always encode to handle spaces and other special chars in filenames.
      // encodeURI keeps query strings intact.
      try {
        return encodeURI(value);
      } catch {
        return value;
      }
    };

    const normalizeRelative = (value: string): string => {
      const v = value.replace(/^\/+/, '');
      // Local public disk files live under /storage
      if (v.startsWith('shoots/')) {
        return `${base}${encodeIfNeeded(`/storage/${v}`)}`;
      }
      return `${base}${encodeIfNeeded(`/${v}`)}`;
    };
    
    // Try size-specific URL first
    const sizeUrl = file[size];
    if (sizeUrl) {
      if (/^https?:\/\//i.test(sizeUrl)) return encodeIfNeeded(sizeUrl);
      if (sizeUrl.startsWith('/')) return `${base}${encodeIfNeeded(sizeUrl)}`;
      return normalizeRelative(sizeUrl);
    }
    
    // Fallback to original
    if (file.original) {
      if (/^https?:\/\//i.test(file.original)) return encodeIfNeeded(file.original);
      if (file.original.startsWith('/')) return `${base}${encodeIfNeeded(file.original)}`;
      return normalizeRelative(file.original);
    }
    
    // Final fallback
    if (file.url) {
      if (/^https?:\/\//i.test(file.url)) return encodeIfNeeded(file.url);
      if (file.url.startsWith('/')) return `${base}${encodeIfNeeded(file.url)}`;
      return normalizeRelative(file.url);
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

  // Check if file is image
  const isPreviewableImage = (file: MediaFile): boolean => {
    const name = file.filename.toLowerCase();
    const rawExt = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/.test(name);
    if (rawExt) return false;

    const mime = (file.fileType || '').toLowerCase();
    const rawMime = mime.includes('nef') || mime.includes('dng') || mime.includes('cr2') || mime.includes('cr3') || mime.includes('arw') || mime.includes('raf') || mime.includes('raw');
    if (rawMime) return false;

    if (mime.startsWith('image/')) {
      // Many servers report RAW as image/*; exclude those above.
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
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const fileIds = Array.from(selectedFiles);
      
      // Request download from backend
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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

  // Get current files based on active tab
  const currentFiles = activeSubTab === 'uploaded' ? rawFiles : editedFiles;

  // Edited Upload Section Component (for Editors)
  const EditedUploadSection = ({ shoot, onUploadComplete }: { shoot: ShootData; onUploadComplete: () => void }) => {
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [editingNotes, setEditingNotes] = useState('');
    const [showChecklistDialog, setShowChecklistDialog] = useState(false);
    const [showNotesDialog, setShowNotesDialog] = useState(false);
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

      // Show checklist dialog first
      setShowChecklistDialog(true);
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
      setShowNotesDialog(true);
    };

    // Upload a single edited file with progress tracking
    const uploadSingleEditedFile = (
      file: File, 
      fileIndex: number, 
      token: string,
      isFirstFile: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const formData = new FormData();
        formData.append('files[]', file);
        formData.append('upload_type', 'edited');
        
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
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    };

    const handleConfirmSubmit = async () => {
      setShowNotesDialog(false);
      setUploading(true);
      setUploadProgress(0);
      
      // Initialize file progress for all files
      const initialProgress: Record<number, number> = {};
      uploadedFiles.forEach((_, index) => {
        initialProgress[index] = 0;
      });
      setFileProgress(initialProgress);
      
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
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
            return uploadSingleEditedFile(file, fileIndex, token || '', fileIndex === 0);
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

        // Submit for review after uploading edited files
        try {
          await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/submit-for-review`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
        } catch (statusError) {
          console.error('Failed to submit for review:', statusError);
        }

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
      <div className="space-y-4">
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
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        >
          <input
            type="file"
            multiple
            accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng,.raf,.orf,.pef,.rw2,.srw"
            onChange={handleFileSelect}
            className="hidden"
            id="edited-file-upload"
          />
          <label htmlFor="edited-file-upload" className="cursor-pointer">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm font-medium">Drag and drop edited files here</div>
            <div className="text-xs text-muted-foreground mt-1">or click to browse</div>
          </label>
        </div>

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

        {/* Submit Button with Progress Bar */}
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
                Submit Edits for Review
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

        {/* Editing Notes Dialog */}
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Editing Notes (Optional)</DialogTitle>
              <DialogDescription>
                Add any notes about the editing process.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add any notes about the editing..."
                  className="w-full min-h-[100px] p-2 border rounded-md text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
                  Skip
                </Button>
                <Button onClick={handleConfirmSubmit} disabled={uploading}>
                  Submit Edits
                </Button>
              </div>
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

  // Raw Upload Section Component
  const RawUploadSection = ({ shoot, onUploadComplete }: { shoot: ShootData; onUploadComplete: () => void }) => {
    const [bracketType, setBracketType] = useState<'3-bracket' | '5-bracket'>(
      shoot.bracketMode === 5 ? '5-bracket' : '3-bracket'
    );
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submittingForReview, setSubmittingForReview] = useState(false);
    const [extraFiles, setExtraFiles] = useState<Set<string>>(new Set());
    const [editingNotes, setEditingNotes] = useState('');
    const [showNotesDialog, setShowNotesDialog] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileProgress, setFileProgress] = useState<Record<number, number>>({});

    // Use shoot's existing counts for display
    const existingRawCount = shoot.rawPhotoCount || 0;
    const expectedPhotos = shoot.package?.expectedDeliveredCount || shoot.expectedFinalCount || 0;
    const bracketMultiplier = bracketType === '3-bracket' ? 3 : 5;
    const expectedRawCount = expectedPhotos * bracketMultiplier;
    const uploadedCount = uploadedFiles.length;
    const totalRawCount = existingRawCount + uploadedCount;
    const equivalentFinalPhotos = Math.floor(totalRawCount / bracketMultiplier);
    const missingCount = Math.max(0, expectedRawCount - totalRawCount);
    const isShort = totalRawCount < expectedRawCount;
    
    // Can submit for review if there are uploaded files and workflow allows it
    const canSubmitForReview = existingRawCount > 0 && 
      ['raw_uploaded', 'raw_issue'].includes(shoot.workflowStatus || '');

    // Handle submit for review
    const handleSubmitForReview = async () => {
      setSubmittingForReview(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/submit-for-review`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to submit for review');
        }

        toast({
          title: 'Success',
          description: 'Shoot submitted for admin review',
        });
        onUploadComplete();
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to submit for review',
          variant: 'destructive',
        });
      } finally {
        setSubmittingForReview(false);
      }
    };

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

      // Show notes dialog before submitting
      setShowNotesDialog(true);
    };

    // Upload a single file with progress tracking
    const uploadSingleFile = (
      file: File, 
      fileIndex: number, 
      token: string,
      isFirstFile: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const formData = new FormData();
        formData.append('files[]', file);
        formData.append('upload_type', 'raw');
        
        // Only send metadata with first file to avoid duplicate updates
        if (isFirstFile) {
          formData.append('bracket_mode', bracketType === '3-bracket' ? '3' : '5');
          if (extraFiles.has(String(fileIndex))) {
            formData.append('is_extra', 'true');
          }
          if (editingNotes.trim()) {
            formData.append('photographer_notes', editingNotes.trim());
          }
        } else {
          formData.append('bracket_mode', bracketType === '3-bracket' ? '3' : '5');
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
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    };

    const handleConfirmSubmit = async () => {
      setShowNotesDialog(false);
      setUploading(true);
      setUploadProgress(0);
      
      // Initialize file progress for all files
      const initialProgress: Record<number, number> = {};
      uploadedFiles.forEach((_, index) => {
        initialProgress[index] = 0;
      });
      setFileProgress(initialProgress);
      
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
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
            return uploadSingleFile(file, fileIndex, token || '', fileIndex === 0);
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
      <div className="space-y-4">
        {/* Bracket Type Selector */}
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

        {/* Counters */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">Expected</div>
            <div className="font-semibold text-base">{expectedRawCount}</div>
          </div>
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">Existing</div>
            <div className="font-semibold text-base">{existingRawCount}</div>
          </div>
          <div className="p-2 border rounded bg-muted/50">
            <div className="text-muted-foreground">New</div>
            <div className="font-semibold text-base">{uploadedCount}</div>
          </div>
          <div className={`p-2 border rounded ${missingCount > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <div className="text-muted-foreground">{missingCount > 0 ? 'Missing' : 'Complete'}</div>
            <div className={`font-semibold text-base ${missingCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {missingCount > 0 ? missingCount : '✓'}
            </div>
          </div>
        </div>
        
        {/* Missing photos warning */}
        {missingCount > 0 && totalRawCount > 0 && (
          <Alert className="bg-orange-500/10 border-orange-500/30">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              {missingCount} photo(s) missing. Expected {expectedRawCount} RAW photos ({expectedPhotos} final × {bracketMultiplier} brackets), but only {totalRawCount} uploaded.
            </AlertDescription>
          </Alert>
        )}

        {/* Drag and Drop Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        >
          <input
            type="file"
            multiple
            accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.srw,.x3f"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm font-medium">Drag and drop files here</div>
            <div className="text-xs text-muted-foreground mt-1">or click to browse</div>
          </label>
        </div>

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

        {/* Warning if short */}
        {isShort && uploadedCount > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              Warning: You have uploaded {uploadedCount} files, but {expectedRawCount} are expected for {expectedPhotos} final photos with {bracketType}. {expectedRawCount - uploadedCount} photos are missing.
            </AlertDescription>
          </Alert>
        )}

        {/* Extras Section - Show below main uploads */}
        {extraFiles.size > 0 && uploadedFiles.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <div className="text-sm font-medium text-muted-foreground">Extras ({extraFiles.size})</div>
            <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-muted/30">
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
            
            {canSubmitForReview && !uploading && (
              <Button
                onClick={handleSubmitForReview}
                disabled={submittingForReview}
                variant="default"
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {submittingForReview ? 'Submitting...' : 'Mark Complete'}
              </Button>
            )}
          </div>
        </div>
        
        {/* Info about submit for review */}
        {existingRawCount > 0 && !canSubmitForReview && (
          <p className="text-xs text-muted-foreground text-center">
            Upload all required photos, then click "Mark Complete" to submit for admin review.
          </p>
        )}

        {/* Editing Notes Dialog */}
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Editing Notes (Optional)</DialogTitle>
              <DialogDescription>
                Add any notes for the editor before submitting RAW files.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add any notes for the editor..."
                  className="w-full min-h-[100px] p-2 border rounded-md text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
                  Skip
                </Button>
                <Button onClick={handleConfirmSubmit} disabled={uploading}>
                  Submit RAW
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header - Tabs with Upload button inline on desktop, expand/collapse button */}
      <div className="mb-1.5 pb-1 border-b flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Tabs value={activeSubTab === 'upload' ? 'uploaded' : (activeSubTab === 'uploaded' || activeSubTab === 'edited' ? activeSubTab : 'uploaded')} onValueChange={(v) => {
            if (v === 'media' || v === 'uploaded') {
              setActiveSubTab('uploaded');
              setDisplayTab('uploaded');
            } else if (v === 'edited') {
              setActiveSubTab('edited');
              setDisplayTab('edited');
            }
          }} className="flex-1 min-w-0">
            <TabsList className="w-full justify-start h-7 sm:h-8 bg-transparent p-0 min-w-max sm:min-w-0">
              <TabsTrigger 
                value="media" 
                className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none whitespace-nowrap"
                onClick={() => {
                  setActiveSubTab('uploaded');
                  setDisplayTab('uploaded');
                }}
              >
                Media
              </TabsTrigger>
              <TabsTrigger 
                value="uploaded" 
                className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none whitespace-nowrap"
                onClick={() => {
                  setActiveSubTab('uploaded');
                  setDisplayTab('uploaded');
                }}
              >
                Uploaded ({rawFiles.length})
              </TabsTrigger>
              <TabsTrigger 
                value="edited" 
                className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none whitespace-nowrap"
                onClick={() => {
                  setActiveSubTab('edited');
                  setDisplayTab('edited');
                }}
              >
                Edited ({editedFiles.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Upload and Download buttons - Inline on desktop, below on mobile */}
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            {/* Select All / Deselect All button */}
            {(rawFiles.length > 0 || editedFiles.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => {
                  const currentFiles = displayTab === 'uploaded' ? rawFiles : editedFiles;
                  if (selectedFiles.size === currentFiles.length) {
                    setSelectedFiles(new Set());
                  } else {
                    setSelectedFiles(new Set(currentFiles.map(f => f.id)));
                  }
                }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                <span>
                  {selectedFiles.size === (displayTab === 'uploaded' ? rawFiles : editedFiles).length 
                    ? 'Deselect All' 
                    : 'Select All'}
                </span>
              </Button>
            )}
            {/* AI Edit and Download buttons for selected files */}
            {canDownload && selectedFiles.size > 0 && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-[11px] px-2 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => setShowAiEditDialog(true)}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  <span>AI Edit ({selectedFiles.size})</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-7 text-[11px] px-2" disabled={downloading}>
                      <Download className="h-3 w-3 mr-1" />
                      <span>Download ({selectedFiles.size})</span>
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
              </>
            )}
            {/* Upload button - Inline on desktop */}
            {showUploadTab && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-[11px] px-3 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setActiveSubTab('upload')}
              >
                <Upload className="h-3 w-3 mr-1" />
                <span>Upload</span>
              </Button>
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
      
      {/* Upload and Download buttons - Below tabs on mobile only */}
      {(showUploadTab || (canDownload && selectedFiles.size > 0) || rawFiles.length > 0 || editedFiles.length > 0) && (
        <div className="mb-1.5 pb-1 border-b flex-shrink-0 sm:hidden">
          <div className="flex items-center justify-end gap-1.5">
            {/* Select All / Deselect All button */}
            {(rawFiles.length > 0 || editedFiles.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2 w-full"
                onClick={() => {
                  const currentFiles = displayTab === 'uploaded' ? rawFiles : editedFiles;
                  if (selectedFiles.size === currentFiles.length) {
                    setSelectedFiles(new Set());
                  } else {
                    setSelectedFiles(new Set(currentFiles.map(f => f.id)));
                  }
                }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                <span>
                  {selectedFiles.size === (displayTab === 'uploaded' ? rawFiles : editedFiles).length 
                    ? 'Deselect All' 
                    : 'Select All'}
                </span>
              </Button>
            )}
            {/* AI Edit and Download buttons for selected files */}
            {canDownload && selectedFiles.size > 0 && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-[11px] px-2 w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => setShowAiEditDialog(true)}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  <span>AI Edit</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-7 text-[11px] px-2 w-full" disabled={downloading}>
                      <Download className="h-3 w-3 mr-1" />
                      <span>Download</span>
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
              </>
            )}
            {/* Upload button - Full width on mobile */}
            {showUploadTab && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-[11px] px-3 bg-blue-600 hover:bg-blue-700 text-white w-full"
                onClick={() => setActiveSubTab('upload')}
              >
                <Upload className="h-3 w-3 mr-1" />
                <span>Upload</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content - Compact Overview-style layout, scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {activeSubTab === 'upload' ? (
          /* Upload Tab Content */
          <div className="space-y-2">
            <div className="p-2.5 border rounded-lg bg-card">
              {isEditor ? (
                <EditedUploadSection
                  shoot={shoot}
                    onUploadComplete={() => {
                      toast({
                        title: 'Upload complete',
                        description: 'Edited files uploaded successfully',
                      });
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
                      onShootUpdate();
                      setActiveSubTab('uploaded');
                      setDisplayTab('uploaded');
                    }}
                />
              )}
            </div>
          </div>
        ) : (
          <Tabs value={displayTab} onValueChange={(v) => {
            if (v === 'media' || v === 'uploaded') {
              setActiveSubTab('uploaded');
              setDisplayTab('uploaded');
            } else if (v === 'edited') {
              setActiveSubTab('edited');
              setDisplayTab('edited');
            }
          }}>
            {/* Media/Uploaded Tab - Media tab shows uploaded content */}
            <TabsContent value="media" className="mt-0">
              {!hasAnyMedia && isScheduledShoot ? (
                <div className="p-2.5 border rounded-lg bg-card">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileIcon className="h-4 w-4" />
                    <span>Scheduled shoot — photos are not available yet.</span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">RAW Uploaded</span>
                      <span className="font-medium">{rawFiles.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Edited Uploaded</span>
                      <span className="font-medium">{editedFiles.length}</span>
                    </div>
                  </div>
                </div>
              ) : rawFiles.length === 0 ? (
                <Card className="border-2 border-dashed bg-muted/30">
                  <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <ImageIcon className="h-10 w-10 text-primary/60" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No media uploaded yet</h3>
                    <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                      Upload photos and videos to get started. You can drag and drop files or use the upload button.
                    </p>
                    {showUploadTab && (
                      <Button
                        variant="default"
                        size="lg"
                        className="bg-primary hover:bg-primary/90"
                        onClick={() => setActiveSubTab('upload')}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Files
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="p-2.5 border rounded-lg bg-card">
                  <MediaGrid
                    files={rawFiles}
                    onFileClick={(index) => openViewer(index, rawFiles)}
                    selectedFiles={selectedFiles}
                    onSelectionChange={toggleSelection}
                    canSelect={canDownload}
                    getImageUrl={getImageUrl}
                    getSrcSet={getSrcSet}
                    isImage={isPreviewableImage}
                  />
                </div>
              )}
            </TabsContent>
            
            {/* Uploaded Media Tab */}
            <TabsContent value="uploaded" className="mt-0">
              {rawFiles.length === 0 ? (
                <Card className="border-2 border-dashed bg-muted/30">
                  <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <ImageIcon className="h-10 w-10 text-primary/60" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No uploaded files yet</h3>
                    <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                      Upload photos and videos to get started. You can drag and drop files or use the upload button.
                    </p>
                    {showUploadTab && (
                      <Button
                        variant="default"
                        size="lg"
                        className="bg-primary hover:bg-primary/90"
                        onClick={() => setActiveSubTab('upload')}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Files
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="p-2.5 border rounded-lg bg-card">
                  <MediaGrid
                    files={rawFiles}
                    onFileClick={(index) => openViewer(index, rawFiles)}
                    selectedFiles={selectedFiles}
                    onSelectionChange={toggleSelection}
                    canSelect={canDownload}
                    getImageUrl={getImageUrl}
                    getSrcSet={getSrcSet}
                    isImage={isPreviewableImage}
                  />
                </div>
              )}
            </TabsContent>

            {/* Edited Media Tab */}
            <TabsContent value="edited" className="mt-0">
              {editedFiles.length === 0 ? (
                <Card className="border-2 border-dashed bg-muted/30">
                  <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="h-20 w-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                      <ImageIcon className="h-10 w-10 text-purple-500/60" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No edited files yet</h3>
                    <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                      Edited photos will appear here once they've been processed and uploaded.
                    </p>
                    {isEditor && (
                      <Button
                        variant="default"
                        size="lg"
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => setActiveSubTab('upload')}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Edited Files
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="p-2.5 border rounded-lg bg-card">
                  <MediaGrid
                    files={editedFiles}
                    onFileClick={(index) => openViewer(index, editedFiles)}
                    selectedFiles={selectedFiles}
                    onSelectionChange={toggleSelection}
                    canSelect={canDownload}
                    getImageUrl={getImageUrl}
                    getSrcSet={getSrcSet}
                    isImage={isPreviewableImage}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
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
    </div>
  );
}

// Media Grid Component
interface MediaGridProps {
  files: MediaFile[];
  onFileClick: (index: number) => void;
  selectedFiles: Set<string>;
  onSelectionChange: (fileId: string) => void;
  canSelect: boolean;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  getSrcSet: (file: MediaFile) => string;
  isImage: (file: MediaFile) => boolean;
}

function MediaGrid({ 
  files, 
  onFileClick, 
  selectedFiles, 
  onSelectionChange, 
  canSelect,
  getImageUrl,
  getSrcSet,
  isImage,
}: MediaGridProps) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-1">
      {files.map((file, index) => {
        const isSelected = selectedFiles.has(file.id);
        const isImg = isImage(file);
        const imageUrl = getImageUrl(file, 'medium');
        const srcSet = getSrcSet(file);
        const ext = file.filename.split('.').pop()?.toUpperCase();
        
        return (
          <div
            key={file.id}
            className={`relative aspect-square rounded overflow-hidden border cursor-pointer transition-all group ${
              isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => {
              if (canSelect) {
                onSelectionChange(file.id);
              } else {
                onFileClick(index);
              }
            }}
            onDoubleClick={() => onFileClick(index)}
          >
            {isImg && imageUrl ? (
              <img
                src={getImageUrl(file, 'thumb')}
                srcSet={srcSet}
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                alt={file.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <FileIcon className="h-6 w-6" />
                  {ext && <span className="text-[10px] font-semibold">{ext}</span>}
                </div>
              </div>
            )}
            
            {isSelected && (
              <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                <CheckCircle2 className="h-3 w-3" />
              </div>
            )}
            
            {canSelect && (
              <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelectionChange(file.id)}
                  className="bg-background/80"
                />
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
              {file.filename}
            </div>
          </div>
        );
      })}
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
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Create an issue linked to this media file
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
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

  const imageUrl = getImageUrl(currentFile, 'large');
  const srcSet = getSrcSet(currentFile);
  const isImg = isPreviewableImage(currentFile);
  const fileExt = currentFile?.filename?.split('.')?.pop()?.toUpperCase();

  const TOP_NAV_OFFSET = 64;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-none max-h-none h-full w-screen p-0 bg-black/95 backdrop-blur-md border-0 rounded-none [&>button:last-child]:hidden"
        style={{
          top: TOP_NAV_OFFSET,
          left: 0,
          right: 0,
          transform: 'none',
          width: '100vw',
          height: `calc(100vh - ${TOP_NAV_OFFSET}px)`,
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
            className="absolute top-4 right-4 z-20 text-white hover:bg-white/20 rounded-full"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>

          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-10 text-white hover:bg-white/20"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {/* Top Metadata Bar */}
          {isImg && currentFile && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-md rounded-lg px-4 py-2 flex items-center gap-4 text-white text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentFile.filename}</span>
              </div>
              {currentFile.width && currentFile.height && (
                <div className="text-white/70">
                  {currentFile.width} × {currentFile.height}
                </div>
              )}
              {currentFile.fileSize && (
                <div className="text-white/70">
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
                      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/${currentFile.id}/cover`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                          'Accept': 'application/json',
                        },
                      });
                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                        console.error('Cover API error:', response.status, errorData);
                        throw new Error(errorData.message || `HTTP ${response.status}`);
                      }
                      toast({ title: 'Cover Photo', description: 'Cover photo updated successfully' });
                      onShootUpdate();
                    } catch (error) {
                      console.error('Set cover error:', error);
                      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to set cover photo', variant: 'destructive' });
                    }
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Make Cover
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-center p-8 overflow-auto" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            {isImg ? (
              <img
                src={imageUrl}
                srcSet={srcSet}
                sizes="90vw"
                alt={currentFile.filename}
                className="max-w-full max-h-[70vh] object-contain select-none rounded-lg shadow-2xl"
                loading="eager"
                draggable={false}
              />
            ) : (
              <div className="text-white text-center">
                <FileIcon className="h-16 w-16 mx-auto mb-4" />
                <p>{currentFile.filename}</p>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          {isImg && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-lg p-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom out"
              >
                <span className="text-sm">−</span>
              </Button>
              <span className="text-white text-xs min-w-[3rem] text-center font-medium">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                title="Zoom in"
              >
                <span className="text-sm">+</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-white hover:bg-white/20"
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
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
              onClick={() => setShowFlagDialog(true)}
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Flag Issue
            </Button>
          )}

          {currentIndex < files.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-10 text-white hover:bg-white/20"
              onClick={handleNext}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Bottom Filmstrip */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md text-white p-4 z-20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium text-sm">{currentFile.filename}</div>
                <div className="text-xs text-gray-300">
                  {currentIndex + 1} of {files.length}
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Use ← → arrow keys to navigate • + - to zoom • ESC to close
              </div>
            </div>
            
            {/* Filmstrip Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {files.map((file, index) => {
                    const isActive = index === currentIndex;
                    const fileImageUrl = getImageUrl(file, 'thumb');
                    const fileIsImg = isImageFile(file);
                
                return (
                  <button
                    key={file.id}
                    onClick={() => {
                      onIndexChange(index);
                      setZoom(1);
                    }}
                    className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                      isActive 
                        ? 'border-white ring-2 ring-white/50 scale-105' 
                        : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {fileIsImg && fileImageUrl ? (
                      <img
                        src={fileImageUrl}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
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


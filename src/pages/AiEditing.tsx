import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import {
  Sparkles,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Eye,
  Search,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  Home,
  Sun,
  Moon,
  Plus,
  RefreshCw,
  Grid3x3,
  Film,
  Pencil,
  Send,
  CheckCircle,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fotelloService, type EditingType, type EditingJob } from '@/services/fotelloService';
import { API_BASE_URL } from '@/config/env';
import { useAuth } from '@/components/auth/AuthProvider';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { FileUploader } from '@/components/media/FileUploader';

type ViewMode = 'list' | 'detail' | 'edit' | 'upload' | 'preferences';

interface ShootWithEditing {
  id: number;
  address: string;
  status: string;
  workflowStatus?: string;
  photo_count?: number;
  created_by?: string;
  created_at: string;
  thumbnail?: string;
  editing_jobs?: EditingJob[];
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
  bracketGroup?: number;
  isEdited?: boolean;
  // Processed paths
  thumbnail_path?: string;
  web_path?: string;
  placeholder_path?: string;
  // Watermarked paths
  watermarked_storage_path?: string;
  watermarked_thumbnail_path?: string;
  watermarked_web_path?: string;
  watermarked_placeholder_path?: string;
}

const AiEditing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedShoot, setSelectedShoot] = useState<ShootWithEditing | null>(null);
  const [shoots, setShoots] = useState<ShootWithEditing[]>([]);
  const [listings, setListings] = useState<ShootWithEditing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTypes, setEditingTypes] = useState<EditingType[]>([]);
  const [selectedEditingType, setSelectedEditingType] = useState<string>('enhance');
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [availableFiles, setAvailableFiles] = useState<MediaFile[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Editing panel state
  const [selectedStyle, setSelectedStyle] = useState<'signature' | 'natural' | 'twilight'>('signature');
  const [exposure, setExposure] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [temp, setTemp] = useState(0);
  const [tint, setTint] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [highlights, setHighlights] = useState(0);
  const [sharpening, setSharpening] = useState(0);
  const [aspectRatio, setAspectRatio] = useState('original');
  const [autoPerspective, setAutoPerspective] = useState(true);
  const [skyReplacement, setSkyReplacement] = useState(true);
  const [viewModeOption, setViewModeOption] = useState<'carousel' | 'filmstrip'>('carousel');
  const [bracketingMethod, setBracketingMethod] = useState<'time' | 'count' | 'manual'>('time');
  const [bracketingTime, setBracketingTime] = useState(2);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [isPhotographer, setIsPhotographer] = useState(false);
  
  // Modal states
  const [showEditConfigModal, setShowEditConfigModal] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [pendingShoot, setPendingShoot] = useState<ShootWithEditing | null>(null);
  const [editConfigParams, setEditConfigParams] = useState<Record<string, any>>({});
  const [autoEditEnabled, setAutoEditEnabled] = useState(false);
  
  // Bracketed image grouping
  const [groupedFiles, setGroupedFiles] = useState<{ group: number; files: MediaFile[] }[]>([]);

  // Load shoots and editing types
  useEffect(() => {
    loadShoots();
    loadEditingTypes();
    loadListings();
    if (user) {
      setIsAdmin(user.role === 'admin' || user.role === 'superadmin');
      setIsEditor(user.role === 'editor');
      setIsPhotographer(user.role === 'photographer');
    }
  }, [user]);

  // Load files when shoot is selected
  useEffect(() => {
    if (selectedShoot) {
      loadShootFiles(selectedShoot.id);
    } else {
      setAvailableFiles([]);
      setSelectedFiles(new Set());
      setCurrentImageIndex(0);
      setGroupedFiles([]);
    }
  }, [selectedShoot]);

  // Group files by brackets (every 5 images or by time)
  useEffect(() => {
    if (availableFiles.length > 0) {
      groupFilesByBrackets();
    }
  }, [availableFiles, bracketingMethod, bracketingTime]);

  // Helper function to get image URL with proper fallback
  const getImageUrl = useCallback((file: MediaFile, size: 'thumb' | 'medium' | 'large' | 'original' = 'medium'): string => {
    const baseUrl = API_BASE_URL;
    
    const resolveUrl = (value: string): string => {
      if (/^https?:\/\//i.test(value)) return value;
      if (value.startsWith('/')) return `${baseUrl}${value}`;
      return `${baseUrl}/${value}`;
    };
    
    // Try size-specific URL first
    const sizeMap: Record<string, keyof MediaFile> = {
      thumb: 'thumb_url',
      medium: 'medium_url',
      large: 'large_url',
      original: 'original_url',
    };
    
    const sizeKey = sizeMap[size];
    const sizeUrl = file[sizeKey as keyof MediaFile] as string | undefined;
    
    if (sizeUrl) {
      return resolveUrl(sizeUrl);
    }
    
    // Avoid loading originals for thumbnails/medium previews
    if (size === 'thumb') {
      // Use placeholder if available, otherwise return empty
      if (file.placeholder_path) return resolveUrl(file.placeholder_path);
      return '';
    }
    
    if (size === 'medium') {
      // Use thumb if available, otherwise return empty
      if (file.thumb_url) return resolveUrl(file.thumb_url);
      return '';
    }
    
    if (size === 'large' && file.medium_url) {
      return resolveUrl(file.medium_url);
    }
    
    // Only allow original fallback for large/original sizes
    const allowOriginalFallback = size === 'large' || size === 'original';
    if (!allowOriginalFallback) {
      return '';
    }
    
    // Fallback to original
    if (file.original_url) {
      return resolveUrl(file.original_url);
    }
    
    // Final fallback
    if (file.url) {
      return resolveUrl(file.url);
    }
    
    if (file.path) {
      const clean = file.path.replace(/^\/+/, '');
      return `${baseUrl}/${clean}`;
    }
    
    return '';
  }, []);

  const loadShoots = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/shoots`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const shootsData = (data.data || data || []).map((shoot: any) => ({
          id: shoot.id,
          address: shoot.address || `Shoot #${shoot.id}`,
          status: shoot.status || 'pending',
          workflowStatus: shoot.workflowStatus || shoot.workflow_status || shoot.status,
          photo_count: shoot.photo_count || shoot.files?.length || 0,
          created_by: shoot.created_by || shoot.user?.name || 'Unknown',
          created_at: shoot.created_at || shoot.createdAt || new Date().toISOString(),
          thumbnail: shoot.thumbnail || shoot.cover_image || null,
          auto_edit_enabled: shoot.auto_edit_enabled || false,
        }));
        setShoots(shootsData);
      } else if (response.status === 401) {
        toast({
          title: 'Authentication Error',
          description: 'Please log in again',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load shoots:', error);
      toast({
        title: 'Error',
        description: 'Failed to load shoots. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      // Listings are empty by default
      setListings([]);
    } catch (error) {
      console.error('Failed to load listings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load listings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadShootFiles = async (shootId: number) => {
    setLoadingFiles(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const files = (data.data || data || []).filter((f: any) => {
          const name = (f.filename || '').toLowerCase();
          return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(name);
        }).map((f: any) => ({
          id: f.id,
          filename: f.filename || `file-${f.id}`,
          url: f.url,
          path: f.path,
          thumb_url: f.thumb_url || f.thumb,
          medium_url: f.medium_url || f.medium,
          large_url: f.large_url || f.large,
          original_url: f.original_url || f.original,
          fileType: f.fileType || f.file_type,
          workflowStage: f.workflow_stage || f.workflowStage,
          created_at: f.created_at || f.createdAt,
          isEdited: f.workflow_stage === 'completed' || f.workflow_stage === 'edited' || f.workflowStage === 'completed',
        }));
        setAvailableFiles(files);
        if (files.length > 0 && currentImageIndex >= files.length) {
          setCurrentImageIndex(0);
        }
      } else if (response.status === 404) {
        setAvailableFiles([]);
        toast({
          title: 'No Files',
          description: 'This shoot has no image files',
          variant: 'default',
        });
      } else if (response.status === 401) {
        toast({
          title: 'Authentication Error',
          description: 'Please log in again',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load shoot files',
        variant: 'destructive',
      });
      setAvailableFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadEditingTypes = async () => {
    try {
      const types = await fotelloService.getEditingTypes();
      setEditingTypes(types);
      if (types.length > 0 && !selectedEditingType) {
        setSelectedEditingType(types[0].id);
      }
    } catch (error) {
      console.error('Failed to load editing types:', error);
      toast({
        title: 'Warning',
        description: 'Failed to load editing types. Using defaults.',
        variant: 'default',
      });
    }
  };

  // Group files by brackets (one per 5 images or by time)
  // Only group if shoot hasn't been edited yet (no edited files exist)
  const groupFilesByBrackets = useCallback(() => {
    if (availableFiles.length === 0) {
      setGroupedFiles([]);
      return;
    }

    const rawFiles = availableFiles.filter(f => !f.isEdited);
    const hasEditedFiles = availableFiles.some(f => f.isEdited);
    
    // Only show grouped view if there are no edited files (shoot not yet edited)
    // Once edited, show all files normally
    if (hasEditedFiles) {
      setGroupedFiles([]);
      return;
    }

    if (bracketingMethod === 'count') {
      // Group every 5 images (like Fotello - one stacked image per 5 images)
      const groups: { group: number; files: MediaFile[] }[] = [];
      for (let i = 0; i < rawFiles.length; i += 5) {
        const groupFiles = rawFiles.slice(i, i + 5);
        if (groupFiles.length > 0) {
          groups.push({
            group: Math.floor(i / 5) + 1,
            files: groupFiles,
          });
        }
      }
      setGroupedFiles(groups);
    } else if (bracketingMethod === 'time') {
      // Group by time (within bracketingTime seconds)
      const groups: { group: number; files: MediaFile[] }[] = [];
      let currentGroup: MediaFile[] = [];
      let currentGroupNum = 1;
      let lastTime: Date | null = null;

      rawFiles.forEach((file, index) => {
        const fileTime = file.created_at ? new Date(file.created_at) : new Date();
        
        if (lastTime === null) {
          lastTime = fileTime;
          currentGroup = [file];
        } else {
          const timeDiff = Math.abs(fileTime.getTime() - lastTime.getTime()) / 1000;
          if (timeDiff <= bracketingTime) {
            currentGroup.push(file);
          } else {
            if (currentGroup.length > 0) {
              groups.push({ group: currentGroupNum++, files: currentGroup });
            }
            currentGroup = [file];
            lastTime = fileTime;
          }
        }
      });

      if (currentGroup.length > 0) {
        groups.push({ group: currentGroupNum, files: currentGroup });
      }
      setGroupedFiles(groups);
    } else {
      // Manual - show all files individually
      setGroupedFiles(rawFiles.map((file, index) => ({ group: index + 1, files: [file] })));
    }
  }, [availableFiles, bracketingMethod, bracketingTime]);

  const handleShootSelect = (shoot: ShootWithEditing) => {
    // Check if shoot has photos
    if (shoot.photo_count === 0 || shoot.photo_count === undefined) {
      // Show modal for shoots without photos (admin can enable auto-edit)
      if (isAdmin) {
        setPendingShoot(shoot);
        setShowEditConfigModal(true);
        return;
      } else {
        toast({
          title: 'No Photos',
          description: 'This shoot has no photos uploaded yet',
          variant: 'default',
        });
        return;
      }
    }
    
    // For shoots with photos, show edit config modal first
    setPendingShoot(shoot);
    setShowEditConfigModal(true);
  };

  const handleConfirmEditConfig = () => {
    if (!pendingShoot) return;

    // If auto-edit is enabled and shoot has no photos, save that setting
    if (autoEditEnabled && (pendingShoot.photo_count === 0 || pendingShoot.photo_count === undefined)) {
      handleEnableAutoEdit(pendingShoot.id);
    }

    // Proceed to detail view
    setSelectedShoot(pendingShoot);
    setViewMode('detail');
    setSelectedFiles(new Set());
    setCurrentImageIndex(0);
    setShowEditConfigModal(false);
    setPendingShoot(null);
  };

  const handleEnableAutoEdit = async (shootId: number) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ 
          auto_edit_enabled: true,
          auto_edit_preferences: {
            editing_type: selectedEditingType,
            style: selectedStyle,
            auto_perspective: autoPerspective,
            sky_replacement: skyReplacement,
            ...editConfigParams,
          },
        }),
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Auto-edit enabled for this shoot',
        });
        await loadShoots();
      }
    } catch (error) {
      console.error('Failed to enable auto-edit:', error);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedShoot(null);
    setSelectedFiles(new Set());
    setCurrentImageIndex(0);
  };

  const handleNewEdit = () => {
    setViewMode('upload');
    setSelectedShoot(null);
    setSelectedFiles(new Set());
  };

  const handleEditImage = () => {
    if (selectedFiles.size > 0) {
      setViewMode('edit');
    } else {
      toast({
        title: 'No Selection',
        description: 'Please select at least one image to edit',
        variant: 'default',
      });
    }
  };

  const handleOpenPreferences = () => {
    setViewMode('preferences');
  };

  const handleFileToggle = (fileId: number) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSendToEditing = async () => {
    if (!selectedShoot) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${selectedShoot.id}/send-to-editing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Shoot sent to editing',
        });
        await loadShoots();
        if (selectedShoot) {
          setSelectedShoot({ ...selectedShoot, status: 'editing' });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send to editing');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send to editing',
        variant: 'destructive',
      });
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedShoot) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${selectedShoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Shoot marked as complete',
        });
        await loadShoots();
        if (selectedShoot) {
          setSelectedShoot({ ...selectedShoot, status: 'completed' });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to mark complete');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark complete',
        variant: 'destructive',
      });
    }
  };

  const handleDeliver = async () => {
    if (!selectedShoot) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${selectedShoot.id}/deliver`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Shoot delivered successfully',
        });
        await loadShoots();
        if (selectedShoot) {
          setSelectedShoot({ ...selectedShoot, workflowStatus: 'delivered' });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to deliver');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deliver shoot',
        variant: 'destructive',
      });
    }
  };

  const handleAddMorePhotos = () => {
    setShowUploadSection(!showUploadSection);
  };

  const handleEnhanceListing = () => {
    if (availableFiles.length === 0) {
      toast({
        title: 'No Photos',
        description: 'Please upload photos first',
        variant: 'default',
      });
      return;
    }
    // Select all files and open edit view
    const allFileIds = new Set(availableFiles.map(f => f.id));
    setSelectedFiles(allFileIds);
    setViewMode('edit');
  };

  const handleApplyEdit = async () => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select images to edit',
        variant: 'default',
      });
      return;
    }

    if (!selectedShoot) return;

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/fotello/edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          shoot_id: selectedShoot.id,
          file_ids: Array.from(selectedFiles),
          editing_type: selectedEditingType,
          params: {
            style: selectedStyle,
            exposure,
            contrast,
            temp,
            tint,
            saturation,
            highlights,
            sharpening,
            aspect_ratio: aspectRatio,
            auto_perspective: autoPerspective,
            sky_replacement: skyReplacement,
            ...editConfigParams,
          },
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Editing job submitted successfully',
        });
        setViewMode('detail');
        setSelectedFiles(new Set());
        await loadShootFiles(selectedShoot.id);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit editing job');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply edits',
        variant: 'destructive',
      });
    }
  };

  const filteredListings = listings.filter(listing =>
    listing.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredShoots = shoots.filter(shoot =>
    shoot.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (shoot: ShootWithEditing) => {
    // Determine status based on workflowStatus first, then status
    const workflowStatus = shoot.workflowStatus?.toLowerCase() || shoot.status?.toLowerCase() || 'pending';
    
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; icon?: any }> = {
      scheduled: { label: 'Scheduled', variant: 'secondary', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
      booked: { label: 'Scheduled', variant: 'secondary', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
      completed: { label: 'Completed', variant: 'default', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
      edited: { label: 'Edited', variant: 'default', className: 'bg-purple-100 text-purple-800 border-purple-200', icon: Sparkles },
      editing: { label: 'Editing', variant: 'default', className: 'bg-purple-100 text-purple-800 border-purple-200', icon: Sparkles },
      delivered: { label: 'Delivered', variant: 'default', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
      pending: { label: 'Pending', variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
      processing: { label: 'Processing', variant: 'default', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Loader2 },
      failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
      'admin_verified': { label: 'Completed', variant: 'default', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
      'photos_uploaded': { label: 'Completed', variant: 'default', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    };
    
    const config = statusConfig[workflowStatus] || statusConfig.pending;
    const Icon = config.icon || Clock;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // List View
  const renderListView = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{filteredListings.length} listings</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button onClick={handleNewEdit} className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Listing
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Photos</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredListings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1">No listings yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Get started by creating your first listing
                        </p>
                        <Button onClick={handleNewEdit} className="bg-primary hover:bg-primary/90 text-white">
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Listing
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredListings.map((listing) => {
                  const imageUrl = listing.thumbnail 
                    ? (listing.thumbnail.startsWith('http') ? listing.thumbnail : `${API_BASE_URL}/${listing.thumbnail.replace(/^\//, '')}`)
                    : null;
                  return (
                    <TableRow
                      key={listing.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleShootSelect(listing)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={listing.address}
                              className="w-12 h-12 object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{listing.address}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(listing)}</TableCell>
                      <TableCell>{listing.photo_count || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary text-xs font-semibold">
                              {listing.created_by?.charAt(0).toUpperCase() || 'C'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {listing.created_at ? format(new Date(listing.created_at), 'MMM d, yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  // Detail View
  const renderDetailView = () => {
    if (!selectedShoot) {
      handleBackToList();
      return null;
    }

    return (
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <Home className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
          <span>/</span>
          <span>Listings</span>
          <span>/</span>
          <span className="text-foreground">{selectedShoot.address}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-muted-foreground" />
                <h1 className="text-2xl font-semibold">{selectedShoot.address}</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleSendToEditing}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Editing
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleMarkComplete}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              </>
            )}
            <Button 
              className="bg-primary hover:bg-primary/90 text-white" 
              size="sm"
              onClick={handleDeliver}
            >
              <Send className="h-4 w-4 mr-2" />
              Deliver
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="photos" className="w-full">
          <TabsList>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>
          <TabsContent value="photos" className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {loadingFiles ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  `${availableFiles.length} Photos`
                )}
              </span>
              <div className="flex items-center gap-2">
                <Select defaultValue="mls">
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mls">Export for MLS</SelectItem>
                  </SelectContent>
                </Select>
                {selectedFiles.size > 0 && (
                  <Button onClick={handleEditImage} className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Edit ({selectedFiles.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Image Grid */}
            {loadingFiles ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : availableFiles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No photos available for this listing</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Check if shoot has been edited - if yes, show edited images separately */}
                {availableFiles.some(f => f.isEdited) ? (
                  <>
                    {/* Edited Images Section - Show first if any exist */}
                    {availableFiles.filter(f => f.isEdited).length > 0 && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            Edited Photos ({availableFiles.filter(f => f.isEdited).length})
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {availableFiles.filter(f => f.isEdited).map((file, index) => {
                              const imageUrl = getImageUrl(file, 'medium');
                              const isSelected = selectedFiles.has(file.id);
                              const fileIndex = availableFiles.findIndex(f => f.id === file.id);

                              return (
                                <div
                                  key={file.id}
                                  className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                    isSelected
                                      ? 'border-purple-500 ring-2 ring-purple-200'
                                      : 'border-green-500 hover:border-green-600'
                                  }`}
                                  onClick={() => {
                                    if (fileIndex >= 0) {
                                      setCurrentImageIndex(fileIndex);
                                      handleFileToggle(file.id);
                                    }
                                  }}
                                >
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={file.filename}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Edited
                                  </div>
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Raw Images (if any remain unedited) */}
                    {availableFiles.filter(f => !f.isEdited).length > 0 && (
                      <div className="space-y-4 mt-6">
                        <div>
                          <h3 className="text-sm font-medium mb-2">Raw Photos ({availableFiles.filter(f => !f.isEdited).length})</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {availableFiles.filter(f => !f.isEdited).map((file, index) => {
                              const imageUrl = getImageUrl(file, 'medium');
                              const isSelected = selectedFiles.has(file.id);
                              const fileIndex = availableFiles.findIndex(f => f.id === file.id);

                              return (
                                <div
                                  key={file.id}
                                  className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                    isSelected
                                      ? 'border-purple-500 ring-2 ring-purple-200'
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                  onClick={() => {
                                    if (fileIndex >= 0) {
                                      setCurrentImageIndex(fileIndex);
                                      handleFileToggle(file.id);
                                    }
                                  }}
                                >
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={file.filename}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                  )}
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Show grouped brackets for unedited shoots (like Fotello - one per 5 images) */
                  groupedFiles.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Raw Photos (Grouped by Brackets)</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                          Showing one representative image per bracket group. Each group contains up to 5 images.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                          {groupedFiles.map((group, groupIndex) => {
                            // Show only the first image of each bracket group (stacked representation)
                            const representativeFile = group.files[0];
                            const imageUrl = getImageUrl(representativeFile, 'medium');
                            const isSelected = selectedFiles.has(representativeFile.id);
                            const fileIndex = availableFiles.findIndex(f => f.id === representativeFile.id);

                            return (
                              <div
                                key={`group-${group.group}`}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-purple-500 ring-2 ring-purple-200'
                                    : 'border-border hover:border-primary/50'
                                }`}
                                onClick={() => {
                                  if (fileIndex >= 0) {
                                    setCurrentImageIndex(fileIndex);
                                    handleFileToggle(representativeFile.id);
                                  }
                                }}
                              >
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={representativeFile.filename}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                                {group.files.length > 1 && (
                                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                    <Grid3x3 className="h-3 w-3" />
                                    {group.files.length} images
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                                  Bracket {group.group}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Fallback: Show all files individually if no grouping */
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {availableFiles.map((file, index) => {
                        const imageUrl = getImageUrl(file, 'medium');
                        const isSelected = selectedFiles.has(file.id);
                        const fileIndex = availableFiles.findIndex(f => f.id === file.id);

                        return (
                          <div
                            key={file.id}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-purple-500 ring-2 ring-purple-200'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => {
                              if (fileIndex >= 0) {
                                setCurrentImageIndex(fileIndex);
                                handleFileToggle(file.id);
                              }
                            }}
                          >
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={file.filename}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                              {selectedShoot.address}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Upload Photos Section */}
        {showUploadSection && selectedShoot && (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Upload Photos</h3>
                  <p className="text-sm text-muted-foreground">
                    Photo upload functionality will be implemented here
                  </p>
                </div>
                {selectedShoot && (
                  <FileUploader
                    shootId={selectedShoot.id.toString()}
                    onUploadComplete={(files, notes) => {
                      toast({
                        title: 'Upload Complete',
                        description: `${files.length} file(s) uploaded successfully`,
                      });
                      // Reload shoot files after upload
                      if (selectedShoot) {
                        loadShootFiles(selectedShoot.id);
                      }
                      setShowUploadSection(false);
                    }}
                    expectedPhotoCount={(selectedShoot as any)?.expectedFinalCount || (selectedShoot as any)?.package?.expectedDeliveredCount || selectedShoot?.photo_count || 0}
                    bracketMode={(selectedShoot as any)?.bracketMode || (selectedShoot as any)?.package?.bracketMode || null}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" onClick={handleOpenPreferences}>
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={handleAddMorePhotos}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add More Photos
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={handleEnhanceListing}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Enhance Listing
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Edit View (Adjust Panel)
  const renderEditView = () => {
    if (!selectedShoot || availableFiles.length === 0) {
      if (!selectedShoot) {
        handleBackToList();
      } else {
        setViewMode('detail');
      }
      return null;
    }

    const currentFile = availableFiles[currentImageIndex];
    if (!currentFile) {
      setCurrentImageIndex(0);
      return null;
    }

    const imageUrl = getImageUrl(currentFile, 'large');

    return (
      <div className="flex h-[calc(100vh-200px)] gap-4">
        {/* Main Image Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-muted rounded-lg overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={currentFile.filename}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
          {/* Image Carousel */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
            {availableFiles.map((file, index) => {
              const fileImageUrl = getImageUrl(file, 'thumb');
              const isSelected = index === currentImageIndex;

              return (
                <div
                  key={file.id}
                  className={`relative w-20 h-20 rounded overflow-hidden border-2 cursor-pointer flex-shrink-0 ${
                    isSelected ? 'border-blue-500' : 'border-border'
                  }`}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  {fileImageUrl ? (
                    <img
                      src={fileImageUrl}
                      alt={file.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Adjust Panel */}
        <div className="w-80 border-l pl-4 overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Adjust</h3>
              <Button variant="ghost" size="sm" onClick={() => setViewMode('detail')}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* FOTON 6.0 STYLES */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">FOTON 6.0 STYLES</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={selectedStyle === 'signature' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStyle('signature')}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                >
                  <Home className="h-5 w-5" />
                  <span className="text-xs">Signature</span>
                </Button>
                <Button
                  variant={selectedStyle === 'natural' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStyle('natural')}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                >
                  <Sun className="h-5 w-5" />
                  <span className="text-xs">Natural</span>
                </Button>
                <Button
                  variant={selectedStyle === 'twilight' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStyle('twilight')}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                >
                  <Moon className="h-5 w-5" />
                  <span className="text-xs">Twilight</span>
                  <Badge variant="secondary" className="text-xs mt-1">14 DAYS FREE</Badge>
                </Button>
              </div>
            </div>

            {/* MY PROFILES */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">MY PROFILES</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
                <Button variant="ghost" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative aspect-video rounded border overflow-hidden">
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded p-0.5">
                    <Pencil className="h-3 w-3" />
                  </div>
                </div>
                <div className="relative aspect-video rounded border overflow-hidden">
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded p-0.5">
                    <Pencil className="h-3 w-3" />
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Apply to all
              </Button>
            </div>

            {/* BASIC */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">BASIC</Label>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Exposure</Label>
                    <span className="text-sm text-muted-foreground">{exposure}</span>
                  </div>
                  <Slider
                    value={[exposure]}
                    onValueChange={(value) => setExposure(value[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Contrast</Label>
                    <span className="text-sm text-muted-foreground">{contrast}</span>
                  </div>
                  <Slider
                    value={[contrast]}
                    onValueChange={(value) => setContrast(value[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            </div>

            {/* COLOR */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">COLOR</Label>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Temp</Label>
                    <span className="text-sm text-muted-foreground">{temp}</span>
                  </div>
                  <Slider
                    value={[temp]}
                    onValueChange={(value) => setTemp(value[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Tint</Label>
                    <span className="text-sm text-muted-foreground">{tint}</span>
                  </div>
                  <Slider
                    value={[tint]}
                    onValueChange={(value) => setTint(value[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Saturation</Label>
                    <span className="text-sm text-muted-foreground">{saturation}</span>
                  </div>
                  <Slider
                    value={[saturation]}
                    onValueChange={(value) => setSaturation(value[0])}
                    min={-100}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            </div>

            {/* TONE */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">TONE</Label>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Highlights</Label>
                  <span className="text-sm text-muted-foreground">{highlights}</span>
                </div>
                <Slider
                  value={[highlights]}
                  onValueChange={(value) => setHighlights(value[0])}
                  min={-100}
                  max={100}
                  step={1}
                />
              </div>
            </div>

            {/* DETAIL */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">DETAIL</Label>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Sharpening</Label>
                  <span className="text-sm text-muted-foreground">{sharpening}</span>
                </div>
                <Slider
                  value={[sharpening]}
                  onValueChange={(value) => setSharpening(value[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>

            {/* ASPECT RATIO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">ASPECT RATIO</Label>
                <Grid3x3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['original', 'freeform', '3:2', '4:3', '16:9'].map((ratio) => (
                  <Button
                    key={ratio}
                    variant={aspectRatio === ratio ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAspectRatio(ratio)}
                    className="aspect-square"
                  >
                    {ratio === 'original' && <ImageIcon className="h-4 w-4" />}
                    {ratio === 'freeform' && <Grid3x3 className="h-4 w-4" />}
                    {ratio !== 'original' && ratio !== 'freeform' && (
                      <span className="text-xs">{ratio}</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* OPTIONS */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">OPTIONS</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Auto Perspective Correction</Label>
                  <Switch
                    checked={autoPerspective}
                    onCheckedChange={setAutoPerspective}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Sky Replacement</Label>
                  <Switch
                    checked={skyReplacement}
                    onCheckedChange={setSkyReplacement}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setViewMode('detail')}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
                onClick={handleApplyEdit}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Upload View
  const renderUploadView = () => (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => setViewMode('list')}>
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
        <span>/</span>
        <span>Listings</span>
        <span>/</span>
        <span className="text-foreground">New Listing</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Select a Shoot</h2>
          <p className="text-muted-foreground">Choose an existing shoot to create a new listing for AI editing</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shoots..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {/* Shoots Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredShoots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No shoots found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try adjusting your search terms' : 'No shoots available to create listings from'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShoots.map((shoot) => {
            const imageUrl = shoot.thumbnail 
              ? (shoot.thumbnail.startsWith('http') ? shoot.thumbnail : `${API_BASE_URL}/${shoot.thumbnail.replace(/^\//, '')}`)
              : null;
            return (
              <Card
                key={shoot.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  handleShootSelect(shoot);
                }}
              >
                <CardContent className="p-0">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={shoot.address}
                      className="w-full h-48 object-cover rounded-t-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted rounded-t-lg flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold truncate">{shoot.address}</h3>
                      {getStatusBadge(shoot)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{shoot.photo_count || 0} photos</span>
                      <span>{shoot.created_at ? format(new Date(shoot.created_at), 'MMM d, yyyy') : '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // Preferences View
  const renderPreferencesView = () => {
    if (!selectedShoot) {
      setViewMode('detail');
      return null;
    }

    return (
      <div className="flex h-[calc(100vh-200px)] gap-4">
        {/* Main Content */}
        <div className="flex-1">
          {availableFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{selectedShoot.address}</h2>
                <Button variant="ghost" size="sm" onClick={() => setViewMode('detail')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">{availableFiles.length} Photos</div>
              {currentImageIndex < availableFiles.length && (
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={getImageUrl(availableFiles[currentImageIndex], 'large')}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                    }}
                  />
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {currentImageIndex + 1}/{availableFiles.length}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preferences Panel */}
        <div className="w-80 border-l pl-4 overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preferences</h3>
              <Button variant="ghost" size="sm" onClick={() => setViewMode('detail')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Bracketing Method */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Bracketing Method</Label>
              <RadioGroup value={bracketingMethod} onValueChange={(v) => setBracketingMethod(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="time" id="time" />
                  <Label htmlFor="time" className="font-normal cursor-pointer">Time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="count" id="count" />
                  <Label htmlFor="count" className="font-normal cursor-pointer"># Count</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal cursor-pointer">Manual</Label>
                </div>
              </RadioGroup>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Time (seconds)</Label>
                  <span className="text-sm text-muted-foreground">{bracketingTime}s</span>
                </div>
                <Slider
                  value={[bracketingTime]}
                  onValueChange={(value) => setBracketingTime(value[0])}
                  min={1}
                  max={10}
                  step={1}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Group photos taken within <strong>{bracketingTime} seconds</strong> of each other
                </p>
              </div>
            </div>

            {/* View Mode */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">View Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={viewModeOption === 'carousel' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewModeOption('carousel')}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Grid3x3 className="h-5 w-5" />
                  <span className="text-xs">Carousel</span>
                </Button>
                <Button
                  variant={viewModeOption === 'filmstrip' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewModeOption('filmstrip')}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Film className="h-5 w-5" />
                  <span className="text-xs">Filmstrip</span>
                </Button>
              </div>
            </div>

            {/* Enhancement Preferences */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Enhancement Preferences</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Perspective Correction</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={autoPerspective ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAutoPerspective(true)}
                    >
                      On
                    </Button>
                    <Button
                      variant={!autoPerspective ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAutoPerspective(false)}
                    >
                      Off
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Exterior Sky Replacement</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={skyReplacement ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSkyReplacement(true)}
                    >
                      On
                    </Button>
                    <Button
                      variant={!skyReplacement ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSkyReplacement(false)}
                    >
                      Off
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Enhancement Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative aspect-video rounded border overflow-hidden">
                      <div className="absolute inset-0 bg-muted" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                        Signature
                      </div>
                    </div>
                    <div className="relative aspect-video rounded border overflow-hidden">
                      <div className="absolute inset-0 bg-muted" />
                      <div className="absolute bottom-0 left-0 bg-black/50 text-white text-xs p-1 text-center">
                        Natural
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 p-6">
          {viewMode === 'list' && (
            <>
              <PageHeader
                badge="AI Editing"
                title="AI Photo Editing"
                description="Enhance your photos with AI-powered editing tools"
              />
              {renderListView()}
            </>
          )}
          {viewMode === 'detail' && renderDetailView()}
          {viewMode === 'edit' && renderEditView()}
          {viewMode === 'upload' && renderUploadView()}
          {viewMode === 'preferences' && renderPreferencesView()}

          {/* Edit Configuration Modal */}
          <Dialog open={showEditConfigModal} onOpenChange={setShowEditConfigModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configure AI Editing</DialogTitle>
                <DialogDescription>
                  {pendingShoot?.photo_count === 0 || pendingShoot?.photo_count === undefined
                    ? 'This shoot has no photos yet. Enable auto-edit to automatically process photos when they are uploaded.'
                    : 'Select editing options for this shoot'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Auto-edit option (only for shoots without photos and admin) */}
                {(pendingShoot?.photo_count === 0 || pendingShoot?.photo_count === undefined) && isAdmin && (
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <Checkbox
                      id="auto-edit"
                      checked={autoEditEnabled}
                      onCheckedChange={(checked) => setAutoEditEnabled(checked === true)}
                    />
                    <Label htmlFor="auto-edit" className="flex-1 cursor-pointer">
                      <div className="font-medium">Enable Auto-Edit</div>
                      <div className="text-sm text-muted-foreground">
                        Automatically edit photos when uploaded using preset preferences
                      </div>
                    </Label>
                  </div>
                )}

                {/* Editing Type Selection */}
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
                </div>

                {/* Style Selection */}
                <div className="space-y-2">
                  <Label>Enhancement Style</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={selectedStyle === 'signature' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedStyle('signature')}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Home className="h-5 w-5" />
                      <span className="text-xs">Signature</span>
                    </Button>
                    <Button
                      variant={selectedStyle === 'natural' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedStyle('natural')}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Sun className="h-5 w-5" />
                      <span className="text-xs">Natural</span>
                    </Button>
                    <Button
                      variant={selectedStyle === 'twilight' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedStyle('twilight')}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Moon className="h-5 w-5" />
                      <span className="text-xs">Twilight</span>
                    </Button>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <Label>Options</Label>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-perspective" className="font-normal">Auto Perspective Correction</Label>
                    <Switch
                      id="auto-perspective"
                      checked={autoPerspective}
                      onCheckedChange={setAutoPerspective}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sky-replacement" className="font-normal">Sky Replacement</Label>
                    <Switch
                      id="sky-replacement"
                      checked={skyReplacement}
                      onCheckedChange={setSkyReplacement}
                    />
                  </div>
                </div>

                {/* Additional Parameters */}
                <div className="space-y-2">
                  <Label>Additional Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any specific editing requirements..."
                    className="min-h-[100px]"
                    value={editConfigParams.notes || ''}
                    onChange={(e) => setEditConfigParams({ ...editConfigParams, notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowEditConfigModal(false);
                  setPendingShoot(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmEditConfig} className="bg-primary hover:bg-primary/90 text-white">
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default AiEditing;

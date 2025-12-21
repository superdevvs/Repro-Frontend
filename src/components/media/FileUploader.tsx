import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertCircleIcon, 
  ArrowUpIcon, 
  CheckCircleIcon, 
  FileIcon, 
  FolderIcon, 
  ImageIcon, 
  FilmIcon, 
  XIcon, 
  UploadCloudIcon,
  CloudIcon,
  PlusIcon,
  BoxIcon,
  MonitorIcon,
  SaveIcon,
  SendIcon,
  AlertTriangleIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useShoots } from '@/context/ShootsContext';
import axios from 'axios';
import { Dropbox } from 'dropbox';
import { API_BASE_URL } from '@/config/env';


// Add these interfaces at the top of your component file
interface DropboxFile {
  id: string;
  name: string;
  size: number;
  path_display: string;
  client_modified: string;
  content_hash?: string;
}

interface DropboxAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  isConnecting: boolean;
}

interface FileUploaderProps {
  shootId?: string;
  onUploadComplete?: (files: File[], notes: string) => void;
  allowedFileTypes?: string[];
  className?: string;
  initialNotes?: string;
  expectedPhotoCount?: number;
  bracketMode?: 3 | 5 | null;
}

export function FileUploader({
  shootId,
  onUploadComplete,
  allowedFileTypes = [
    'image/jpeg', 'image/png', 'image/tiff', 
    'video/mp4', 'video/quicktime',
    'application/zip', 'application/x-zip-compressed'
  ],
  className,
  initialNotes = '',
  expectedPhotoCount = 0,
  bracketMode = null
}: FileUploaderProps) {
  const { toast } = useToast();
  const { updateShoot } = useShoots();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Add these state variables to your component
const [dropboxAuth, setDropboxAuth] = useState<DropboxAuthState>({
  isAuthenticated: false,
  accessToken: localStorage.getItem('dropbox_access_token'),
  isConnecting: false
});
const [dropboxFiles, setDropboxFiles] = useState<DropboxFile[]>([]);
const [selectedDropboxFiles, setSelectedDropboxFiles] = useState<Set<string>>(new Set());
const [loadingDropboxFiles, setLoadingDropboxFiles] = useState(false);

// Initialize Dropbox client
const dropboxClient = useMemo(() => {
  if (dropboxAuth.accessToken) {
    return new Dropbox({ 
      accessToken: dropboxAuth.accessToken,
      fetch: fetch
    });
  }
  return null;
}, [dropboxAuth.accessToken]);

// Dropbox authentication flow
const connectDropbox = async () => {
  setDropboxAuth(prev => ({ ...prev, isConnecting: true }));
  
  try {
    // Fetch Dropbox config from backend
    let APP_KEY = import.meta.env.VITE_APP_DROPBOX_APP_KEY;
    
    if (!APP_KEY) {
      try {
        const configResponse = await axios.get(`${API_BASE_URL}/api/dropbox/config`);
        if (configResponse.data?.success && configResponse.data?.config?.client_id) {
          APP_KEY = configResponse.data.config.client_id;
        } else {
          // Fallback to backend default if API doesn't return it
          APP_KEY = 'wzdzujsjj1iaaiv';
        }
      } catch (error) {
        console.warn('Failed to fetch Dropbox config from backend, using fallback:', error);
        // Fallback to backend default client_id from config
        APP_KEY = 'wzdzujsjj1iaaiv';
      }
    }
    
    if (!APP_KEY || APP_KEY === 'your_dropbox_app_key') {
      throw new Error('Dropbox Client ID is not configured. Please set VITE_APP_DROPBOX_APP_KEY in your environment or configure DROPBOX_CLIENT_ID in the backend.');
    }
    
    const REDIRECT_URI = `${window.location.origin}/dropbox-callback`;
    
    console.log('Using redirect URI:', REDIRECT_URI); // Debug log
    
    // Create authorization URL
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    
    // Open popup window for authentication
    const popup = window.open(
      authUrl,
      'dropbox-auth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );
    
    // Listen for the callback
    const handleCallback = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'DROPBOX_AUTH_SUCCESS') {
        const { accessToken } = event.data;
        localStorage.setItem('dropbox_access_token', accessToken);
        setDropboxAuth({
          isAuthenticated: true,
          accessToken,
          isConnecting: false
        });
        popup?.close();
        loadDropboxFiles();
        
        toast({
          title: "Dropbox Connected",
          description: "Successfully connected to Dropbox. Loading your files...",
        });
      } else if (event.data.type === 'DROPBOX_AUTH_ERROR') {
        setDropboxAuth(prev => ({ ...prev, isConnecting: false }));
        toast({
          title: "Connection Failed",
          description: "Failed to connect to Dropbox. Please try again.",
          variant: "destructive"
        });
        popup?.close();
      }
    };
    
    window.addEventListener('message', handleCallback);
    
    // Clean up if popup is closed manually
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleCallback);
        setDropboxAuth(prev => ({ ...prev, isConnecting: false }));
      }
    }, 1000);
    
  } catch (error) {
    console.error('Dropbox connection error:', error);
    setDropboxAuth(prev => ({ ...prev, isConnecting: false }));
    toast({
      title: "Connection Error",
      description: "An error occurred while connecting to Dropbox.",
      variant: "destructive"
    });
  }
};

// Load files from Dropbox
const loadDropboxFiles = async () => {
  if (!dropboxClient) return;
  
  setLoadingDropboxFiles(true);
  
  try {
    const response = await dropboxClient.filesListFolder({
      path: '',
      recursive: true,
      include_media_info: false,
      include_deleted: false,
      include_has_explicit_shared_members: false
    });
    
    // Filter for supported file types
    const supportedFiles = response.result.entries
      .filter((entry: any) => entry['.tag'] === 'file')
      .filter((file: any) => {
        const extension = file.name.toLowerCase().split('.').pop();
        const supportedExtensions = [
          'jpg', 'jpeg', 'png', 'tiff', 'tif',
          'mp4', 'mov', 'avi',
          'zip', 'rar'
        ];
        return supportedExtensions.includes(extension || '');
      })
      .map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        path_display: file.path_display,
        client_modified: file.client_modified,
        content_hash: file.content_hash
      }));
    
    setDropboxFiles(supportedFiles);
    
  } catch (error) {
    console.error('Error loading Dropbox files:', error);
    toast({
      title: "Error Loading Files",
      description: "Failed to load files from Dropbox. Please try again.",
      variant: "destructive"
    });
  } finally {
    setLoadingDropboxFiles(false);
  }
};

// Toggle file selection
const toggleDropboxFileSelection = (fileId: string) => {
  setSelectedDropboxFiles(prev => {
    const newSet = new Set(prev);
    if (newSet.has(fileId)) {
      newSet.delete(fileId);
    } else {
      newSet.add(fileId);
    }
    return newSet;
  });
};

// Select all files
const selectAllDropboxFiles = () => {
  if (selectedDropboxFiles.size === dropboxFiles.length) {
    setSelectedDropboxFiles(new Set());
  } else {
    setSelectedDropboxFiles(new Set(dropboxFiles.map(f => f.id)));
  }
};

// Download selected files from Dropbox and add to upload queue
const addSelectedDropboxFiles = async () => {
  if (!dropboxClient || selectedDropboxFiles.size === 0) return;
  const selectedFiles = dropboxFiles.filter(f => selectedDropboxFiles.has(f.id));
  const downloadedFiles: File[] = [];
  try {
    for (const file of selectedFiles) {
      toast({
        title: "Downloading",
        description: `Downloading ${file.name} from Dropbox...`,
      });
      const response = await dropboxClient.filesDownload({ path: file.path_display });
      // Convert the downloaded data to a File object
      const blob = (response.result as any).fileBlob || (response.result as any).fileBinary;
      const downloadedFile = new File([blob], file.name, {
        type: getMimeType(file.name),
        lastModified: new Date(file.client_modified).getTime()
      });
      downloadedFiles.push(downloadedFile);
    }
    // Add downloaded files to the upload queue
    setFiles(prev => [...prev, ...downloadedFiles]);
    setSelectedDropboxFiles(new Set());
    toast({
      title: "Files Added",
      description: `${downloadedFiles.length} files downloaded from Dropbox and added to upload queue.`,
    });
  } catch (error) {
    console.error('Error downloading Dropbox files:', error);
    toast({
      title: "Download Error",
      description: "Failed to download some files from Dropbox.",
      variant: "destructive"
    });
  }
};

// Helper function to get MIME type from filename
const getMimeType = (filename: string): string => {
  const extension = filename.toLowerCase().split('.').pop();
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed'
  };
  return mimeTypes[extension || ''] || 'application/octet-stream';
};

// Disconnect from Dropbox
const disconnectDropbox = () => {
  localStorage.removeItem('dropbox_access_token');
  setDropboxAuth({
    isAuthenticated: false,
    accessToken: null,
    isConnecting: false
  });
  setDropboxFiles([]);
  setSelectedDropboxFiles(new Set());
  setUploadMethod('local');
  
  toast({
    title: "Disconnected",
    description: "Successfully disconnected from Dropbox.",
  });
};

// Check for existing auth token on component mount
useEffect(() => {
  const token = localStorage.getItem('dropbox_access_token');
  if (token) {
    setDropboxAuth({
      isAuthenticated: true,
      accessToken: token,
      isConnecting: false
    });
  }
}, []);

// Replace the existing connectDropbox function and Dropbox UI section with this updated version:

// Updated connectDropbox function
const connectDropboxUpdated = () => {
  if (dropboxAuth.isAuthenticated) {
    setUploadMethod('dropbox');
    if (dropboxFiles.length === 0) {
      loadDropboxFiles();
    }
  } else {
    connectDropbox();
  }
};
  
  // Determine initial upload type based on user role
  // Photographers see raw/unedited, editors see edited/final
  const initialUploadType = user?.role === 'editor' ? 'edited' : 'raw';
  const [uploadType, setUploadType] = useState<'raw' | 'edited'>(initialUploadType);
  
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState(initialNotes);
  const [notesChanged, setNotesChanged] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'local' | 'dropbox' | 'google'>('local');
  const [showMissingPhotosWarning, setShowMissingPhotosWarning] = useState(false);
  const [missingPhotosCount, setMissingPhotosCount] = useState(0);
  
  // Calculate expected file count based on photo count and bracket mode
  const expectedFileCount = useMemo(() => {
    if (!expectedPhotoCount || expectedPhotoCount <= 0) return 0;
    // For RAW uploads, multiply by bracket mode; for edited, just use photo count
    if (uploadType === 'raw' && bracketMode) {
      return expectedPhotoCount * bracketMode;
    }
    return expectedPhotoCount;
  }, [expectedPhotoCount, bracketMode, uploadType]);

  
// Load files when Dropbox is authenticated and selected
useEffect(() => {
  if (uploadMethod === 'dropbox' && dropboxAuth.isAuthenticated && dropboxFiles.length === 0) {
    loadDropboxFiles();
  }
}, [uploadMethod, dropboxAuth.isAuthenticated]);

  // Update notes from props if it changes
  useEffect(() => {
    if (initialNotes !== undefined && initialNotes !== notes && !notesChanged) {
      setNotes(initialNotes);
    }
  }, [initialNotes]);

  // Handle notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    setNotesChanged(true);
  };

  // Save notes to the shoot independently of upload (persists to Laravel API)
  const handleSaveNotes = async () => {
    if (!shootId) {
      toast({
        title: "Cannot save notes",
        description: "No shoot ID provided",
        variant: "destructive"
      });
      return;
    }

    try {
      // Determine which note field to update based on user role and current tab
      // Maps to backend fields: shoot_notes, company_notes, photographer_notes, editor_notes
      let field: 'shoot_notes' | 'company_notes' | 'photographer_notes' | 'editor_notes' = 'shoot_notes';
      if (user?.role === 'photographer') {
        field = 'photographer_notes';
      } else if (user?.role === 'editor') {
        field = 'editor_notes';
      } else if (user?.role === 'admin' || user?.role === 'superadmin') {
        field = uploadType === 'raw' ? 'photographer_notes' : 'editor_notes';
      } else {
        field = 'shoot_notes';
      }

      const payload: Record<string, string> = { [field]: notes || '' };
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to save notes');
      }

      toast({
        title: "Notes saved",
        description: "Your upload notes have been saved successfully",
      });
      setNotesChanged(false);
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error saving notes",
        description: "There was a problem saving your notes",
        variant: "destructive"
      });
    }
  };
  
  const validateFiles = (fileList: FileList | File[]) => {
    const validFiles: File[] = [];
    const invalidFiles: { file: File; reason: string }[] = [];
    
    Array.from(fileList).forEach(file => {
      if (!allowedFileTypes.includes(file.type)) {
        invalidFiles.push({ file, reason: 'File type not supported' });
        return;
      }
      
      if (file.size > 100 * 1024 * 1024) {
        invalidFiles.push({ file, reason: 'File exceeds 100MB size limit' });
        return;
      }
      
      validFiles.push(file);
    });
    
    if (invalidFiles.length > 0) {
      toast({
        title: `${invalidFiles.length} file(s) couldn't be added`,
        description: invalidFiles.map(f => `${f.file.name}: ${f.reason}`).join(', '),
        variant: 'destructive',
      });
    }
    
    return validFiles;
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const validFiles = validateFiles(e.target.files);
    setFiles(prev => [...prev, ...validFiles]);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dropzoneRef.current?.classList.remove('border-primary', 'bg-primary/5');
    
    if (!e.dataTransfer.files?.length) return;
    
    const validFiles = validateFiles(e.dataTransfer.files);
    setFiles(prev => [...prev, ...validFiles]);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropzoneRef.current?.classList.add('border-primary', 'bg-primary/5');
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropzoneRef.current?.classList.remove('border-primary', 'bg-primary/5');
  };

  
  const connectGoogleDrive = () => {
    toast({
      title: "Connecting to Google Drive",
      description: "Redirecting to Google authorization...",
    });
    
    setUploadMethod('google');
    
    setTimeout(() => {
      toast({
        title: "Google Drive Connected",
        description: "Successfully connected to Google Drive. You can now select files.",
      });
    }, 2000);
  };
  
  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleClearFiles = () => {
    setFiles([]);
  };
  
  // Check if photos are missing and show warning if needed
  const checkAndUpload = () => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to upload',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if we have an expected count and files are less than expected
    if (expectedFileCount > 0 && files.length < expectedFileCount) {
      const missing = expectedFileCount - files.length;
      setMissingPhotosCount(missing);
      setShowMissingPhotosWarning(true);
      return;
    }
    
    // No missing photos, proceed with upload
    performUpload();
  };

  const handleUpload = async () => {
    checkAndUpload();
  };

  const performUpload = async () => {
    console.log("Starting upload for shoot ID:", shootId);
    
    setUploading(true);
    const formData = new FormData();
    // Backend expects an array named `files`
    // Use indexed keys to ensure Laravel parses as files[0], files[1], ...
    files.forEach((file, idx) => {
      formData.append(`files[${idx}]`, file);
    });
    try {
      // Determine the correct endpoint based on upload type and shoot ID
      let uploadEndpoint;
      if (shootId) {
        // For shoot-specific uploads, use the workflow system
        uploadEndpoint = `${API_BASE_URL}/api/shoots/${shootId}/upload-from-pc`;
        // Add service category and upload type
        formData.append('service_category', 'P'); // Default to Photos
        formData.append('upload_type', uploadType); // raw or edited
      } else {
        // If no shootId, cannot use workflow upload
        toast({ title: 'No shoot selected', description: 'Please select a shoot before uploading.', variant: 'destructive' });
        setUploading(false);
        return;
      }

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await axios.post(
        uploadEndpoint,
        formData,
        {
          headers: {
            // Let axios set multipart boundary automatically
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        }
      );
      const folderType = uploadType === 'raw' ? 'ToDo' : 'Completed';
      toast({
        title: 'Upload Complete',
        description: `${files.length} files uploaded successfully to ${folderType} folder.`,
      });
      if (onUploadComplete) {
        onUploadComplete(files, notes);
      }
      setUploading(false);
      setProgress(0);
      setFiles([]);
      setNotesChanged(false);
    } catch (error:any) {
      // Keep error message generic per your request
      toast({ title: 'Upload Failed', description: 'Something went wrong while uploading. Please try again.', variant: 'destructive' });
      console.error('Upload error:', error?.response?.data || error);
      setUploading(false);
    }

  };
  
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    } else if (file.type.startsWith('video/')) {
      return <FilmIcon className="h-5 w-5 text-purple-500" />;
    } else if (file.type.includes('zip')) {
      return <FolderIcon className="h-5 w-5 text-yellow-500" />;
    } else {
      return <FileIcon className="h-5 w-5 text-gray-500" />;
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Determine which tab to show based on user role
  const showRawTab = user?.role === 'photographer' || user?.role === 'admin' || user?.role === 'superadmin';
  const showEditedTab = user?.role === 'editor' || user?.role === 'admin' || user?.role === 'superadmin';
  
  // Get placeholder text based on user role and upload type
  const getNotesPlaceholder = () => {
    if (user?.role === 'photographer') {
      return "Add your notes about the shoot or specific instructions for the editor...";
    } else if (user?.role === 'editor') {
      return "Add your notes about the edited files or any delivery instructions...";
    } else if (uploadType === 'raw') {
      return "Add photographer notes or instructions for the editor...";
    } else {
      return "Add editor notes or delivery instructions...";
    }
  };
  
  // Get notes section title based on user role
  const getNotesTitle = () => {
    if (user?.role === 'photographer') {
      return "Photographer Notes";
    } else if (user?.role === 'editor') {
      return "Editor Notes";
    } else if (uploadType === 'raw') {
      return "Photographer Upload Notes";
    } else {
      return "Editor Upload Notes";
    }
  };
  
  // Get background color class based on user role - Updated to match dashboard background
  const getNotesBackgroundColorClass = () => {
    if (user?.role === 'photographer') {
      return "bg-blue-50/60 dark:bg-blue-900/10";
    } else if (user?.role === 'editor') {
      return "bg-purple-50/60 dark:bg-purple-900/10";
    } else if (uploadType === 'raw') {
      return "bg-blue-50/60 dark:bg-blue-900/10";
    } else {
      return "bg-purple-50/60 dark:bg-purple-900/10";
    }
  };

  // Get text color class based on user role - Updated for better contrast
  const getNotesTextColorClass = () => {
    if (user?.role === 'photographer') {
      return "text-blue-800 dark:text-blue-300";
    } else if (user?.role === 'editor') {
      return "text-purple-800 dark:text-purple-300";
    } else if (uploadType === 'raw') {
      return "text-blue-800 dark:text-blue-300";
    } else {
      return "text-purple-800 dark:text-purple-300";
    }
  };

  // Get border color class based on user role - Updated for better visual hierarchy
  const getNotesBorderColorClass = () => {
    if (user?.role === 'photographer') {
      return "border-blue-200 dark:border-blue-700";
    } else if (user?.role === 'editor') {
      return "border-purple-200 dark:border-purple-700";
    } else if (uploadType === 'raw') {
      return "border-blue-200 dark:border-blue-700";
    } else {
      return "border-purple-200 dark:border-purple-700";
    }
  };
  
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <UploadCloudIcon className="h-5 w-5 text-primary" />
          <CardTitle>File Uploader</CardTitle>
        </div>
        
        {shootId && (
          <Badge variant="outline">
            Shoot #{shootId}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="p-4">
        {/* Only show tabs if both raw and edited tabs are available (admin) */}
        {showRawTab && showEditedTab ? (
          <Tabs value={uploadType} onValueChange={(v: any) => setUploadType(v)} className="mb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="raw">Raw/Unedited Files</TabsTrigger>
              <TabsTrigger value="edited">Edited/Final Files</TabsTrigger>
            </TabsList>
            <TabsContent value="raw" className="pt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Upload RAW, unedited files for processing. Supported formats: JPG, PNG, TIFF, NEF, CR2, CR3, ARW, DNG (photos), MP4, MOV (videos), ZIP (iGuide).
              </div>
            </TabsContent>
            <TabsContent value="edited" className="pt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Upload final, edited files ready for client delivery. Supported formats: JPG, PNG (photos), MP4 (videos), ZIP (packages).
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          // Show only one tab description based on user role
          <div className="mb-4">
            {showRawTab && !showEditedTab && (
              <div className="text-sm text-muted-foreground mb-4">
                <h3 className="font-medium text-base mb-1">Raw/Unedited Files</h3>
                Upload RAW, unedited files for processing. Supported formats: JPG, PNG, TIFF, NEF, CR2, CR3, ARW, DNG (photos), MP4, MOV (videos), ZIP (iGuide).
              </div>
            )}
            {showEditedTab && !showRawTab && (
              <div className="text-sm text-muted-foreground mb-4">
                <h3 className="font-medium text-base mb-1">Edited/Final Files</h3>
                Upload final, edited files ready for client delivery. Supported formats: JPG, PNG (photos), MP4 (videos), ZIP (packages).
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-wrap gap-2 mb-4">
          <Button 
            variant={uploadMethod === 'local' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setUploadMethod('local')}
            className="flex-1"
          >
            <UploadCloudIcon className="h-4 w-4 mr-2" />
            Local Upload
          </Button>
          
          <Button 
            variant={uploadMethod === 'dropbox' ? 'default' : 'outline'} 
            size="sm"
            onClick={connectDropbox}
            className="flex-1"
          >
            <BoxIcon className="h-4 w-4 mr-2" />
            Dropbox
          </Button>
          
          {/* <Button 
            variant={uploadMethod === 'google' ? 'default' : 'outline'} 
            size="sm"
            onClick={connectGoogleDrive}
            className="flex-1"
          >
            <CloudIcon className="h-4 w-4 mr-2" />
            Google Drive
          </Button> */}
        </div>
        
        {uploadMethod === 'local' && (
          <div
            ref={dropzoneRef}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              hidden
            />
            
            <UploadCloudIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Drop files here or click to browse</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Upload up to 100 files at once (100MB max per file)
            </p>
            <Button variant="outline" className="mt-2" disabled={uploading}>
              <ArrowUpIcon className="h-4 w-4 mr-2" />
              Select Files
            </Button>
          </div>
        )}
        
        {uploadMethod === 'dropbox' && (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BoxIcon className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium">Dropbox Files</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => setFiles([])}>
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Select All
              </Button>
            </div>
            
            <div className="border rounded p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <ImageIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span>client_project_photo.jpg</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFiles([...files, new File([], 'client_project_photo.jpg')])}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="border rounded p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <FilmIcon className="h-5 w-5 text-purple-500 mr-2" />
                <span>property_tour.mov</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFiles([...files, new File([], 'property_tour.mov')])}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="border rounded p-3 flex items-center justify-between">
              <div className="flex items-center">
                <FileIcon className="h-5 w-5 text-gray-500 mr-2" />
                <span>listings_package.zip</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFiles([...files, new File([], 'listings_package.zip')])}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {uploadMethod === 'google' && (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CloudIcon className="h-5 w-5 text-green-600" />
                <h3 className="font-medium">Google Drive Files</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => setFiles([])}>
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Select All
              </Button>
            </div>
            
            <div className="border rounded p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <ImageIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span>real_estate_front.jpg</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFiles([...files, new File([], 'real_estate_front.jpg')])}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="border rounded p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <ImageIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span>real_estate_kitchen.jpg</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFiles([...files, new File([], 'real_estate_kitchen.jpg')])}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="border rounded p-3 flex items-center justify-between">
              <div className="flex items-center">
                <FilmIcon className="h-5 w-5 text-purple-500 mr-2" />
                <span>property_walkthrough.mp4</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFiles([...files, new File([], 'property_walkthrough.mp4')])}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="notes" className="text-sm font-medium block">
              {getNotesTitle()}
            </label>
            
            {shootId && notesChanged && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSaveNotes}
                className="flex gap-1 items-center"
              >
                <SaveIcon className="h-3.5 w-3.5 mr-1" />
                Save Notes Only
              </Button>
            )}
          </div>
          
          <textarea
            id="notes"
            className={`w-full min-h-[100px] p-3 rounded-md ${getNotesBackgroundColorClass()} ${getNotesTextColorClass()} ${getNotesBorderColorClass()} border-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-opacity-70`}
            placeholder={getNotesPlaceholder()}
            value={notes}
            onChange={handleNotesChange}
            disabled={uploading}
            style={{
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
              transition: "all 0.2s ease"
            }}
          ></textarea>
          
          {shootId && (
            <p className={`text-xs mt-2 ${getNotesTextColorClass()} opacity-80`}>
              {user?.role === 'photographer' ? 
                "These notes will be visible to editors and admins." : 
                user?.role === 'editor' ? 
                "These notes will be visible to the client and admins." :
                "These notes will be attached to the uploaded files."
              }
            </p>
          )}
        </div>
        
        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Selected Files ({files.length})</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearFiles}
                disabled={uploading}
              >
                Clear All
              </Button>
            </div>
            
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center overflow-hidden">
                    {getFileIcon(file)}
                    <div className="ml-3 overflow-hidden">
                      <p className="font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleRemoveFile(index)}
                    disabled={uploading}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {uploading && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Uploading {files.length} files...</p>
              <p className="text-sm">{progress}%</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        <div className="mt-6 flex justify-end gap-3">
          {!uploading && (
            <>
              <Button variant="outline" onClick={handleClearFiles} disabled={files.length === 0}>
                Cancel
              </Button>
              <Button onClick={handleUpload} className="flex items-center gap-1">
                <UploadCloudIcon className="h-4 w-4 mr-1" />
                {files.length > 0
                  ? `Upload ${files.length} ${files.length === 1 ? 'file' : 'files'}`
                  : 'Upload'
                }
              </Button>
            </>
          )}
          
          {uploading && (
            <Button variant="outline" disabled>
              Uploading...
            </Button>
          )}
        </div>
      </CardContent>
      
      {/* Missing Photos Warning Dialog */}
      <AlertDialog open={showMissingPhotosWarning} onOpenChange={setShowMissingPhotosWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
              Missing Photos Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are uploading <strong>{files.length}</strong> {files.length === 1 ? 'file' : 'files'}, 
                but <strong>{expectedFileCount}</strong> {expectedFileCount === 1 ? 'file is' : 'files are'} expected
                {uploadType === 'raw' && bracketMode && (
                  <span> ({expectedPhotoCount} photos × {bracketMode} brackets)</span>
                )}.
              </p>
              <p className="text-amber-600 font-medium">
                {missingPhotosCount} {missingPhotosCount === 1 ? 'photo is' : 'photos are'} missing.
              </p>
              <p>Do you want to continue with the upload anyway?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowMissingPhotosWarning(false);
                performUpload();
              }}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default FileUploader;

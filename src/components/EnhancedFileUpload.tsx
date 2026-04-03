import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FolderOpen, 
  File, 
  Image, 
  Video, 
  ArrowLeft, 
  Check, 
  X, 
  Loader2,
  Download
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import axios from 'axios';

interface DropboxFile {
  id: string;
  name: string;
  path_display: string;
  path_lower: string;
  size?: number;
  is_folder?: boolean;
  extension?: string;
  file_type?: string;
  client_modified?: string;
  server_modified: string;
  is_downloadable?: boolean;
}

interface EnhancedFileUploadProps {
  shootId: number;
  onUploadComplete?: () => void;
}

const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({ shootId, onUploadComplete }) => {
  const [activeTab, setActiveTab] = useState('pc');
  const [serviceCategory, setServiceCategory] = useState<string>('P');
  
  // PC Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Dropbox Browse state
  const [dropboxFiles, setDropboxFiles] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedDropboxFiles, setSelectedDropboxFiles] = useState<DropboxFile[]>([]);
  const [loadingDropbox, setLoadingDropbox] = useState(false);
  const [copying, setCopying] = useState(false);

  const serviceCategories = [
    { value: 'P', label: 'Photos', icon: Image },
    { value: 'iGuide', label: 'iGuide', icon: FolderOpen },
    { value: 'Video', label: 'Videos', icon: Video }
  ];

  // Load Dropbox files when tab changes to dropbox
  useEffect(() => {
    if (activeTab === 'dropbox') {
      loadDropboxFiles('');
    }
  }, [activeTab]);

  const loadDropboxFiles = async (path: string) => {
    setLoadingDropbox(true);
    try {
      const response = await axios.get('/api/dropbox/browse', {
        params: { path }
      });
      
      if (response.data.success) {
        setDropboxFiles(response.data.files);
        setCurrentPath(response.data.current_path);
      } else {
        toast({
          title: "Error",
          description: "Failed to load Dropbox files",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading Dropbox files:', error);
      toast({
        title: "Error",
        description: "Failed to connect to Dropbox",
        variant: "destructive",
      });
    } finally {
      setLoadingDropbox(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handlePCUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files[]', file);
    });
    formData.append('service_category', serviceCategory);
    formData.append('upload_type', 'raw');

    try {
      const response = await axios.post(`/api/shoots/${shootId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(progress);
        }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: `${response.data.success_count} files uploaded successfully`,
        });
        
        setSelectedFiles([]);
        if (onUploadComplete) onUploadComplete();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDropboxFileSelect = (file: DropboxFile) => {
    if (file.is_folder) {
      loadDropboxFiles(file.path_display);
      return;
    }

    const isSelected = selectedDropboxFiles.some(f => f.id === file.id);
    if (isSelected) {
      setSelectedDropboxFiles(prev => prev.filter(f => f.id !== file.id));
    } else {
      setSelectedDropboxFiles(prev => [...prev, file]);
    }
  };

  const handleDropboxCopy = async () => {
    if (selectedDropboxFiles.length === 0) return;

    setCopying(true);
    try {
      const filesToCopy = selectedDropboxFiles.map(file => ({
        path: file.path_display,
        name: file.name
      }));

      const response = await axios.post(`/api/shoots/${shootId}/copy-from-dropbox`, {
        files: filesToCopy,
        service_category: serviceCategory
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: `${response.data.success_count} files copied successfully`,
        });
        
        setSelectedDropboxFiles([]);
        if (onUploadComplete) onUploadComplete();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to copy files",
        variant: "destructive",
      });
    } finally {
      setCopying(false);
    }
  };

  const navigateUp = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop();
    const newPath = pathParts.length > 0 ? '/' + pathParts.join('/') : '';
    loadDropboxFiles(newPath);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: DropboxFile) => {
    if (file.is_folder) return <FolderOpen className="h-4 w-4 text-blue-500" />;
    if (file.file_type === 'image') return <Image className="h-4 w-4 text-green-500" />;
    if (file.file_type === 'video') return <Video className="h-4 w-4 text-purple-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload Files</span>
        </CardTitle>
        <CardDescription>
          Upload files from your computer or copy from your Dropbox account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Service Category Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Service Category</label>
            <Select value={serviceCategory} onValueChange={setServiceCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {serviceCategories.map(category => {
                  const Icon = category.icon;
                  return (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span>{category.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pc">From Computer</TabsTrigger>
              <TabsTrigger value="dropbox">From Dropbox</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pc" className="space-y-4">
              <div>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.raw,.cr2,.nef,.arw"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          {file.type.startsWith('image/') ? 
                            <Image className="h-4 w-4 text-green-500" /> : 
                            <Video className="h-4 w-4 text-purple-500" />
                          }
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <Button 
                onClick={handlePCUpload} 
                disabled={selectedFiles.length === 0 || uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {selectedFiles.length} Files
                  </>
                )}
              </Button>
            </TabsContent>
            
            <TabsContent value="dropbox" className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This feature browses files from the main Dropbox account configured on the server. 
                  Files will be copied from there to your shoot folder.
                </p>
              </div>
              
              {/* Navigation */}
              <div className="flex items-center space-x-2">
                {currentPath && (
                  <Button variant="outline" size="sm" onClick={navigateUp}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <span className="text-sm text-gray-500">
                  {currentPath || '/'}
                </span>
              </div>

              {/* File List */}
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {loadingDropbox ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading files...</span>
                  </div>
                ) : (
                  <div className="divide-y">
                    {dropboxFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer ${
                          selectedDropboxFiles.some(f => f.id === file.id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleDropboxFileSelect(file)}
                      >
                        <div className="flex items-center space-x-3">
                          {!file.is_folder && (
                            <Checkbox
                              checked={selectedDropboxFiles.some(f => f.id === file.id)}
                              onChange={() => {}} // Handled by onClick
                            />
                          )}
                          {getFileIcon(file)}
                          <div>
                            <div className="font-medium text-sm">{file.name}</div>
                            {file.size && (
                              <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                            )}
                          </div>
                        </div>
                        {file.is_folder && (
                          <div className="text-xs text-gray-400">Folder</div>
                        )}
                      </div>
                    ))}
                    
                    {dropboxFiles.length === 0 && (
                      <div className="text-center p-8 text-gray-500">
                        No files found in this folder
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Files Summary */}
              {selectedDropboxFiles.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selectedDropboxFiles.length} files selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDropboxFiles([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleDropboxCopy} 
                disabled={selectedDropboxFiles.length === 0 || copying}
                className="w-full"
              >
                {copying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Copying...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Copy {selectedDropboxFiles.length} Files
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedFileUpload;

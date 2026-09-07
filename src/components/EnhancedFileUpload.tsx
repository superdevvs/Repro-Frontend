import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FolderOpen, Image, Video, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import axios from 'axios';

interface EnhancedFileUploadProps {
  shootId: number;
  onUploadComplete?: () => void;
}

const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({ shootId, onUploadComplete }) => {
  const [serviceCategory, setServiceCategory] = useState<string>('P');
  
  // PC Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const serviceCategories = [
    { value: 'P', label: 'Photos', icon: Image },
    { value: 'iGuide', label: 'iGuide', icon: FolderOpen },
    { value: 'Video', label: 'Videos', icon: Video }
  ];

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

      const successCount = Number(response.data?.success_count ?? 0);
      if (successCount > 0) {
        toast({
          title: "Success",
          description: `${successCount} files uploaded successfully`,
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload Files</span>
        </CardTitle>
        <CardDescription>
          Upload files from your computer
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

          <div className="space-y-4">
              <div>
                <input
                  type="file"
                  aria-label="Choose files from your computer"
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedFileUpload;

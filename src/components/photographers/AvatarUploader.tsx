
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CameraIcon, UploadIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AvatarUploaderProps {
  avatarUrl: string;
  onAvatarChange: (url: string) => void;
  onShowUploadOptions: (show: boolean) => void;
  showUploadOptions: boolean;
}

export function AvatarUploader({ 
  avatarUrl, 
  onAvatarChange, 
  onShowUploadOptions,
  showUploadOptions 
}: AvatarUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name, file.type, file.size);
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file (JPEG, PNG, etc.)',
          variant: 'destructive',
        });
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload an image smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }
      
      // Create URL for preview
      const url = URL.createObjectURL(file);
      console.log("Created object URL:", url);
      onAvatarChange(url);
      onShowUploadOptions(false);
      
      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
      });
    } else {
      console.log("No file selected");
    }
  };

  const handleExternalUpload = (source: 'google-drive' | 'dropbox') => {
    // In a real app, this would launch the respective picker
    // For demo purposes, we'll just show a toast and use a placeholder
    const serviceName = source === 'google-drive' ? 'Google Drive' : 'Dropbox';
    
    // Simulate loading state
    toast({
      title: `Connecting to ${serviceName}`,
      description: `Opening ${serviceName} file picker...`,
    });
    
    // Mock successful upload with a placeholder avatar after a short delay
    setTimeout(() => {
      // In a real implementation, you would get the URL from the API response
      const placeholderUrl = source === 'google-drive'
        ? 'https://ui.shadcn.com/avatars/02.png'  // Different image for each source
        : 'https://ui.shadcn.com/avatars/03.png';
      
      console.log("Image URL being set:", placeholderUrl);
      onAvatarChange(placeholderUrl);
      onShowUploadOptions(false);
      
      toast({
        title: 'File uploaded',
        description: `Image from ${serviceName} has been uploaded successfully.`,
      });
    }, 1500);
  };

  return (
    <>
      <div className="flex justify-center mb-4">
        <div className="relative">
          <Avatar className="h-24 w-24 cursor-pointer border-2 border-border" onClick={() => onShowUploadOptions(true)}>
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt="Profile" />
            ) : (
              <AvatarFallback className="bg-secondary">
                <CameraIcon className="h-8 w-8 text-muted-foreground" />
              </AvatarFallback>
            )}
          </Avatar>
          <Button 
            type="button"
            size="sm" 
            variant="outline" 
            className="absolute bottom-0 right-0 h-8 w-8 p-0 rounded-full"
            onClick={() => onShowUploadOptions(true)}
          >
            <UploadIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {showUploadOptions && (
        <div className="bg-card border rounded-md p-3 relative">
          <Button 
            type="button"
            variant="ghost" 
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full"
            onClick={() => onShowUploadOptions(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="space-y-2 mt-2">
            <div className="flex items-center">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload from device
              </Button>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload} 
              />
            </div>
            <Button 
              type="button"
              variant="outline" 
              className="w-full justify-start"
              onClick={() => handleExternalUpload('google-drive')}
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/2295px-Google_Drive_icon_%282020%29.svg.png" 
                alt="Google Drive" 
                className="mr-2 h-4 w-4" 
              />
              Upload from Google Drive
            </Button>
            <Button 
              type="button"
              variant="outline" 
              className="w-full justify-start"
              onClick={() => handleExternalUpload('dropbox')}
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Dropbox_Icon.svg/2202px-Dropbox_Icon.svg.png" 
                alt="Dropbox" 
                className="mr-2 h-4 w-4" 
              />
              Upload from Dropbox
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

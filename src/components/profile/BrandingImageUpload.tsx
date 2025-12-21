
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImageIcon, Upload, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface BrandingImageUploadProps {
  onChange: (url: string) => void;
  initialImage?: string;
  aspectRatio?: string;
  maxWidth?: number;
  helperText?: string;
  className?: string;
}

export function BrandingImageUpload({ 
  onChange, 
  initialImage, 
  aspectRatio = '16/9',
  maxWidth = 400,
  helperText,
  className
}: BrandingImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(initialImage || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [ratio, setRatio] = useState(() => {
    const [width, height] = aspectRatio.split('/').map(Number);
    return height / width;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required to upload images');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'branding');

      const { data } = await axios.post(
        `${API_BASE_URL}/api/uploads/image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      setPreview(data.url);
      onChange(data.url);
      
      toast({
        title: "Image uploaded",
        description: "Your branding image has been updated",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      
      // Fallback to object URL if upload fails
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      onChange(objectUrl);
      
      toast({
        title: "Cloud upload failed",
        description: "Image saved locally only",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    setPreview(null);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    toast({
      title: "Image removed",
      description: "Your branding image has been removed",
    });
  };

  return (
    <div className="space-y-4">
      <div 
        className={`relative cursor-pointer group border-2 border-dashed border-border rounded-md overflow-hidden ${className}`}
        style={{ maxWidth: `${maxWidth}px` }}
        onClick={handleButtonClick}
      >
        <AspectRatio ratio={Number(aspectRatio.split('/')[0]) / Number(aspectRatio.split('/')[1])}>
          {preview ? (
            <img 
              src={preview} 
              alt="Branding" 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-muted/20 p-4">
              <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-center text-muted-foreground">
                Click to upload image
              </p>
            </div>
          )}
          
          <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${preview ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
            <div className="text-white flex flex-col items-center">
              <Upload className="h-6 w-6 mb-2" />
              <span className="text-sm">
                {preview ? 'Change Image' : 'Upload Image'}
              </span>
            </div>
          </div>
        </AspectRatio>
        
        {preview && (
          <button 
            className="absolute top-2 right-2 h-6 w-6 bg-destructive text-white rounded-full flex items-center justify-center z-10"
            onClick={handleClearImage}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs"
          onClick={handleButtonClick}
          disabled={uploading}
        >
          {preview ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              Change
            </>
          ) : (
            <>
              <Upload className="h-3 w-3 mr-1" />
              Upload
            </>
          )}
        </Button>
        
        {preview && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs text-destructive hover:text-destructive"
            onClick={handleClearImage}
            disabled={uploading}
          >
            <X className="h-3 w-3 mr-1" />
            Remove
          </Button>
        )}
        
        {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
      </div>
    </div>
  );
}

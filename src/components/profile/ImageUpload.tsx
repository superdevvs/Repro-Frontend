
import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

interface ImageUploadProps {
  onChange: (url: string) => void | Promise<void>;
  initialImage?: string;
  className?: string;
}

export function ImageUpload({ onChange, initialImage, className }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(initialImage || null);
  const [isHovering, setIsHovering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => setPreview(initialImage || null), [initialImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

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
      
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required to upload images');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

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

      await onChange(data.url);
      setPreview(data.url);
      
      toast({
        title: "Image uploaded",
        description: "Your image is ready.",
      });
    } catch (error: unknown) {
      console.error('Error uploading image:', error);
      
      toast({
        title: "Upload failed",
        description: (axios.isAxiosError<{ message?: string }>(error) && error.response?.data?.message)
          || (error instanceof Error ? error.message : "Failed to upload image. Please try again."),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleButtonClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleClearImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (uploading) return;
    setUploading(true);
    try {
      await onChange('');
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ title: "Image removed", description: "The selected image was removed." });
    } catch (error: unknown) {
      toast({
        title: "Removal failed",
        description: error instanceof Error ? error.message : "Failed to remove image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-0">
      <div 
        className="relative group"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Avatar 
          className={`cursor-pointer ${className || 'h-24 w-24'}`}
          onClick={handleButtonClick}
        >
          <AvatarImage src={preview || undefined} />
          <AvatarFallback className="text-xl">
            {user?.name?.slice(0, 2) || 'U'}
          </AvatarFallback>
        </Avatar>
        
        {(isHovering || !preview) && (
          <div 
            className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center cursor-pointer"
            onClick={handleButtonClick}
          >
            <Camera className="h-6 w-6 text-white" />
          </div>
        )}
        
        {preview && (
          <button 
            type="button"
            aria-label="Remove profile photo"
            disabled={uploading}
            className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-white rounded-full flex items-center justify-center"
            onClick={handleClearImage}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <input
        type="file"
        aria-label="Profile photo"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        disabled={uploading}
      />
      
      <Button 
        type="button"
        variant="outline" 
        size="sm" 
        className="mt-2 text-xs sm:mt-3"
        onClick={handleButtonClick}
        disabled={uploading}
      >
        <Upload className="h-3 w-3 mr-1" />
        {uploading ? 'Uploading...' : 'Change Photo'}
      </Button>
    </div>
  );
}

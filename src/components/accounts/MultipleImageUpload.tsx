import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

interface MultipleImageUploadProps {
  onChange: (urls: string[]) => void;
  initialImages?: string[];
  maxImages?: number;
  folder?: string;
  label?: string;
}

export function MultipleImageUpload({ 
  onChange, 
  initialImages = [], 
  maxImages = 10,
  folder = 'insurance',
  label = 'Upload Images'
}: MultipleImageUploadProps) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState<{ [key: number]: boolean }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast({
        title: "Too many images",
        description: `Maximum ${maxImages} images allowed`,
        variant: "destructive",
      });
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      toast({
        title: "Invalid file type",
        description: "Please upload only image files",
        variant: "destructive",
      });
      return;
    }

    // Upload each file
    const uploadPromises = imageFiles.map(async (file, index) => {
      const currentIndex = images.length + index;
      
      try {
        setUploading(prev => ({ ...prev, [currentIndex]: true }));
        
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('Authentication required to upload images');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

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

        return data.url;
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
        return null;
      } finally {
        setUploading(prev => {
          const newState = { ...prev };
          delete newState[currentIndex];
          return newState;
        });
      }
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter((url): url is string => url !== null);
    
    if (validUrls.length > 0) {
      const newImages = [...images, ...validUrls];
      setImages(newImages);
      onChange(newImages);
      
      toast({
        title: "Images uploaded",
        description: `${validUrls.length} image(s) uploaded successfully`,
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onChange(newImages);
    
    toast({
      title: "Image removed",
      description: "Image has been removed",
    });
  };

  const isUploading = Object.values(uploading).some(v => v);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || images.length >= maxImages}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Uploading...' : 'Add Images'}
        </Button>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((url, index) => (
            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border">
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                className="absolute top-1 right-1 h-6 w-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(index)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No images uploaded yet
          </p>
        </div>
      )}

      {images.length > 0 && images.length < maxImages && (
        <p className="text-xs text-muted-foreground">
          {images.length} of {maxImages} images uploaded
        </p>
      )}
    </div>
  );
}


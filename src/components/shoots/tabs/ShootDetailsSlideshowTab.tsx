import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Download,
  Eye,
  EyeOff,
  Edit,
  Plus,
  Trash2,
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';

interface ShootDetailsSlideshowTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  onShootUpdate: () => void;
}

interface Slideshow {
  id: string;
  title: string;
  orientation: 'portrait' | 'landscape';
  photos: string[];
  transition: string;
  speed: number;
  visible: boolean;
  url?: string;
}

export function ShootDetailsSlideshowTab({
  shoot,
  isAdmin,
  onShootUpdate,
}: ShootDetailsSlideshowTabProps) {
  const { toast } = useToast();
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newSlideshow, setNewSlideshow] = useState({
    title: '',
    orientation: 'landscape' as 'portrait' | 'landscape',
    transition: 'fade',
    speed: 3,
    selectedPhotos: [] as string[],
  });

  useEffect(() => {
    // Load existing slideshows
    loadSlideshows();
  }, [shoot.id]);

  const loadSlideshows = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/slideshows`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (res.ok) {
        const json = await res.json();
        setSlideshows(json.data || json || []);
      }
    } catch (error) {
      console.error('Error loading slideshows:', error);
    }
  };

  const handleCreateSlideshow = async () => {
    if (!newSlideshow.title.trim() || newSlideshow.selectedPhotos.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title and select at least one photo',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/slideshows`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          title: newSlideshow.title,
          orientation: newSlideshow.orientation,
          transition: newSlideshow.transition,
          speed: newSlideshow.speed,
          photo_ids: newSlideshow.selectedPhotos,
        }),
      });

      if (!res.ok) throw new Error('Failed to create slideshow');

      toast({
        title: 'Success',
        description: 'Slideshow created successfully',
      });

      setNewSlideshow({
        title: '',
        orientation: 'landscape',
        transition: 'fade',
        speed: 3,
        selectedPhotos: [],
      });
      loadSlideshows();
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create slideshow',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleVisibility = async (slideshowId: string, currentVisible: boolean) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/slideshows/${slideshowId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ visible: !currentVisible }),
      });

      if (!res.ok) throw new Error('Failed to update visibility');

      loadSlideshows();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update visibility',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSlideshow = async (slideshowId: string) => {
    if (!confirm('Are you sure you want to delete this slideshow?')) return;

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/slideshows/${slideshowId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to delete slideshow');

      toast({
        title: 'Success',
        description: 'Slideshow deleted successfully',
      });

      loadSlideshows();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete slideshow',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (slideshowId: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/slideshows/${slideshowId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to download slideshow');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slideshow-${slideshowId}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download slideshow',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Create New Slideshow */}
      <Card>
        <CardHeader>
          <CardTitle>Create Slideshow</CardTitle>
          <CardDescription>Generate a new slideshow from selected photos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={newSlideshow.title}
              onChange={(e) => setNewSlideshow(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter slideshow title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select
                value={newSlideshow.orientation}
                onValueChange={(value: 'portrait' | 'landscape') =>
                  setNewSlideshow(prev => ({ ...prev, orientation: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transition</Label>
              <Select
                value={newSlideshow.transition}
                onValueChange={(value) =>
                  setNewSlideshow(prev => ({ ...prev, transition: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fade">Fade</SelectItem>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Speed (seconds per slide)</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={newSlideshow.speed}
              onChange={(e) =>
                setNewSlideshow(prev => ({ ...prev, speed: parseInt(e.target.value) || 3 }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Select Photos</Label>
            <Button
              variant="outline"
              onClick={() => {
                toast({
                  title: 'Photo Selection',
                  description: 'Photo selection dialog would open here',
                });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Select Photos ({newSlideshow.selectedPhotos.length} selected)
            </Button>
          </div>

          <Button
            onClick={handleCreateSlideshow}
            disabled={creating || !newSlideshow.title.trim() || newSlideshow.selectedPhotos.length === 0}
            className="w-full"
          >
            {creating ? 'Creating...' : 'Generate Slideshow'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Slideshows */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Slideshows</CardTitle>
          <CardDescription>Manage and download existing slideshows</CardDescription>
        </CardHeader>
        <CardContent>
          {slideshows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No slideshows created yet
            </div>
          ) : (
            <div className="space-y-4">
              {slideshows.map((slideshow) => (
                <div
                  key={slideshow.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{slideshow.title}</h3>
                      <Badge variant={slideshow.visible ? 'default' : 'secondary'}>
                        {slideshow.visible ? 'Visible' : 'Hidden'}
                      </Badge>
                      <Badge variant="outline">
                        {slideshow.orientation}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {slideshow.photos.length} photos • {slideshow.transition} transition • {slideshow.speed}s per slide
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleVisibility(slideshow.id, slideshow.visible)}
                      title={slideshow.visible ? 'Hide' : 'Show'}
                    >
                      {slideshow.visible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(slideshow.id)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast({
                          title: 'Edit',
                          description: 'Edit slideshow dialog would open here',
                        });
                      }}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteSlideshow(slideshow.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



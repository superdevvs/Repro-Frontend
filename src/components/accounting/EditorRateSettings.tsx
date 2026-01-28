import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { DollarSign, Save } from 'lucide-react';

interface EditorRateSettings {
  photoEditRate: number;
  videoEditRate: number;
  floorplanRate: number;
  otherRate: number;
}

export function EditorRateSettings() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [rates, setRates] = useState<EditorRateSettings>({
    photoEditRate: 0,
    videoEditRate: 0,
    floorplanRate: 0,
    otherRate: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing rates
  useEffect(() => {
    const loadRates = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        const url = `${API_BASE_URL}/api/editors/${user.id}/rates`;
        
        // Log for debugging (remove in production)
        if (import.meta.env.DEV) {
          console.log('Loading rates from:', url);
        }
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.data) {
            const updatedRates = {
              photoEditRate: data.data.photo_edit_rate || 0,
              videoEditRate: data.data.video_edit_rate || 0,
              floorplanRate: data.data.floorplan_rate || 0,
              otherRate: data.data.other_rate || 0,
            };
            setRates(updatedRates);
            if (user) {
              const updatedMetadata = {
                ...(user.metadata || {}),
                photo_edit_rate: updatedRates.photoEditRate,
                video_edit_rate: updatedRates.videoEditRate,
                floorplan_rate: updatedRates.floorplanRate,
                other_rate: updatedRates.otherRate,
              };
              setUser({ ...user, metadata: updatedMetadata });
            }
          }
        } else if (response.status !== 404) {
          // 404 is expected if rates don't exist yet
          throw new Error('Failed to load rates');
        }
      } catch (error) {
        console.error('Error loading rates:', error);
        // Don't show error toast for initial load - rates might not exist yet
      } finally {
        setIsLoading(false);
      }
    };

    loadRates();
  }, [user?.id]);

  const handleRateChange = (field: keyof EditorRateSettings, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates(prev => ({
      ...prev,
      [field]: numValue,
    }));
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User information not available.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = `${API_BASE_URL}/api/editors/${user.id}/rates`;
      
      // Log for debugging (remove in production)
      if (import.meta.env.DEV) {
        console.log('Saving rates to:', url);
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photo_edit_rate: rates.photoEditRate,
          video_edit_rate: rates.videoEditRate,
          floorplan_rate: rates.floorplanRate,
          other_rate: rates.otherRate,
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const errorData = responseData || {};
        
        // Handle 404 specifically - endpoint doesn't exist
        if (response.status === 404) {
          throw new Error('This feature is not yet available. The API endpoint has not been implemented on the server.');
        }
        
        // Handle other errors
        const errorMessage = errorData.message || errorData.error || 
          (response.status === 401 ? 'You are not authorized to perform this action.' :
           response.status === 500 ? 'Server error. Please try again later.' :
           'Failed to save rates. Please try again.');
        throw new Error(errorMessage);
      }

      if (responseData?.data) {
        const updatedRates = {
          photoEditRate: responseData.data.photo_edit_rate || 0,
          videoEditRate: responseData.data.video_edit_rate || 0,
          floorplanRate: responseData.data.floorplan_rate || 0,
          otherRate: responseData.data.other_rate || 0,
        };
        setRates(updatedRates);
        if (user) {
          const updatedMetadata = {
            ...(user.metadata || {}),
            photo_edit_rate: updatedRates.photoEditRate,
            video_edit_rate: updatedRates.videoEditRate,
            floorplan_rate: updatedRates.floorplanRate,
            other_rate: updatedRates.otherRate,
          };
          setUser({ ...user, metadata: updatedMetadata });
        }
      }

      toast({
        title: "Rates Saved",
        description: "Your editing rates have been updated successfully.",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Error saving rates:', error);
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast({
          title: "Connection Error",
          description: "Unable to connect to the server. Please check your internet connection and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to save rates. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Editing Rates</CardTitle>
          <CardDescription>Set your rates per image type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading rates...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Editing Rates
        </CardTitle>
        <CardDescription>
          Set your rates per image type. Earnings will be calculated based on these rates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="photoEditRate">Photo Edit Rate ($ per image)</Label>
          <Input
            id="photoEditRate"
            type="number"
            min="0"
            step="0.01"
            value={rates.photoEditRate}
            onChange={(e) => handleRateChange('photoEditRate', e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="videoEditRate">Video Edit Rate ($ per video)</Label>
          <Input
            id="videoEditRate"
            type="number"
            min="0"
            step="0.01"
            value={rates.videoEditRate}
            onChange={(e) => handleRateChange('videoEditRate', e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="floorplanRate">Floorplan Rate ($ per floorplan)</Label>
          <Input
            id="floorplanRate"
            type="number"
            min="0"
            step="0.01"
            value={rates.floorplanRate}
            onChange={(e) => handleRateChange('floorplanRate', e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="otherRate">Other Rate ($ per item)</Label>
          <Input
            id="otherRate"
            type="number"
            min="0"
            step="0.01"
            value={rates.otherRate}
            onChange={(e) => handleRateChange('otherRate', e.target.value)}
            placeholder="0.00"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Rates'}
        </Button>
      </CardContent>
    </Card>
  );
}




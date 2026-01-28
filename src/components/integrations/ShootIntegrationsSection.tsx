import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';
import { 
  Home, 
  ExternalLink, 
  RefreshCw, 
  Upload, 
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Layers
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ShootIntegrationsSectionProps {
  shoot: {
    id: number;
    address: string;
    city: string;
    state: string;
    zip: string;
    mls_id?: string | null;
    listing_source?: string | null;
    property_details?: any;
    bright_mls_publish_status?: string | null;
    bright_mls_last_published_at?: string | null;
    bright_mls_manifest_id?: string | null;
    iguide_tour_url?: string | null;
    iguide_floorplans?: any[] | null;
    iguide_last_synced_at?: string | null;
    files?: Array<{ id: number; path?: string; url?: string; filename?: string }>;
  };
  onRefresh?: () => void;
}

export function ShootIntegrationsSection({ shoot, onRefresh }: ShootIntegrationsSectionProps) {
  const { toast } = useToast();
  const [refreshingProperty, setRefreshingProperty] = useState(false);
  const [syncingIguide, setSyncingIguide] = useState(false);
  const [publishingBrightMls, setPublishingBrightMls] = useState(false);
  const [brightMlsDialogOpen, setBrightMlsDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());

  const propertyDetails = shoot.property_details || {};
  
  const handleRefreshProperty = async () => {
    setRefreshingProperty(true);
    try {
      const response = await apiClient.post(API_ROUTES.integrations.property.refresh(shoot.id));
      if (response.data.success) {
        toast({
          title: "Property refreshed",
          description: "Property details have been updated from Zillow.",
        });
        onRefresh?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to refresh property details.",
        variant: "destructive",
      });
    } finally {
      setRefreshingProperty(false);
    }
  };

  const handleSyncIguide = async () => {
    setSyncingIguide(true);
    try {
      const response = await apiClient.post(API_ROUTES.integrations.iguide.sync(shoot.id));
      if (response.data.success) {
        toast({
          title: "iGUIDE synced",
          description: "iGUIDE tour and floorplans have been synced successfully.",
        });
        onRefresh?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to sync iGUIDE data.",
        variant: "destructive",
      });
    } finally {
      setSyncingIguide(false);
    }
  };

  const handlePublishToBrightMls = async () => {
    setPublishingBrightMls(true);
    try {
      const photos = shoot.files
        ?.filter((f, idx) => selectedPhotos.has(f.id) || idx === 0) // Include first photo by default
        .map((f) => ({
          id: f.id,
          url: f.path || f.url || '',
          filename: f.filename || `photo-${f.id}`,
          selected: true,
        })) || [];

      const response = await apiClient.post(
        API_ROUTES.integrations.brightMls.publish(shoot.id),
        {
          photos,
          iguide_tour_url: shoot.iguide_tour_url,
          documents: shoot.iguide_floorplans?.map((fp: any) => ({
            url: fp.url || fp,
            filename: fp.filename || 'floorplan.pdf',
            visibility: 'private',
          })) || [],
        }
      );

      if (response.data.success) {
        toast({
          title: "Published to Bright MLS",
          description: "Media manifest has been published successfully.",
        });
        setBrightMlsDialogOpen(false);
        onRefresh?.();
      } else {
        throw new Error(response.data.message || 'Publishing failed');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to publish to Bright MLS.",
        variant: "destructive",
      });
    } finally {
      setPublishingBrightMls(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">External Integrations</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Manage integrations with Zillow, iGUIDE, and Bright MLS for this shoot.
        </p>
      </div>

      {/* Zillow Property Snapshot */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Zillow Property Snapshot
              </CardTitle>
              <CardDescription>Property information from Zillow/Bridge</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshProperty}
              disabled={refreshingProperty}
            >
              {refreshingProperty ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {propertyDetails.mls_id || propertyDetails.beds ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {propertyDetails.status && (
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{propertyDetails.status}</p>
                  </div>
                )}
                {propertyDetails.price && (
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-medium">
                      ${propertyDetails.price.toLocaleString()}
                    </p>
                  </div>
                )}
                {propertyDetails.days_on_market && (
                  <div>
                    <p className="text-xs text-muted-foreground">Days on Market</p>
                    <p className="font-medium">{propertyDetails.days_on_market}</p>
                  </div>
                )}
                {propertyDetails.mls_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">MLS ID</p>
                    <p className="font-medium">{propertyDetails.mls_id}</p>
                  </div>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {propertyDetails.beds && (
                  <div>
                    <p className="text-xs text-muted-foreground">Bedrooms</p>
                    <p className="font-medium">{propertyDetails.beds}</p>
                  </div>
                )}
                {propertyDetails.baths && (
                  <div>
                    <p className="text-xs text-muted-foreground">Bathrooms</p>
                    <p className="font-medium">{propertyDetails.baths}</p>
                  </div>
                )}
                {propertyDetails.sqft && (
                  <div>
                    <p className="text-xs text-muted-foreground">Square Feet</p>
                    <p className="font-medium">{propertyDetails.sqft.toLocaleString()}</p>
                  </div>
                )}
                {propertyDetails.year_built && (
                  <div>
                    <p className="text-xs text-muted-foreground">Year Built</p>
                    <p className="font-medium">{propertyDetails.year_built}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No property data available. Click "Refresh" to fetch from Zillow.
            </p>
          )}
        </CardContent>
      </Card>

      {/* iGUIDE Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            iGUIDE 3D Tour
          </CardTitle>
          <CardDescription>Sync 3D tour and floorplans from iGUIDE</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shoot.iguide_tour_url ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="default">Synced</Badge>
                {shoot.iguide_last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(shoot.iguide_last_synced_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <a
                href={shoot.iguide_tour_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View 3D Tour <ExternalLink className="h-3 w-3" />
              </a>
              {shoot.iguide_floorplans && shoot.iguide_floorplans.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Floorplans</p>
                  <div className="flex flex-wrap gap-2">
                    {shoot.iguide_floorplans.map((fp: any, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {fp.filename || `Floorplan ${idx + 1}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No iGUIDE tour synced yet.
            </p>
          )}
          <Button
            variant="outline"
            onClick={handleSyncIguide}
            disabled={syncingIguide}
          >
            {syncingIguide ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync from iGUIDE
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Bright MLS Publishing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bright MLS Publishing
          </CardTitle>
          <CardDescription>Publish media manifest to Bright MLS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shoot.bright_mls_publish_status ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    shoot.bright_mls_publish_status === 'published' ? 'default' :
                    shoot.bright_mls_publish_status === 'error' ? 'destructive' : 'secondary'
                  }
                >
                  {shoot.bright_mls_publish_status}
                </Badge>
                {shoot.bright_mls_last_published_at && (
                  <p className="text-xs text-muted-foreground">
                    Last published: {new Date(shoot.bright_mls_last_published_at).toLocaleString()}
                  </p>
                )}
              </div>
              {shoot.bright_mls_manifest_id && (
                <p className="text-xs text-muted-foreground">
                  Manifest ID: {shoot.bright_mls_manifest_id}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not yet published to Bright MLS.
            </p>
          )}
          <Dialog open={brightMlsDialogOpen} onOpenChange={setBrightMlsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!shoot.mls_id}>
                <Upload className="mr-2 h-4 w-4" />
                Publish to Bright MLS
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Publish to Bright MLS</DialogTitle>
                <DialogDescription>
                  Select media to include in the manifest for MLS ID: {shoot.mls_id || 'N/A'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Photos</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {shoot.files?.slice(0, 20).map((file, idx) => (
                      <div key={file.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`photo-${file.id}`}
                          checked={selectedPhotos.has(file.id) || idx === 0}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedPhotos);
                            if (checked) {
                              newSet.add(file.id);
                            } else {
                              newSet.delete(file.id);
                            }
                            setSelectedPhotos(newSet);
                          }}
                        />
                        <Label
                          htmlFor={`photo-${file.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {file.filename || `Photo ${idx + 1}`}
                          {idx === 0 && <span className="text-muted-foreground ml-1">(Primary)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                {shoot.iguide_tour_url && (
                  <div className="flex items-center space-x-2">
                    <Checkbox id="iguide-tour" defaultChecked disabled />
                    <Label htmlFor="iguide-tour" className="text-sm font-normal">
                      Include iGUIDE 3D Tour
                    </Label>
                  </div>
                )}
                {shoot.iguide_floorplans && shoot.iguide_floorplans.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Floorplans</Label>
                    <div className="text-sm text-muted-foreground">
                      {shoot.iguide_floorplans.length} floorplan(s) will be included
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setBrightMlsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePublishToBrightMls}
                  disabled={publishingBrightMls}
                >
                  {publishingBrightMls ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    'Publish'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}



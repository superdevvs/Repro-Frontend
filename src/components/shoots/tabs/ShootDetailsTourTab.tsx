import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Copy,
  ExternalLink,
  Share2,
  QrCode,
  ChevronDown,
  ChevronUp,
  Download,
  Edit,
  Trash,
  Check,
  X,
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShootDetailsTourTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  onShootUpdate: () => void;
}

export function ShootDetailsTourTab({
  shoot,
  isAdmin,
  onShootUpdate,
}: ShootDetailsTourTabProps) {
  const { toast } = useToast();
  const [tourLinks, setTourLinks] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    links: true,
    settings: false,
    property: false,
  });
  const [qrCodeDialog, setQrCodeDialog] = useState<{ open: boolean; type: string; url: string }>({
    open: false,
    type: '',
    url: '',
  });
  
  // 3D tour edit state
  const [editing3DKey, setEditing3DKey] = useState<'matterport' | 'iGuide' | 'cubicasa' | null>(null);
  const [editing3DValue, setEditing3DValue] = useState('');
  const [isSaving3D, setIsSaving3D] = useState(false);
  const [isDeleting3D, setIsDeleting3D] = useState<'matterport' | 'iGuide' | 'cubicasa' | null>(null);

  useEffect(() => {
    // Initialize tour links from shoot data
    const links: Record<string, string> = {};
    if (shoot.tourLinks) {
      links.branded = shoot.tourLinks.branded || '';
      links.mls = shoot.tourLinks.mls || '';
      links.genericMls = shoot.tourLinks.genericMls || '';
      links.matterport = shoot.tourLinks.matterport || '';
      links.iGuide = shoot.tourLinks.iGuide || '';
      links.cubicasa = shoot.tourLinks.cubicasa || '';
    }
    setTourLinks(links);
  }, [shoot]);

  const getTourUrl = (type: string): string => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const shootId = shoot?.id || '';
      
      if (!shootId) {
        return '';
      }
      
      switch (type) {
        case 'branded':
          return `${baseUrl}/tour/branded?shootId=${shootId}`;
        case 'mls':
          return `${baseUrl}/tour/mls?shootId=${shootId}`;
        case 'genericMls':
          return `${baseUrl}/tour/generic-mls?shootId=${shootId}`;
        default:
          return tourLinks[type] || '';
      }
    } catch (error) {
      console.error('Error getting tour URL:', error);
      return '';
    }
  };

  const copyLink = (type: string) => {
    try {
      const url = getTourUrl(type);
      if (!url) {
        toast({
          title: 'Error',
          description: 'No URL available to copy',
          variant: 'destructive',
        });
        return;
      }
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
        toast({
          title: 'Copied',
          description: 'Tour link copied to clipboard',
        });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast({
          title: 'Copied',
          description: 'Tour link copied to clipboard',
        });
      }
    } catch (error) {
      console.error('Error copying link:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy link. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openLink = (type: string) => {
    const url = getTourUrl(type);
    window.open(url, '_blank');
  };

  const shareLink = async (type: string) => {
    const url = getTourUrl(type);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${shoot.location?.address} - ${type} Tour`,
          url: url,
        });
      } catch (error) {
        // User cancelled or error occurred
        copyLink(type);
      }
    } else {
      copyLink(type);
    }
  };

  const getQrCode = (type: string) => {
    try {
      const url = getTourUrl(type);
      if (!url || url.trim() === '') {
        toast({
          title: 'No URL',
          description: 'Tour link is not available',
          variant: 'destructive',
        });
        return;
      }
      
      // Open QR code dialog - will use web-based QR code API
      setQrCodeDialog({ open: true, type, url });
    } catch (error) {
      console.error('Error getting QR code:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate QR code. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadQrCode = () => {
    try {
      if (!qrCodeDialog.url) {
        toast({
          title: 'Error',
          description: 'No URL available for QR code',
          variant: 'destructive',
        });
        return;
      }
      
      // Download QR code from web API
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeDialog.url)}`;
      const link = document.createElement('a');
      link.download = `qr-code-${qrCodeDialog.type}-${shoot.id}.png`;
      link.href = qrCodeUrl;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Downloaded',
        description: 'QR code downloaded successfully',
      });
    } catch (error) {
      console.error('QR code download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download QR code. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 3D tour management functions
  const startEdit3D = (key: 'matterport' | 'iGuide' | 'cubicasa') => {
    setEditing3DKey(key);
    setEditing3DValue(tourLinks[key] || '');
  };

  const cancelEdit3D = () => {
    setEditing3DKey(null);
    setEditing3DValue('');
  };

  const save3DTour = async () => {
    if (!editing3DKey) return;
    const value = editing3DValue.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL (must start with http:// or https://)',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving3D(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Update tour links through the shoot PATCH endpoint
      const updatedTourLinks = {
        ...(shoot.tourLinks || {}),
        [editing3DKey]: value || null,
      };
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ tour_links: updatedTourLinks }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save 3D tour' }));
        throw new Error(errorData.message || 'Failed to save 3D tour');
      }

      const updated = { ...tourLinks, [editing3DKey]: value || '' };
      setTourLinks(updated);
      setEditing3DKey(null);
      setEditing3DValue('');
      toast({
        title: 'Success',
        description: '3D tour link saved successfully',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Save 3D tour failed', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save 3D tour. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving3D(false);
    }
  };

  const confirmDelete3D = async (key: 'matterport' | 'iGuide' | 'cubicasa') => {
    if (!isAdmin) {
      toast({
        title: 'Permission denied',
        description: "You don't have permission to remove links",
        variant: 'destructive',
      });
      return;
    }

    const ok = window.confirm('Delete this tour link? This action cannot be undone.');
    if (!ok) return;

    setIsDeleting3D(key);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Update tour links through the shoot PATCH endpoint
      const updatedTourLinks = {
        ...(shoot.tourLinks || {}),
        [key]: null,
      };
      
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ tour_links: updatedTourLinks }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to delete tour link' }));
        throw new Error(errorData.message || 'Failed to delete tour link');
      }

      const updated = { ...tourLinks, [key]: '' };
      setTourLinks(updated);
      toast({
        title: 'Success',
        description: 'Tour link removed successfully',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Failed to delete tour link', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to remove link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting3D(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tour Links Section */}
      <Card>
        <CardHeader>
          <CardTitle>Tour Links</CardTitle>
          <CardDescription>Manage and share tour links for this shoot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Branded Tour Link */}
          <div className="space-y-2">
            <Label>Branded Tour Link</Label>
            <div className="flex items-center gap-2">
              <Input
                value={getTourUrl('branded')}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink('branded')}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLink('branded')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shareLink('branded')}
                title="Share link"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => getQrCode('branded')}
                title="Get QR code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* MLS-Compliant Link */}
          <div className="space-y-2">
            <Label>MLS-Compliant Link</Label>
            <div className="flex items-center gap-2">
              <Input
                value={getTourUrl('mls')}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink('mls')}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLink('mls')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shareLink('mls')}
                title="Share link"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => getQrCode('mls')}
                title="Get QR code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Generic MLS Link */}
          <div className="space-y-2">
            <Label>Generic MLS Link</Label>
            <div className="flex items-center gap-2">
              <Input
                value={getTourUrl('genericMls')}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink('genericMls')}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLink('genericMls')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shareLink('genericMls')}
                title="Share link"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => getQrCode('genericMls')}
                title="Get QR code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tour Settings Section */}
      <Card>
        <Collapsible
          open={openSections.settings}
          onOpenChange={() => toggleSection('settings')}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tour Settings</CardTitle>
                  <CardDescription>Configure tour display and behavior</CardDescription>
                </div>
                {openSections.settings ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Header Position</Label>
                <Input placeholder="Configure header position" />
              </div>
              <div className="space-y-2">
                <Label>Tour Version</Label>
                <Input placeholder="Tour version" />
              </div>
              <div className="space-y-2">
                <Label>Realtor(s)</Label>
                <Input placeholder="Realtor information" />
              </div>
              <div className="space-y-2">
                <Label>Autoplay</Label>
                <Input type="checkbox" />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Property Info Section */}
      <Card>
        <Collapsible
          open={openSections.property}
          onOpenChange={() => toggleSection('property')}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Property Information</CardTitle>
                  <CardDescription>Property details for tour display</CardDescription>
                </div>
                {openSections.property ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Property description" />
              </div>
              <div className="space-y-2">
                <Label>MLS Number</Label>
                <Input placeholder="MLS #" />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input placeholder="Property price" />
              </div>
              <div className="space-y-2">
                <Label>Lot Size</Label>
                <Input placeholder="Lot size" />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* 3D Tours Section */}
      <Card>
        <CardHeader>
          <CardTitle>3D Tours</CardTitle>
          <CardDescription>Manage Matterport, iGuide and Cubicasa links.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(['matterport', 'iGuide', 'cubicasa'] as const).map((key) => {
            const label = key === 'matterport' ? 'Matterport' : key === 'iGuide' ? 'iGuide' : 'Cubicasa';
            const url = tourLinks[key] || '';
            const isEditing = editing3DKey === key;

            return (
              <div key={key} className="border rounded-lg p-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 12h18" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">{label} Link</div>
                      <div className="text-xs text-muted-foreground">{url || 'Not set'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {url && !isEditing && (
                      <Button variant="ghost" size="sm" onClick={() => window.open(url, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {isEditing ? (
                      <></>
                    ) : (
                      <>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => startEdit3D(key)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && url && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => confirmDelete3D(key)}
                            disabled={isDeleting3D === key}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <Input
                      value={editing3DValue}
                      onChange={(e) => setEditing3DValue(e.target.value)}
                      placeholder="https://"
                      className="h-8 text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={cancelEdit3D}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={save3DTour} disabled={isSaving3D}>
                        {isSaving3D ? (
                          'Saving...'
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrCodeDialog.open} onOpenChange={(open) => setQrCodeDialog({ ...qrCodeDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - {qrCodeDialog.type.charAt(0).toUpperCase() + qrCodeDialog.type.slice(1)} Tour</DialogTitle>
            <DialogDescription>
              Scan this QR code to access the tour link
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="bg-white p-4 rounded-lg" id="qr-code-container">
              {qrCodeDialog.url ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeDialog.url)}`}
                  alt="QR Code"
                  className="w-64 h-64"
                  onError={(e) => {
                    console.error('Failed to load QR code image');
                    toast({
                      title: 'Error',
                      description: 'Failed to generate QR code. Please try again.',
                      variant: 'destructive',
                    });
                  }}
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-muted-foreground">
                  No URL available
                </div>
              )}
            </div>
            <div className="w-full space-y-2">
              <Input
                value={qrCodeDialog.url}
                readOnly
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(qrCodeDialog.url);
                    toast({
                      title: 'Copied',
                      description: 'Tour link copied to clipboard',
                    });
                  }}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadQrCode}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

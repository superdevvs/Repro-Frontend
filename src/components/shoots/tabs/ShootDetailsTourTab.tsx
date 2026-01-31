import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
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
  isClient?: boolean;
  onShootUpdate: () => void;
}

export function ShootDetailsTourTab({
  shoot,
  isAdmin,
  isClient = false,
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
  const [editing3DKey, setEditing3DKey] = useState<'matterport_branded' | 'matterport_mls' | 'iguide_branded' | 'iguide_mls' | 'zillow_3d' | null>(null);
  const [editing3DValue, setEditing3DValue] = useState('');
  const [isSaving3D, setIsSaving3D] = useState(false);
  const [isDeleting3D, setIsDeleting3D] = useState<'matterport_branded' | 'matterport_mls' | 'iguide_branded' | 'iguide_mls' | 'zillow_3d' | null>(null);
  
  // Video link edit state
  const [editingVideoLink, setEditingVideoLink] = useState(false);
  const [videoLinkValue, setVideoLinkValue] = useState('');
  const [isSavingVideoLink, setIsSavingVideoLink] = useState(false);
  
  // Tour style state
  const [tourStyle, setTourStyle] = useState<string>('default');
  const [isSavingTourStyle, setIsSavingTourStyle] = useState(false);
  const [embeds, setEmbeds] = useState<Array<{ id: string; title: string; branded: string; mls: string }>>([]);
  const [embedForm, setEmbedForm] = useState({ title: '', branded: '', mls: '' });
  const [editingEmbedId, setEditingEmbedId] = useState<string | null>(null);
  const [featuredEmbedId, setFeaturedEmbedId] = useState<string>('');
  const [savingEmbeds, setSavingEmbeds] = useState(false);
  const [tourSettings, setTourSettings] = useState({
    header_position: 'center',
    tour_version: 'standard',
    realtor_info: '',
    autoplay: false,
  });
  const [isSavingTourSettings, setIsSavingTourSettings] = useState(false);
  const isClientView = Boolean(isClient && !isAdmin);

  useEffect(() => {
    // Initialize tour links from shoot data
    const links: Record<string, string> = {};
    if (shoot.tourLinks) {
      links.branded = shoot.tourLinks.branded || '';
      links.mls = shoot.tourLinks.mls || '';
      links.genericMls = shoot.tourLinks.genericMls || '';
      links.matterport_branded = shoot.tourLinks.matterport_branded || shoot.tourLinks.matterport || '';
      links.matterport_mls = shoot.tourLinks.matterport_mls || '';
      links.iguide_branded = shoot.tourLinks.iguide_branded || shoot.tourLinks.iGuide || '';
      links.iguide_mls = shoot.tourLinks.iguide_mls || '';
      links.zillow_3d = shoot.tourLinks.zillow_3d || '';
      links.video_link = shoot.tourLinks.video_link || '';
    }
    setTourLinks(links);
    setVideoLinkValue(links.video_link || '');
    
    // Initialize tour style - check multiple possible locations
    const style = shoot.tourLinks?.tour_style || 
                  (shoot as any)?.tour_style || 
                  (shoot.tourLinks as any)?.tour_style || 
                  'default';
    setTourStyle(style);
    console.log('Initializing tour style:', style, 'from shoot:', { 
      tourLinks: shoot.tourLinks,
      tour_style: (shoot as any)?.tour_style 
    });

    const rawEmbeds = Array.isArray(shoot.tourLinks?.embeds)
      ? shoot.tourLinks?.embeds
      : [];
    const normalizedEmbeds = rawEmbeds.map((embed: any, index: number) => ({
      id: embed?.id || `embed-${shoot.id}-${index}`,
      title: embed?.title || `Embed ${index + 1}`,
      branded: embed?.branded || embed?.branded_embed || embed?.url || '',
      mls: embed?.mls || embed?.mls_embed || '',
    }));
    setEmbeds(normalizedEmbeds);
    const featuredId =
      (shoot.tourLinks as any)?.featured_embed_id ||
      (shoot.tourLinks as any)?.featured_embed ||
      '';
    setFeaturedEmbedId(featuredId || '');
    const tourSettingsDefaults = {
      header_position: (shoot.tourLinks as any)?.header_position || 'center',
      tour_version: (shoot.tourLinks as any)?.tour_version || 'standard',
      realtor_info: (shoot.tourLinks as any)?.realtor_info || '',
      autoplay: Boolean((shoot.tourLinks as any)?.autoplay),
    };

    setTourSettings(tourSettingsDefaults);
  }, [shoot]);

  const hasVideoLink = Boolean(tourLinks.video_link?.trim());
  const hasMatterportLinks = Boolean(tourLinks.matterport_branded || tourLinks.matterport_mls);
  const hasIguideLinks = Boolean(tourLinks.iguide_branded || tourLinks.iguide_mls);
  const hasZillow3dLink = Boolean(tourLinks.zillow_3d);
  const showVideoSection = !isClientView || hasVideoLink;
  const showTourSettings = !isClientView;
  const showPropertyInfo = !isClientView;
  const show3dTours = !isClientView || hasMatterportLinks || hasIguideLinks || hasZillow3dLink;
  const matterportKeys = ['matterport_branded', 'matterport_mls'] as const;
  const iguideKeys = ['iguide_branded', 'iguide_mls'] as const;
  const visibleMatterportKeys = isClientView
    ? matterportKeys.filter((key) => Boolean(tourLinks[key]))
    : matterportKeys;
  const visibleIguideKeys = isClientView
    ? iguideKeys.filter((key) => Boolean(tourLinks[key]))
    : iguideKeys;
  const showMatterportSection = !isClientView || visibleMatterportKeys.length > 0;
  const showIguideSection = !isClientView || visibleIguideKeys.length > 0;
  const showZillowSection = !isClientView || hasZillow3dLink;

  const getTourUrl = (type: string): string => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const shootId = shoot?.id || '';
      const address = shoot.location?.address || '';
      const city = shoot.location?.city || '';
      const state = shoot.location?.state || '';
      const zip = shoot.location?.zip || '';
      const params = new URLSearchParams();

      if (address && city && state) {
        params.set('address', address);
        params.set('city', city);
        params.set('state', state);
        if (zip) {
          params.set('zip', zip);
        }
      } else if (shootId) {
        params.set('shootId', shootId);
      }

      const query = params.toString();
      if (!query) {
        return '';
      }

      switch (type) {
        case 'branded':
          return `${baseUrl}/tour/branded?${query}`;
        case 'mls':
          return `${baseUrl}/tour/mls?${query}`;
        case 'genericMls':
          return `${baseUrl}/tour/g-mls?${query}`;
        default:
          return tourLinks[type] || '';
      }
    } catch (error) {
      console.error('Error getting tour URL:', error);
      return '';
    }
  };

  const persistTourSettings = async (nextSettings: typeof tourSettings) => {
    if (!isAdmin) return;
    setIsSavingTourSettings(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const updatedTourLinks = {
        ...(shoot.tourLinks || {}),
        header_position: nextSettings.header_position,
        tour_version: nextSettings.tour_version,
        realtor_info: nextSettings.realtor_info,
        autoplay: nextSettings.autoplay,
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
        const errorData = await res.json().catch(() => ({ message: 'Failed to save tour settings' }));
        throw new Error(errorData.message || 'Failed to save tour settings');
      }

      setTourSettings(nextSettings);
      onShootUpdate();
    } catch (err: any) {
      console.error('Save tour settings failed', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to update tour settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingTourSettings(false);
    }
  };

  const updateTourSetting = async <K extends keyof typeof tourSettings>(key: K, value: typeof tourSettings[K], persist = true) => {
    const nextSettings = { ...tourSettings, [key]: value };
    setTourSettings(nextSettings);
    if (persist) {
      await persistTourSettings(nextSettings);
    }
  };

  const isEmbedHtml = (value: string) => value.includes('<') && value.includes('>');

  const persistEmbeds = async (nextEmbeds: Array<{ id: string; title: string; branded: string; mls: string }>, nextFeaturedId: string) => {
    setSavingEmbeds(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const updatedTourLinks = {
        ...(shoot.tourLinks || {}),
        embeds: nextEmbeds,
        featured_embed_id: nextFeaturedId || null,
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
        const errorData = await res.json().catch(() => ({ message: 'Failed to save embeds' }));
        throw new Error(errorData.message || 'Failed to save embeds');
      }

      setEmbeds(nextEmbeds);
      setFeaturedEmbedId(nextFeaturedId || '');
      setEmbedForm({ title: '', branded: '', mls: '' });
      setEditingEmbedId(null);
      toast({
        title: 'Success',
        description: 'Embeds updated successfully',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Save embeds failed', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to update embeds. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingEmbeds(false);
    }
  };

  const handleSaveEmbed = async () => {
    const title = embedForm.title.trim() || `Embed ${embeds.length + 1}`;
    const branded = embedForm.branded.trim();
    const mls = embedForm.mls.trim();

    const links = [branded, mls].filter(Boolean);
    if (!links.length) {
      toast({
        title: 'Error',
        description: 'Add at least one embed link or HTML snippet.',
        variant: 'destructive',
      });
      return;
    }

    const invalidLink = links.find((link) => !isEmbedHtml(link) && !/^https?:\/\//i.test(link));
    if (invalidLink) {
      toast({
        title: 'Invalid URL',
        description: 'Embed links must start with http:// or https:// unless using HTML embed code.',
        variant: 'destructive',
      });
      return;
    }

    const embedId = editingEmbedId || `embed-${Date.now()}`;
    const nextEmbed = {
      id: embedId,
      title,
      branded,
      mls,
    };

    const nextEmbeds = editingEmbedId
      ? embeds.map((item) => (item.id === editingEmbedId ? nextEmbed : item))
      : [...embeds, nextEmbed];

    await persistEmbeds(nextEmbeds, featuredEmbedId);
  };

  const handleEditEmbed = (embed: { id: string; title: string; branded: string; mls: string }) => {
    setEditingEmbedId(embed.id);
    setEmbedForm({ title: embed.title, branded: embed.branded, mls: embed.mls });
  };

  const handleDeleteEmbed = async (embedId: string) => {
    const ok = window.confirm('Delete this embed?');
    if (!ok) return;
    const nextEmbeds = embeds.filter((item) => item.id !== embedId);
    const nextFeaturedId = embedId === featuredEmbedId ? '' : featuredEmbedId;
    await persistEmbeds(nextEmbeds, nextFeaturedId);
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
  const startEdit3D = (key: 'matterport_branded' | 'matterport_mls' | 'iguide_branded' | 'iguide_mls' | 'zillow_3d') => {
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

  // Video link management functions
  const startEditVideoLink = () => {
    setEditingVideoLink(true);
    setVideoLinkValue(tourLinks.video_link || '');
  };

  const cancelEditVideoLink = () => {
    setEditingVideoLink(false);
    setVideoLinkValue(tourLinks.video_link || '');
  };

  const saveVideoLink = async () => {
    const value = videoLinkValue.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL (must start with http:// or https://)',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSavingVideoLink(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      const updatedTourLinks = {
        ...(shoot.tourLinks || {}),
        video_link: value || null,
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
        const errorData = await res.json().catch(() => ({ message: 'Failed to save video link' }));
        throw new Error(errorData.message || 'Failed to save video link');
      }

      const updated = { ...tourLinks, video_link: value || '' };
      setTourLinks(updated);
      setEditingVideoLink(false);
      toast({
        title: 'Success',
        description: 'Video link saved successfully',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Save video link failed', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save video link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingVideoLink(false);
    }
  };

  const deleteVideoLink = async () => {
    if (!isAdmin) {
      toast({
        title: 'Permission denied',
        description: "You don't have permission to remove links",
        variant: 'destructive',
      });
      return;
    }

    const ok = window.confirm('Delete the video link? This action cannot be undone.');
    if (!ok) return;

    setIsSavingVideoLink(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      const updatedTourLinks = {
        ...(shoot.tourLinks || {}),
        video_link: null,
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
        const errorData = await res.json().catch(() => ({ message: 'Failed to delete video link' }));
        throw new Error(errorData.message || 'Failed to delete video link');
      }

      const updated = { ...tourLinks, video_link: '' };
      setTourLinks(updated);
      setVideoLinkValue('');
      toast({
        title: 'Success',
        description: 'Video link removed successfully',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Failed to delete video link', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to remove video link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingVideoLink(false);
    }
  };

  const saveTourStyle = async (style: string) => {
    setIsSavingTourStyle(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Get current tour_links from shoot, ensuring we preserve all existing data
      const currentTourLinks = shoot.tourLinks || {};
      const updatedTourLinks = {
        ...currentTourLinks,
        tour_style: style,
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
        const errorData = await res.json().catch(() => ({ message: 'Failed to save tour style' }));
        throw new Error(errorData.message || 'Failed to save tour style');
      }

      // Update local state to reflect the saved value
      const responseData = await res.json().catch(() => ({}));
      const savedShoot = responseData.data || responseData;
      if (savedShoot?.tour_links?.tour_style) {
        setTourStyle(savedShoot.tour_links.tour_style);
      }

      toast({
        title: 'Success',
        description: 'Tour style saved successfully. Refresh tour pages to see the change.',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Save tour style failed', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save tour style. Please try again.',
        variant: 'destructive',
      });
      // Revert to previous value on error
      const previousStyle = (shoot.tourLinks as any)?.tour_style || (shoot as any)?.tour_style || 'default';
      setTourStyle(previousStyle);
    } finally {
      setIsSavingTourStyle(false);
    }
  };

  const confirmDelete3D = async (key: 'matterport_branded' | 'matterport_mls' | 'iguide_branded' | 'iguide_mls' | 'zillow_3d') => {
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
    <div className="space-y-6 w-full">
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

          {showVideoSection && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <Label>Video Link (YouTube/Vimeo/Direct)</Label>
                <p className="text-xs text-muted-foreground">Add a video URL to display on tour pages. Supports YouTube, Vimeo, or direct video links.</p>
                {!editingVideoLink ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tourLinks.video_link || ''}
                      readOnly
                      placeholder="No video link set"
                      className="flex-1"
                    />
                    {tourLinks.video_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(tourLinks.video_link, '_blank')}
                        title="Open video"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startEditVideoLink}
                        title="Edit video link"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && tourLinks.video_link && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteVideoLink}
                        disabled={isSavingVideoLink}
                        title="Remove video link"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={videoLinkValue}
                      onChange={(e) => setVideoLinkValue(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                      className="flex-1"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={cancelEditVideoLink}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={saveVideoLink} disabled={isSavingVideoLink}>
                        {isSavingVideoLink ? 'Saving...' : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tour Settings Section */}
      {showTourSettings && (
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
                <Label>Tour Style</Label>
                <Select 
                  value={tourStyle} 
                  onValueChange={async (value) => {
                    // Optimistically update UI
                    setTourStyle(value);
                    // Save to backend
                    await saveTourStyle(value);
                  }}
                  disabled={isSavingTourStyle}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tour style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="neo">Neo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the visual style for tour links. Changes will apply to new tour page loads.
                </p>
                {isSavingTourStyle && (
                  <p className="text-xs text-blue-500">Saving...</p>
                )}
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Embed(s)</Label>
                  {savingEmbeds && <span className="text-xs text-blue-500">Saving...</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Add HTML embed snippets or direct URLs (iGUIDE, forms, widgets, etc.). Add as many as you need.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={embedForm.title}
                    onChange={(e) => setEmbedForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Title"
                    className="h-9 text-xs"
                    disabled={!isAdmin}
                  />
                  <Input
                    value={embedForm.branded}
                    onChange={(e) => setEmbedForm((prev) => ({ ...prev, branded: e.target.value }))}
                    placeholder="Branded Embed Link or HTML"
                    className="h-9 text-xs"
                    disabled={!isAdmin}
                  />
                  <Input
                    value={embedForm.mls}
                    onChange={(e) => setEmbedForm((prev) => ({ ...prev, mls: e.target.value }))}
                    placeholder="MLS Embed Link or HTML"
                    className="h-9 text-xs"
                    disabled={!isAdmin}
                  />
                </div>
                {isAdmin && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSaveEmbed} disabled={savingEmbeds}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {editingEmbedId ? 'Update Embed' : 'Add Embed'}
                    </Button>
                  </div>
                )}
                {embeds.length > 0 ? (
                  <div className="space-y-2">
                    {embeds.map((embed) => {
                      const hasBranded = Boolean(embed.branded);
                      const hasMls = Boolean(embed.mls);
                      const previewUrl = !isEmbedHtml(embed.branded)
                        ? embed.branded
                        : (!isEmbedHtml(embed.mls) ? embed.mls : '');
                      return (
                        <div key={embed.id} className="border rounded-lg p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                {embed.title}
                                {featuredEmbedId === embed.id && (
                                  <Badge variant="outline" className="text-[10px]">Featured</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {hasBranded && 'Branded'}{hasBranded && hasMls ? ' • ' : ''}{hasMls && 'MLS'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {previewUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(previewUrl, '_blank')}
                                  title="Open embed"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="ghost" size="sm" onClick={() => handleEditEmbed(embed)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteEmbed(embed.id)}>
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No embeds added yet.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Feature Embed</Label>
                <Select
                  value={featuredEmbedId || 'none'}
                  onValueChange={async (value) => {
                    const nextValue = value === 'none' ? '' : value;
                    setFeaturedEmbedId(nextValue);
                    if (isAdmin) {
                      await persistEmbeds(embeds, nextValue);
                    }
                  }}
                  disabled={!isAdmin || savingEmbeds}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select featured embed" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {embeds.map((embed) => (
                      <SelectItem key={embed.id} value={embed.id}>
                        {embed.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Featured embed can be highlighted at the top of tour pages.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Header Position</Label>
                  {isSavingTourSettings && <span className="text-xs text-blue-500">Saving...</span>}
                </div>
                <Select
                  value={tourSettings.header_position}
                  onValueChange={async (value) => updateTourSetting('header_position', value)}
                  disabled={!isAdmin || isSavingTourSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select header position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Controls where the headline sits on the hero banner.</p>
              </div>
              <div className="space-y-2">
                <Label>Tour Version</Label>
                <Select
                  value={tourSettings.tour_version}
                  onValueChange={async (value) => updateTourSetting('tour_version', value)}
                  disabled={!isAdmin || isSavingTourSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="legacy">Legacy</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Use this label to distinguish published variants.</p>
              </div>
              <div className="space-y-2">
                <Label>Realtor(s)</Label>
                <Textarea
                  value={tourSettings.realtor_info}
                  onChange={(e) => updateTourSetting('realtor_info', e.target.value, false)}
                  onBlur={async () => updateTourSetting('realtor_info', tourSettings.realtor_info)}
                  placeholder="Add agent names, phone numbers, or notes"
                  disabled={!isAdmin}
                  className="min-h-[90px]"
                />
                <p className="text-xs text-muted-foreground">Displayed in contact sections on public tour pages.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <Label>Autoplay</Label>
                  <p className="text-xs text-muted-foreground">Starts tour videos automatically (muted).</p>
                </div>
                <Switch
                  checked={tourSettings.autoplay}
                  onCheckedChange={async (checked) => updateTourSetting('autoplay', checked)}
                  disabled={!isAdmin || isSavingTourSettings}
                />
              </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Property Info Section */}
      {showPropertyInfo && (
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
      )}

      {/* 3D Tours Section */}
      {show3dTours && (
        <Card>
          <CardHeader>
            <CardTitle>3D Tours</CardTitle>
            <CardDescription>Manage Matterport and iGuide links with branded and MLS options.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Matterport Section */}
            {showMatterportSection && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Matterport</h4>
                {visibleMatterportKeys.map((key) => {
                  const label = key === 'matterport_branded' ? 'Matterport Branded Link' : 'Matterport MLS Link';
                  const url = tourLinks[key] || '';
                  const isEditing = editing3DKey === key;

                  return (
                    <div key={key} className="border rounded-lg p-3 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-muted-foreground">—</div>
                          <div>
                            <div className="font-medium text-sm">{label}</div>
                            <div className="text-xs text-muted-foreground">{url || 'Not set'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {url && !isEditing && (
                            <Button variant="ghost" size="sm" onClick={() => window.open(url, '_blank')}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isEditing && isAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => startEdit3D(key)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {!isEditing && isAdmin && url && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => confirmDelete3D(key)}
                              disabled={isDeleting3D === key}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
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
                              {isSaving3D ? 'Saving...' : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* iGuide Section */}
            {showIguideSection && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">iGuide</h4>
                {visibleIguideKeys.map((key) => {
                  const label = key === 'iguide_branded' ? 'iGuide Branded Link' : 'iGuide MLS Link';
                  const url = tourLinks[key] || '';
                  const isEditing = editing3DKey === key;

                  return (
                    <div key={key} className="border rounded-lg p-3 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-muted-foreground">—</div>
                          <div>
                            <div className="font-medium text-sm">{label}</div>
                            <div className="text-xs text-muted-foreground">{url || 'Not set'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {url && !isEditing && (
                            <Button variant="ghost" size="sm" onClick={() => window.open(url, '_blank')}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isEditing && isAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => startEdit3D(key)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {!isEditing && isAdmin && url && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => confirmDelete3D(key)}
                              disabled={isDeleting3D === key}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
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
                              {isSaving3D ? 'Saving...' : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Zillow 3D Section */}
            {showZillowSection && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Zillow 3D</h4>
                {(() => {
                  const key = 'zillow_3d' as const;
                  const label = 'Zillow 3D Home Tour';
                  const url = tourLinks[key] || '';
                  const isEditing = editing3DKey === key;

                  return (
                    <div key={key} className="border rounded-lg p-3 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-muted-foreground">—</div>
                          <div>
                            <div className="font-medium text-sm">{label}</div>
                            <div className="text-xs text-muted-foreground">{url || 'Not set'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {url && !isEditing && (
                            <Button variant="ghost" size="sm" onClick={() => window.open(url, '_blank')}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isEditing && isAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => startEdit3D(key)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {!isEditing && isAdmin && url && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => confirmDelete3D(key)}
                              disabled={isDeleting3D === key}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
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
                              {isSaving3D ? 'Saving...' : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

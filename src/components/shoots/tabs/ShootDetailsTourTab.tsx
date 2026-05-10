import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Share2, QrCode, Edit, Trash, Check, X, Plus } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import {
  getNormalizedIguideSync,
  getRawPropertyDetails,
  getRawTourLinks,
  normalizePropertyDetails,
  normalizeTourLinks,
} from '@/utils/shootTourData';
import { ShootTourPropertySection } from '@/components/shoots/tabs/ShootTourPropertySection';
import { ShootTourRealtorPicker, type TourRealtorOption } from '@/components/shoots/tabs/ShootTourRealtorPicker';
import { ShootDetailsTourTabView } from '@/components/shoots/tabs/ShootDetailsTourTabView';
import { useShootTourPropertyEditor } from '@/components/shoots/tabs/useShootTourPropertyEditor';
interface ShootDetailsTourTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isRep?: boolean;
  isClient?: boolean;
  isClientReleaseLocked?: boolean;
  onShootUpdate: () => void;
  onShowAnalytics?: () => void;
}
type Managed3DLinkKey =
  | 'matterport_branded'
  | 'matterport_mls'
  | 'iguide_branded'
  | 'iguide_mls'
  | 'zillow_3d';
type ManagedVideoLinkKey =
  | 'video_link'
  | 'video_branded'
  | 'video_mls'
  | 'video_generic';
export function ShootDetailsTourTab({
  shoot,
  isAdmin,
  isRep = false,
  isClient = false,
  isClientReleaseLocked = false,
  onShootUpdate,
  onShowAnalytics,
}: ShootDetailsTourTabProps) {
  const { toast } = useToast();
  const [tourLinks, setTourLinks] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    links: true,
    settings: false,
    property: Boolean(isClient && !isAdmin),
  });
  const [qrCodeDialog, setQrCodeDialog] = useState<{ open: boolean; type: string; url: string }>({
    open: false,
    type: '',
    url: '',
  });
  // 3D tour edit state
  const [editing3DKey, setEditing3DKey] = useState<Managed3DLinkKey | null>(null);
  const [editing3DValue, setEditing3DValue] = useState('');
  const [isSaving3D, setIsSaving3D] = useState(false);
  const [isDeleting3D, setIsDeleting3D] = useState<Managed3DLinkKey | null>(null);
  // Video link edit state
  const [editingVideoLinkKey, setEditingVideoLinkKey] = useState<ManagedVideoLinkKey | null>(null);
  const [videoLinkValue, setVideoLinkValue] = useState('');
  const [isSavingVideoLinkKey, setIsSavingVideoLinkKey] = useState<ManagedVideoLinkKey | null>(null);
  const [isDeletingVideoLinkKey, setIsDeletingVideoLinkKey] = useState<ManagedVideoLinkKey | null>(null);
  // Tour style state
  const [tourStyle, setTourStyle] = useState<string>('default');
  const [isSavingTourStyle, setIsSavingTourStyle] = useState(false);
  const [embeds, setEmbeds] = useState<Array<{ id: string; title: string; branded: string; mls: string }>>([]);
  const [embedForm, setEmbedForm] = useState({ title: '', branded: '', mls: '' });
  const [editingEmbedId, setEditingEmbedId] = useState<string | null>(null);
  const [featuredEmbedId, setFeaturedEmbedId] = useState<string>('');
  const [savingEmbeds, setSavingEmbeds] = useState(false);
  const [realtorClients, setRealtorClients] = useState<TourRealtorOption[]>([]);
  const [isLoadingRealtorClients, setIsLoadingRealtorClients] = useState(false);
  const [realtorSearchOpen, setRealtorSearchOpen] = useState(false);
  const [tourSettings, setTourSettings] = useState({
    header_position: 'center',
    tour_version: 'standard',
    realtor_info: '',
    realtor_client_id: '',
    autoplay: false,
    show_garage: false,
  });
  const [isSavingTourSettings, setIsSavingTourSettings] = useState(false);
  // iGuide identifier inputs (admin-only) and one-shot sync action.
  const [iguidePropertyIdInput, setIguidePropertyIdInput] = useState<string>('');
  const [iguideWorkOrderIdInput, setIguideWorkOrderIdInput] = useState<string>('');
  const [isSavingIguideIdentifiers, setIsSavingIguideIdentifiers] = useState(false);
  const [isSyncingIguide, setIsSyncingIguide] = useState(false);
  const sourceTourLinks = useMemo(
    () => getRawTourLinks(shoot as any) as Record<string, any>,
    [(shoot as any)?.tourLinks, (shoot as any)?.tour_links],
  );
  const sourcePropertyDetails = useMemo(
    () => getRawPropertyDetails(shoot as any) as Record<string, any>,
    [(shoot as any)?.propertyDetails, (shoot as any)?.property_details],
  );
  const normalizedTourLinks = useMemo(
    () => normalizeTourLinks(shoot as any),
    [(shoot as any)?.tourLinks, (shoot as any)?.tour_links],
  );
  const normalizedPropertyDetails = useMemo(
    () => normalizePropertyDetails(shoot as any),
    [
      (shoot as any)?.propertyDetails,
      (shoot as any)?.property_details,
      (shoot as any)?.bedrooms,
      (shoot as any)?.bedRooms,
      (shoot as any)?.bathrooms,
      (shoot as any)?.bathRooms,
      (shoot as any)?.sqft,
      (shoot as any)?.squareFeet,
      (shoot as any)?.square_feet,
    ],
  );
  const iguideSync = useMemo(
    () => getNormalizedIguideSync(shoot as any),
    [
      (shoot as any)?.tourLinks,
      (shoot as any)?.tour_links,
      (shoot as any)?.iguideTourUrl,
      (shoot as any)?.iguide_tour_url,
      (shoot as any)?.iguideFloorplans,
      (shoot as any)?.iguide_floorplans,
      (shoot as any)?.iguidePropertyId,
      (shoot as any)?.iguide_property_id,
      (shoot as any)?.iguideWorkOrderId,
      (shoot as any)?.iguide_work_order_id,
      (shoot as any)?.iguideLastSyncedAt,
      (shoot as any)?.iguide_last_synced_at,
      (shoot as any)?.iguideData,
      (shoot as any)?.iguide_data,
    ],
  );
  const {
    isClientView,
    canEditPropertyInfo,
    propertyDescription,
    setPropertyDescription,
    isSavingDescription,
    isGeneratingDescription,
    propertyMls,
    setPropertyMls,
    propertyPrice,
    setPropertyPrice,
    propertyLotSize,
    setPropertyLotSize,
    propertyBedrooms,
    setPropertyBedrooms,
    propertyBathrooms,
    setPropertyBathrooms,
    propertySqft,
    setPropertySqft,
    listingType,
    propertyStatus,
    setPropertyStatus,
    isSavingPropertyStatus,
    setIsSavingPropertyStatus,
    isSavingPropertyDetails,
    savePropertyField,
    savePropertyDetails,
    saveShootField,
    handleGenerateDescription,
    handleSaveDescription,
  } = useShootTourPropertyEditor({
    shoot,
    isAdmin,
    isClient,
    onShootUpdate,
    sourceTourLinks,
    sourcePropertyDetails,
    normalizedPropertyDetails,
  });
  useEffect(() => {
    if (isClientView) {
      setOpenSections((prev) => ({
        ...prev,
        property: true,
      }));
    }
  }, [isClientView]);
  const initialTourState = useMemo(() => {
    const style =
      sourceTourLinks?.tour_style ||
      (shoot as any)?.tour_style ||
      'default';
    const rawEmbeds = Array.isArray(sourceTourLinks?.embeds)
      ? sourceTourLinks?.embeds
      : [];
    const normalizedEmbeds = rawEmbeds.map((embed: any, index: number) => ({
      id: embed?.id || `embed-${shoot.id}-${index}`,
      title: embed?.title || `Embed ${index + 1}`,
      branded: embed?.branded || embed?.branded_embed || embed?.url || '',
      mls: embed?.mls || embed?.mls_embed || '',
    }));
    const featuredId =
      sourceTourLinks?.featured_embed_id ||
      sourceTourLinks?.featured_embed ||
      '';

    return {
      links: {
        branded: normalizedTourLinks.branded,
        mls: normalizedTourLinks.mls,
        genericMls: normalizedTourLinks.genericMls,
        matterport_branded: normalizedTourLinks.matterport_branded,
        matterport_mls: normalizedTourLinks.matterport_mls,
        iguide_branded: normalizedTourLinks.iguide_branded,
        iguide_mls: normalizedTourLinks.iguide_mls,
        zillow_3d: normalizedTourLinks.zillow_3d,
        video_link: normalizedTourLinks.video_link,
        video_branded: normalizedTourLinks.video_branded,
        video_mls: normalizedTourLinks.video_mls,
        video_generic: normalizedTourLinks.video_generic,
      },
      style,
      embeds: normalizedEmbeds,
      featuredEmbedId: featuredId || '',
      settings: {
        header_position: sourceTourLinks?.header_position || 'center',
        tour_version: sourceTourLinks?.tour_version || 'standard',
        realtor_info: sourceTourLinks?.realtor_info || '',
        realtor_client_id: normalizedTourLinks.realtor_client_id || '',
        autoplay: Boolean(sourceTourLinks?.autoplay),
        show_garage: Boolean(sourceTourLinks?.show_garage),
      },
    };
  }, [normalizedTourLinks, shoot.id, sourceTourLinks, (shoot as any)?.tour_style]);

  const initialTourStateKey = useMemo(
    () => JSON.stringify(initialTourState),
    [initialTourState],
  );

  useEffect(() => {
    setTourLinks((prev) =>
      JSON.stringify(prev) === JSON.stringify(initialTourState.links)
        ? prev
        : initialTourState.links,
    );
    setVideoLinkValue((prev) => (prev === '' ? prev : ''));
    setTourStyle((prev) => (prev === initialTourState.style ? prev : initialTourState.style));
    setEmbeds((prev) =>
      JSON.stringify(prev) === JSON.stringify(initialTourState.embeds)
        ? prev
        : initialTourState.embeds,
    );
    setFeaturedEmbedId((prev) =>
      prev === initialTourState.featuredEmbedId ? prev : initialTourState.featuredEmbedId,
    );
    setTourSettings((prev) =>
      JSON.stringify(prev) === JSON.stringify(initialTourState.settings)
        ? prev
        : initialTourState.settings,
    );
  }, [initialTourStateKey]);
  useEffect(() => {
    if (!(isAdmin || isRep)) return;

    let isActive = true;

    const fetchClients = async () => {
      setIsLoadingRealtorClients(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/clients`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to load clients');
        }

        const json = await response.json();
        const clientsList = (json.data || json || []).map((client: any) => ({
          id: String(client.id),
          name: client.name || 'Client',
          email: client.email || '',
          company: client.company_name || client.company || '',
        }));
        const currentRealtor = normalizedTourLinks.realtor_client;
        if (
          currentRealtor?.id &&
          !clientsList.some((client: TourRealtorOption) => client.id === String(currentRealtor.id))
        ) {
          clientsList.unshift({
            id: String(currentRealtor.id),
            name: currentRealtor.name || 'Assigned realtor',
            email: currentRealtor.email || '',
            company: currentRealtor.company || '',
          });
        }

        if (isActive) {
          setRealtorClients(clientsList);
        }
      } catch (error) {
        console.error('Error fetching realtor clients:', error);
        if (isActive) {
          toast({
            title: 'Error',
            description: 'Failed to load realtor clients.',
            variant: 'destructive',
          });
        }
      } finally {
        if (isActive) {
          setIsLoadingRealtorClients(false);
        }
      }
    };

    void fetchClients();

    return () => {
      isActive = false;
    };
  }, [isAdmin, isRep, normalizedTourLinks.realtor_client, toast]);
  const hasVideoEmbedLink = Boolean(tourLinks.video_link?.trim());
  const hasPublicVideoLinks = Boolean(
    tourLinks.video_branded?.trim() || tourLinks.video_mls?.trim() || tourLinks.video_generic?.trim()
  );
  const hasMatterportLinks = Boolean(tourLinks.matterport_branded || tourLinks.matterport_mls);
  const hasIguideLinks = Boolean(tourLinks.iguide_branded || tourLinks.iguide_mls);
  const hasZillow3dLink = Boolean(tourLinks.zillow_3d);
  const showVideoLinksSection = Boolean(isAdmin || isClientView || hasPublicVideoLinks);
  const showVideoEmbedSection = Boolean(isAdmin);
  const showTourSettings = !isClientView;
  const canManageRealtor = isAdmin || isRep;
  const showPropertyInfo = Boolean(isAdmin || isClientView);
  const show3dTours = !isClientView || hasMatterportLinks || hasIguideLinks || hasZillow3dLink;
  const matterportKeys = ['matterport_branded', 'matterport_mls'] as const;
  const iguideKeys = ['iguide_branded', 'iguide_mls'] as const;
  const publicVideoLinkConfigs: Array<{ key: ManagedVideoLinkKey; label: string; placeholder: string }> = [
    {
      key: 'video_branded',
      label: 'Branded Video',
      placeholder: 'No branded video link set',
    },
    {
      key: 'video_mls',
      label: 'MLS Video',
      placeholder: 'No MLS video link set',
    },
    {
      key: 'video_generic',
      label: 'Generic Video',
      placeholder: 'No generic video link set',
    },
  ];
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
      if (!shootId) {
        return '';
      }
      const query = `shootId=${encodeURIComponent(shootId)}`;
      switch (type) {
        case 'branded':
          return `${baseUrl}/tour/branded?${query}`;
        case 'mls':
          return `${baseUrl}/tour/mls?${query}`;
        case 'genericMls':
          return `${baseUrl}/tour/g-mls?${query}`;
        case 'video_branded':
          return `${baseUrl}/tour/video/branded?${query}`;
        case 'video_mls':
          return `${baseUrl}/tour/video/mls?${query}`;
        case 'video_generic':
          return `${baseUrl}/tour/video/generic?${query}`;
        default:
          return tourLinks[type] || '';
      }
    } catch (error) {
      console.error('Error getting tour URL:', error);
      return '';
    }
  };
  const getSavedTourLinksFromResponse = (payload: any): Record<string, any> => {
    const savedShoot = payload?.data ?? payload;
    return getRawTourLinks(savedShoot as any) as Record<string, any>;
  };
  const persistTourSettings = async (nextSettings: typeof tourSettings) => {
    if (!isAdmin) return;
    setIsSavingTourSettings(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const updatedTourLinks = {
        ...sourceTourLinks,
        header_position: nextSettings.header_position,
        tour_version: nextSettings.tour_version,
        realtor_info: nextSettings.realtor_info,
        realtor_client_id: nextSettings.realtor_client_id || null,
        autoplay: nextSettings.autoplay,
        show_garage: nextSettings.show_garage,
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
  const persistRealtorClient = async (nextClientId: string) => {
    if (!canManageRealtor) return false;

    setIsSavingTourSettings(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          tour_links: {
            realtor_client_id: nextClientId || null,
          },
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save realtor' }));
        throw new Error(errorData.message || 'Failed to save realtor');
      }
      await onShootUpdate();
      return true;
    } catch (err: any) {
      console.error('Save realtor failed', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to update realtor. Please try again.',
        variant: 'destructive',
      });
      return false;
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
  const selectedRealtorClient =
    realtorClients.find((client) => client.id === tourSettings.realtor_client_id)
    || normalizedTourLinks.realtor_client
    || null;
  const handleRealtorClientChange = async (clientId: string) => {
    const previousClientId = tourSettings.realtor_client_id;
    if (clientId === previousClientId) {
      setRealtorSearchOpen(false);
      return;
    }

    setTourSettings((prev) => ({
      ...prev,
      realtor_client_id: clientId,
    }));

    const saved = await persistRealtorClient(clientId);
    if (!saved) {
      setTourSettings((prev) => ({
        ...prev,
        realtor_client_id: previousClientId,
      }));
      return;
    }

    setRealtorSearchOpen(false);
  };
  const isEmbedHtml = (value: string) => value.includes('<') && value.includes('>');
  const persistEmbeds = async (nextEmbeds: Array<{ id: string; title: string; branded: string; mls: string }>, nextFeaturedId: string) => {
    setSavingEmbeds(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const updatedTourLinks = {
        ...sourceTourLinks,
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
  const startEdit3D = (key: Managed3DLinkKey) => {
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
        ...sourceTourLinks,
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
  const startEditVideoLink = (key: ManagedVideoLinkKey) => {
    setEditingVideoLinkKey(key);
    setVideoLinkValue(tourLinks[key] || '');
  };
  const cancelEditVideoLink = () => {
    setEditingVideoLinkKey(null);
    setVideoLinkValue('');
  };
  const saveVideoLink = async () => {
    if (!editingVideoLinkKey) return;
    const value = videoLinkValue.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL (must start with http:// or https://)',
        variant: 'destructive',
      });
      return;
    }
    setIsSavingVideoLinkKey(editingVideoLinkKey);
    try {
      const linkKey = editingVideoLinkKey;
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const nextTourLinks = {
        ...sourceTourLinks,
        ...tourLinks,
        [linkKey]: value || null,
      };
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          tour_links: nextTourLinks,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save video link' }));
        throw new Error(errorData.message || 'Failed to save video link');
      }
      const responseData = await res.json().catch(() => ({}));
      const savedTourLinks = getSavedTourLinksFromResponse(responseData);
      const savedValue = String(savedTourLinks?.[linkKey] ?? '').trim();
      if (savedValue !== value) {
        throw new Error('The video link was not persisted. Please refresh and try again.');
      }
      const updated = { ...tourLinks, ...savedTourLinks, [linkKey]: savedValue };
      setTourLinks(updated);
      setEditingVideoLinkKey(null);
      setVideoLinkValue('');
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
      setIsSavingVideoLinkKey(null);
    }
  };
  const deleteVideoLink = async (key: ManagedVideoLinkKey) => {
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
    setIsDeletingVideoLinkKey(key);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const nextTourLinks = {
        ...sourceTourLinks,
        ...tourLinks,
        [key]: null,
      };
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          tour_links: nextTourLinks,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to delete video link' }));
        throw new Error(errorData.message || 'Failed to delete video link');
      }
      const responseData = await res.json().catch(() => ({}));
      const savedTourLinks = getSavedTourLinksFromResponse(responseData);
      const savedValue = String(savedTourLinks?.[key] ?? '').trim();
      if (savedValue !== '') {
        throw new Error('The video link was not removed. Please refresh and try again.');
      }
      const updated = { ...tourLinks, ...savedTourLinks, [key]: '' };
      setTourLinks(updated);
      if (editingVideoLinkKey === key) {
        setEditingVideoLinkKey(null);
        setVideoLinkValue('');
      }
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
      setIsDeletingVideoLinkKey(null);
    }
  };
  const saveTourStyle = async (style: string) => {
    setIsSavingTourStyle(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      // Preserve the full existing tour_links payload while updating the style value.
      const currentTourLinks = sourceTourLinks;
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
  const confirmDelete3D = async (key: Managed3DLinkKey) => {
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
        ...sourceTourLinks,
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
  // Initialize iGuide identifier inputs from server-provided values.
  useEffect(() => {
    setIguidePropertyIdInput((prev) => (prev === iguideSync.propertyId ? prev : iguideSync.propertyId || ''));
    setIguideWorkOrderIdInput((prev) => (prev === iguideSync.workOrderId ? prev : iguideSync.workOrderId || ''));
  }, [iguideSync.propertyId, iguideSync.workOrderId]);

  const saveIguideIdentifiers = async () => {
    if (!isAdmin) return;
    setIsSavingIguideIdentifiers(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          iguide_property_id: iguidePropertyIdInput.trim() || null,
          iguide_work_order_id: iguideWorkOrderIdInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save iGuide identifiers' }));
        throw new Error(errorData.message || 'Failed to save iGuide identifiers');
      }
      toast({
        title: 'Saved',
        description: 'iGuide identifiers updated. Webhooks will now match this shoot.',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Save iGuide identifiers failed', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save iGuide identifiers.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingIguideIdentifiers(false);
    }
  };

  const syncIguideNow = async () => {
    setIsSyncingIguide(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/integrations/shoots/${shoot.id}/iguide/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const json = await res.json().catch(() => ({}));
      // 409 + mode=webhook-only is an expected state for App-Token auth: the
      // Portal blocks signed apps from on-demand reads, but data still flows
      // automatically when iGuide publishes the tour and fires the webhook.
      if (json?.mode === 'webhook-only') {
        toast({
          title: 'Auto-sync via webhook',
          description:
            'Manual fetch isn\'t supported with this iGuide token. Data will fill in automatically when the iGuide is published.',
        });
        return;
      }
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || 'iGuide sync failed');
      }
      const queued = Number(json?.queued_assets ?? 0);
      toast({
        title: 'iGuide synced',
        description: queued > 0
          ? `Pulled ${queued} deliverable(s) from youriguide.com.`
          : 'iGuide metadata refreshed.',
      });
      onShootUpdate();
    } catch (err: any) {
      console.error('Sync iGuide failed', err);
      toast({
        title: 'iGuide sync failed',
        description: err?.message || 'No matching iGuide was found for this shoot.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingIguide(false);
    }
  };

  const renderLinkActionButtons = (
    type: string,
    options?: {
      editable?: boolean;
      onEdit?: () => void;
      deletable?: boolean;
      onDelete?: () => void;
      deleting?: boolean;
      editTitle?: string;
      deleteTitle?: string;
    },
  ) => {
    const hasValue = Boolean(getTourUrl(type)?.trim());
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyLink(type)}
          title="Copy link"
          disabled={!hasValue}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openLink(type)}
          title="Open in new tab"
          disabled={!hasValue}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => shareLink(type)}
          title="Share link"
          disabled={!hasValue}
        >
          <Share2 className="h-4 w-4" />
        </Button>
        {options?.editable && options.onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={options.onEdit}
            title={options.editTitle || 'Edit link'}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {options?.deletable && options.onDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={options.onDelete}
            disabled={options.deleting}
            title={options.deleteTitle || 'Remove link'}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </>
    );
  };
  return (
    <ShootDetailsTourTabView
      isClientReleaseLocked={isClientReleaseLocked}
      onShowAnalytics={onShowAnalytics}
      getTourUrl={getTourUrl}
      copyLink={copyLink}
      openLink={openLink}
      shareLink={shareLink}
      getQrCode={getQrCode}
      showVideoLinksSection={showVideoLinksSection}
      showVideoEmbedSection={showVideoEmbedSection}
      showTourSettings={showTourSettings}
      show3dTours={show3dTours}
      showMatterportSection={showMatterportSection}
      showIguideSection={showIguideSection}
      showZillowSection={showZillowSection}
      publicVideoLinkConfigs={publicVideoLinkConfigs}
      editingVideoLinkKey={editingVideoLinkKey}
      videoLinkValue={videoLinkValue}
      setVideoLinkValue={setVideoLinkValue}
      isSavingVideoLinkKey={isSavingVideoLinkKey}
      isDeletingVideoLinkKey={isDeletingVideoLinkKey}
      startEditVideoLink={startEditVideoLink}
      cancelEditVideoLink={cancelEditVideoLink}
      saveVideoLink={saveVideoLink}
      deleteVideoLink={deleteVideoLink}
      tourLinks={tourLinks}
      isAdmin={isAdmin}
      openSections={openSections}
      toggleSection={toggleSection}
      tourStyle={tourStyle}
      setTourStyle={setTourStyle}
      saveTourStyle={saveTourStyle}
      isSavingTourStyle={isSavingTourStyle}
      embeds={embeds}
      embedForm={embedForm}
      setEmbedForm={setEmbedForm}
      editingEmbedId={editingEmbedId}
      featuredEmbedId={featuredEmbedId}
      setFeaturedEmbedId={setFeaturedEmbedId}
      savingEmbeds={savingEmbeds}
      handleSaveEmbed={handleSaveEmbed}
      handleEditEmbed={handleEditEmbed}
      handleDeleteEmbed={handleDeleteEmbed}
      persistEmbeds={persistEmbeds}
      isEmbedHtml={isEmbedHtml}
      tourSettings={tourSettings}
      updateTourSetting={updateTourSetting}
      isSavingTourSettings={isSavingTourSettings}
      realtorPicker={
        <ShootTourRealtorPicker
          options={realtorClients}
          selectedClientId={tourSettings.realtor_client_id}
          selectedClient={selectedRealtorClient}
          open={realtorSearchOpen}
          onOpenChange={setRealtorSearchOpen}
          onSelect={(clientId) => {
            void handleRealtorClientChange(clientId);
          }}
          isLoading={isLoadingRealtorClients}
          isSaving={isSavingTourSettings}
          disabled={!canManageRealtor || isLoadingRealtorClients}
        />
      }
      propertySection={
        <ShootTourPropertySection
          showPropertyInfo={showPropertyInfo}
          open={openSections.property}
          onOpenChange={() => toggleSection('property')}
          listingType={listingType}
          propertyStatus={propertyStatus}
          setPropertyStatus={setPropertyStatus}
          canEditPropertyInfo={canEditPropertyInfo}
          isSavingPropertyStatus={isSavingPropertyStatus}
          setIsSavingPropertyStatus={setIsSavingPropertyStatus}
          propertyBedrooms={propertyBedrooms}
          setPropertyBedrooms={setPropertyBedrooms}
          propertyBathrooms={propertyBathrooms}
          setPropertyBathrooms={setPropertyBathrooms}
          propertySqft={propertySqft}
          setPropertySqft={setPropertySqft}
          isSavingPropertyDetails={isSavingPropertyDetails}
          propertyDescription={propertyDescription}
          setPropertyDescription={setPropertyDescription}
          isGeneratingDescription={isGeneratingDescription}
          isSavingDescription={isSavingDescription}
          propertyMls={propertyMls}
          setPropertyMls={setPropertyMls}
          propertyPrice={propertyPrice}
          setPropertyPrice={setPropertyPrice}
          propertyLotSize={propertyLotSize}
          setPropertyLotSize={setPropertyLotSize}
          sourcePropertyDescription={(sourceTourLinks as any)?.property_description || ''}
          saveShootField={saveShootField}
          savePropertyDetails={savePropertyDetails}
          savePropertyField={savePropertyField}
          handleGenerateDescription={handleGenerateDescription}
          handleSaveDescription={handleSaveDescription}
        />
      }
      visibleMatterportKeys={visibleMatterportKeys}
      visibleIguideKeys={visibleIguideKeys}
      editing3DKey={editing3DKey}
      editing3DValue={editing3DValue}
      setEditing3DValue={setEditing3DValue}
      isSaving3D={isSaving3D}
      isDeleting3D={isDeleting3D}
      startEdit3D={startEdit3D}
      cancelEdit3D={cancelEdit3D}
      save3DTour={save3DTour}
      confirmDelete3D={confirmDelete3D}
      renderLinkActionButtons={renderLinkActionButtons}
      iguideSync={iguideSync}
      iguidePropertyIdInput={iguidePropertyIdInput}
      setIguidePropertyIdInput={setIguidePropertyIdInput}
      iguideWorkOrderIdInput={iguideWorkOrderIdInput}
      setIguideWorkOrderIdInput={setIguideWorkOrderIdInput}
      saveIguideIdentifiers={saveIguideIdentifiers}
      isSavingIguideIdentifiers={isSavingIguideIdentifiers}
      syncIguideNow={syncIguideNow}
      isSyncingIguide={isSyncingIguide}
      qrCodeDialog={qrCodeDialog}
      onQrDialogOpenChange={(open: boolean) => setQrCodeDialog({ ...qrCodeDialog, open })}
      onQrImageError={() => {
        console.error('Failed to load QR code image');
        toast({
          title: 'Error',
          description: 'Failed to generate QR code. Please try again.',
          variant: 'destructive',
        });
      }}
      onCopyQrDialogLink={() => {
        navigator.clipboard.writeText(qrCodeDialog.url);
        toast({
          title: 'Copied',
          description: 'Tour link copied to clipboard',
        });
      }}
      downloadQrCode={downloadQrCode}
    />
  );
}

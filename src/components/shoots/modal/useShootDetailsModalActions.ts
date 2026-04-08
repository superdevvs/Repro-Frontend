import { useState } from 'react';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import {
  downloadShootMediaArchive,
  getShootMediaDownloadSizeLabel,
} from '@/utils/shootMediaDownload';
import {
  buildBrightMlsPublishPayloadWithFallback,
} from '@/utils/brightMls';

interface ToastApi {
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
  }) => void;
}

interface UseShootDetailsModalActionsOptions {
  shoot: ShootData | null;
  isPhotographer: boolean;
  refreshShoot: () => Promise<ShootData | null>;
  toast: ToastApi['toast'];
}

export function useShootDetailsModalActions({
  shoot,
  isPhotographer,
  refreshShoot,
  toast,
}: UseShootDetailsModalActionsOptions) {
  const [isPublishingToBrightMls, setIsPublishingToBrightMls] = useState(false);
  const [brightMlsRedirectUrl, setBrightMlsRedirectUrl] = useState<string | null>(null);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
  const [printComingSoonOpen, setPrintComingSoonOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const handleSendToBrightMls = async () => {
    if (!shoot) return;

    try {
      setIsPublishingToBrightMls(true);
      setBrightMlsRedirectUrl(null);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');

      const payload = await buildBrightMlsPublishPayloadWithFallback(
        shoot as ShootData & Record<string, unknown>,
        token,
      );
      if (payload.photos.length === 0) {
        throw new Error('No images found to send. Please ensure the shoot has completed images.');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/integrations/shoots/${shoot.id}/bright-mls/publish`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        const errorMessage =
          errorData.message ||
          (errorData.errors ? JSON.stringify(errorData.errors) : null) ||
          'Failed to send images to Bright MLS';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const redirectUrl = result.data?.redirect_url || result.redirect_url;
      setBrightMlsRedirectUrl(redirectUrl || null);

      toast({
        title: 'Manifest Sent',
        description: 'Bright MLS opened in the internal popup. Complete the import there.',
      });

      await refreshShoot();
    } catch (error) {
      console.error('Error sending images to Bright MLS:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to send images to Bright MLS. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishingToBrightMls(false);
    }
  };

  const handleEditorDownloadRaw = async () => {
    if (!shoot) return;

    try {
      setIsDownloading(true);
      const headers = getApiHeaders();
      headers.Accept = 'application/json, application/zip';
      const queryParams = new URLSearchParams();
      if (selectedFileIds.length > 0) {
        queryParams.set('file_ids', selectedFileIds.join(','));
      }
      const queryString = queryParams.toString();

      const res = await fetch(
        `${API_BASE_URL}/api/shoots/${shoot.id}/editor-download-raw${queryString ? `?${queryString}` : ''}`,
        {
          method: 'GET',
          headers,
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.type === 'redirect' && data.url) {
          window.open(data.url, '_blank');
          toast({
            title: 'Download started',
            description:
              data.message || 'Raw files downloading. Switch to Edited tab to upload your edits.',
          });
        }
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `shoot-${shoot.id}-raw-files-${Date.now()}.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Download started',
          description: 'Raw files downloaded. Switch to Edited tab to upload your edits.',
        });
      }
    } catch (error) {
      console.error('Error downloading raw files:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to download raw files.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!shoot) return;

    try {
      setIsGeneratingShareLink(true);
      const headers = getApiHeaders();
      headers.Accept = 'application/json';
      headers['Content-Type'] = 'application/json';

      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/generate-share-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_ids: selectedFileIds,
          media_stage: 'raw',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate share link' }));
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data = await res.json();
      await navigator.clipboard.writeText(data.share_link);

      toast({
        title: 'Share link generated!',
        description: 'Link copied to clipboard. Lifetime link.',
      });

      await refreshShoot();
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate share link.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingShareLink(false);
    }
  };

  const handleDownloadMedia = async (size: 'original' | 'small' | 'medium' | 'large') => {
    if (!shoot) return;

    try {
      setIsDownloading(true);
      setIsDownloadDialogOpen(false);
      const downloadType = isPhotographer ? 'raw' : 'edited';
      const result = await downloadShootMediaArchive({
        shootId: shoot.id,
        type: downloadType,
        size,
        address: shoot.location?.address,
      });
      toast({
        title: 'Download started',
        description:
          result.mode === 'redirect'
            ? 'Opening download link in new tab...'
            : `Downloading media files in ${getShootMediaDownloadSizeLabel(size)}...`,
      });
    } catch (error) {
      console.error('Error downloading media:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download media. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    isPublishingToBrightMls,
    brightMlsRedirectUrl,
    setBrightMlsRedirectUrl,
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    isDownloading,
    isGeneratingShareLink,
    printComingSoonOpen,
    setPrintComingSoonOpen,
    selectedFileIds,
    setSelectedFileIds,
    handleSendToBrightMls,
    handleEditorDownloadRaw,
    handleGenerateShareLink,
    handleDownloadMedia,
  };
}

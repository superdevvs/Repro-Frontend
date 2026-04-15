import { useState } from 'react';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import {
  downloadShootMediaArchive,
  downloadShootRawFiles,
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
  const [downloadStatusMessage, setDownloadStatusMessage] = useState('Preparing your files...');
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
      const result = await downloadShootRawFiles({
        shootId: shoot.id,
        fileIds: selectedFileIds,
      });

      toast({
        title: 'Download started',
        description:
          result.message || 'Raw files downloading. Switch to Edited tab to upload your edits.',
      });
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
      setDownloadStatusMessage(
        size === 'original'
          ? 'Preparing your full-size files. This can take a minute.'
          : `Preparing ${getShootMediaDownloadSizeLabel(size)} files...`
      );
      const downloadType = isPhotographer ? 'raw' : 'edited';
      const result = await downloadShootMediaArchive({
        shootId: shoot.id,
        type: downloadType,
        size,
        address: shoot.location?.address,
        onPreparing: ({ message }) => {
          setDownloadStatusMessage(message);
        },
      });
      setIsDownloadDialogOpen(false);
      toast({
        title: result.waited ? 'Download ready' : 'Download started',
        description:
          result.mode === 'redirect'
            ? result.waited
              ? 'Your files are ready and the download is starting.'
              : 'Starting your download...'
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
    downloadStatusMessage,
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

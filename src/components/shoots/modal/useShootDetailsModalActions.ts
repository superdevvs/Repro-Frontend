import { useState } from 'react';
import axios from 'axios';
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
import { mmmService } from '@/services/mmmService';

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

interface ApiErrorResponse {
  message?: string;
  error?: string;
  details?: {
    message?: string;
    error?: string;
  };
}

const getMmmErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.response?.data?.details?.message ||
      error.response?.data?.details?.error ||
      error.message ||
      fallback
    );
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
};

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
  const [isStartingMmmPunchout, setIsStartingMmmPunchout] = useState(false);
  const [isMmmDialogOpen, setIsMmmDialogOpen] = useState(false);
  const [mmmDialogRedirectUrl, setMmmDialogRedirectUrl] = useState<string | null>(null);
  const [mmmDialogError, setMmmDialogError] = useState<string | null>(null);
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

  const handleOpenMmm = () => {
    const shootWithLegacyMmmUrl = shoot as (ShootData & { mmm_redirect_url?: string | null }) | null;
    const redirectUrl =
      shoot?.mmmRedirectUrl ??
      shootWithLegacyMmmUrl?.mmm_redirect_url ??
      mmmDialogRedirectUrl ??
      null;
    if (!redirectUrl) {
      return;
    }

    setMmmDialogError(null);
    setMmmDialogRedirectUrl(redirectUrl);
    setIsMmmDialogOpen(true);
  };

  const handleStartMmmPunchout = async () => {
    if (!shoot || isStartingMmmPunchout) return;
    const existingRedirectUrl = shoot?.mmmRedirectUrl ?? mmmDialogRedirectUrl ?? null;

    try {
      setIsStartingMmmPunchout(true);
      setIsMmmDialogOpen(true);
      setMmmDialogError(null);
      setMmmDialogRedirectUrl(null);

      const result = await mmmService.startPunchout(shoot.id);
      if (!result.success || !result.redirect_url) {
        throw new Error(result.message || 'Failed to start the MMM print session.');
      }

      setMmmDialogRedirectUrl(result.redirect_url);
      await refreshShoot().catch((refreshError) => {
        console.warn('MMM punchout succeeded but shoot refresh failed:', refreshError);
      });

      toast({
        title: 'Print session ready',
        description: 'MMM opened in the dashboard popup so you can continue the print order there.',
      });
    } catch (error) {
      const message = getMmmErrorMessage(
        error,
        'Failed to open print materials. Please try again.',
      );

      console.error('Error starting MMM punchout:', error);
      setMmmDialogRedirectUrl(existingRedirectUrl);
      setMmmDialogError(message);
      setIsMmmDialogOpen(true);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsStartingMmmPunchout(false);
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
    isStartingMmmPunchout,
    isMmmDialogOpen,
    setIsMmmDialogOpen,
    mmmDialogRedirectUrl,
    mmmDialogError,
    setMmmDialogError,
    selectedFileIds,
    setSelectedFileIds,
    handleSendToBrightMls,
    handleOpenMmm,
    handleStartMmmPunchout,
    handleEditorDownloadRaw,
    handleGenerateShareLink,
    handleDownloadMedia,
  };
}

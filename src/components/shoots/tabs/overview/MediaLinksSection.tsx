import React from 'react';
import { format } from 'date-fns';
import { Link2, Loader2, X } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import {
  SHOOT_SHARE_LINKS_UPDATED_EVENT,
  type ShootShareLinkEntry,
} from './shareLinksEvents';

interface ShareLink {
  id: number;
  share_url: string;
  media_stage?: string;
  download_count: number;
  created_at: string;
  expires_at: string | null;
  is_expired: boolean;
  is_revoked: boolean;
  is_active: boolean;
  created_by: { id: number; name: string } | null;
}

interface MediaLinksSectionProps {
  shoot: ShootData;
  isEditor: boolean;
}

const normalizeShareLinksResponse = (payload: unknown): ShareLink[] => {
  if (Array.isArray(payload)) {
    return payload as ShareLink[];
  }

  if (payload && typeof payload === 'object') {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      return data as ShareLink[];
    }
  }

  return [];
};

export function MediaLinksSection({
  shoot,
  isEditor,
}: MediaLinksSectionProps) {
  const [shareLinks, setShareLinks] = React.useState<ShareLink[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [revoking, setRevoking] = React.useState<number | null>(null);
  const { toast } = useToast();

  const fetchShareLinks = React.useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/api/shoots/${shoot.id}/share-links`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setShareLinks(normalizeShareLinksResponse(data));
      }
    } catch (error) {
      console.error('Failed to fetch share links:', error);
    } finally {
      setLoading(false);
    }
  }, [shoot.id]);

  React.useEffect(() => {
    if (!isEditor) {
      return;
    }

    void fetchShareLinks();
  }, [fetchShareLinks, isEditor]);

  React.useEffect(() => {
    if (!isEditor || typeof window === 'undefined') {
      return;
    }

    const handleShareLinksUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        shootId?: string;
        entry?: ShootShareLinkEntry | null;
      }>;
      if (String(customEvent.detail?.shootId || '') !== String(shoot.id)) {
        return;
      }

      const entry = customEvent.detail?.entry;
      if (entry) {
        setShareLinks((prev) => {
          const withoutExisting = prev.filter((link) => link.id !== entry.id);
          return [entry, ...withoutExisting];
        });
        return;
      }

      void fetchShareLinks();
    };

    window.addEventListener(
      SHOOT_SHARE_LINKS_UPDATED_EVENT,
      handleShareLinksUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        SHOOT_SHARE_LINKS_UPDATED_EVENT,
        handleShareLinksUpdated as EventListener,
      );
    };
  }, [fetchShareLinks, isEditor, shoot.id]);

  const handleRevokeLink = async (linkId: number) => {
    try {
      setRevoking(linkId);
      const token =
        localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/api/shoots/${shoot.id}/share-links/${linkId}/revoke`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );

      if (res.ok) {
        setShareLinks((prev) =>
          prev.map((link) =>
            link.id === linkId
              ? { ...link, is_revoked: true, is_active: false }
              : link,
          ),
        );
        toast({
          title: 'Link revoked',
          description: 'Share link has been revoked successfully.',
        });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to revoke link');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke share link',
        variant: 'destructive',
      });
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Copied!',
        description: 'Share link copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const activeLinks = shareLinks.filter((link) => link.is_active);
  const inactiveLinks = shareLinks.filter((link) => !link.is_active);
  const getStageLabel = (link: ShareLink) => {
    switch ((link.media_stage || 'raw').toLowerCase()) {
      case 'edited':
        return 'Edited';
      case 'raw_photo':
        return 'Raw Photo';
      case 'raw_video':
        return 'Raw Video';
      default:
        return 'Raw';
    }
  };

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">
          Media Links
        </span>
      </div>
      <div className="space-y-2 text-xs">
        {(shoot as any).dropbox_raw_folder && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">RAW Photos:</span>
            <a
              href={(shoot as any).dropbox_raw_folder}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              <span>Open Dropbox</span>
              <Link2 className="h-3 w-3" />
            </a>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : shareLinks.length > 0 ? (
          <div className="space-y-1.5 pt-1 border-t">
            <span className="text-muted-foreground block text-[10px] uppercase">
              Generated Share Links:
            </span>

            {activeLinks.map((link) => (
              <div
                key={link.id}
                className="p-1.5 border rounded bg-muted/30 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-green-600 text-[10px] font-medium">
                      Active
                    </span>
                    <span className="text-muted-foreground text-[10px]">•</span>
                    <span className="text-[10px] text-muted-foreground">
                      {getStageLabel(link)}
                    </span>
                    <span className="text-muted-foreground text-[10px]">•</span>
                    <span className="text-[10px] text-muted-foreground">
                      {link.download_count} downloads
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => copyToClipboard(link.share_url)}
                      title="Copy link"
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                      onClick={() => handleRevokeLink(link.id)}
                      disabled={revoking === link.id}
                      title="Revoke link"
                    >
                      {revoking === link.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {link.expires_at
                    ? `Expires: ${formatDate(link.expires_at)}`
                    : 'Lifetime link'}
                </div>
              </div>
            ))}

            {inactiveLinks.length > 0 && (
              <details className="text-[10px]">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                  {inactiveLinks.length} inactive link(s)
                </summary>
                <div className="space-y-1 mt-1">
                  {inactiveLinks.map((link) => (
                    <div
                      key={link.id}
                      className="p-1.5 border rounded bg-muted/20 opacity-60"
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[10px] font-medium ${
                            link.is_revoked ? 'text-red-600' : 'text-orange-600'
                          }`}
                        >
                          {link.is_revoked ? 'Revoked' : 'Expired'}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {getStageLabel(link)}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {link.download_count} downloads
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground text-[10px] pt-1 border-t">
            No share links generated yet. Use the "Share Link" button in the
            header to create one.
          </div>
        )}
      </div>
    </div>
  );
}

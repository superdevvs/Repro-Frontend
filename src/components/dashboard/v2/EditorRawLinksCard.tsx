import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowUpRight, Copy, Download, Link2, Loader2, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/dashboard/v2/SharedComponents';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import type { ShootData, ShootEditorAssignment, ShootServiceObject } from '@/types/shoots';
import { cn } from '@/lib/utils';

type ShareLink = {
  id: number;
  share_url: string;
  media_stage?: string;
  created_at?: string | null;
  is_active?: boolean;
  is_revoked?: boolean;
  is_expired?: boolean;
};

interface EditorRawLinksCardProps {
  shoots: ShootData[];
  editorId?: string | number | null;
  isLoading?: boolean;
  isError?: boolean;
  onOpenShoot?: (shootId: string | number) => void;
}

const normalizeId = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : String(value);

const getRawFileCount = (shoot: ShootData) => {
  if (typeof shoot.rawPhotoCount === 'number') {
    return shoot.rawPhotoCount;
  }

  if (typeof shoot.mediaSummary?.rawUploaded === 'number') {
    return shoot.mediaSummary.rawUploaded;
  }

  return (shoot.files ?? []).filter((file) => {
    const workflowStage = String(file.workflowStage ?? file.workflow_stage ?? '').toLowerCase();
    return workflowStage === 'todo';
  }).length;
};

const hasRawAssets = (shoot: ShootData) =>
  getRawFileCount(shoot) > 0 || Boolean(shoot.dropboxPaths?.rawFolder);

const getShootTimestamp = (shoot: ShootData) => {
  const value = shoot.updatedAt || shoot.createdAt || shoot.completedDate || shoot.scheduledDate;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const getHighlightShoot = (shoots: ShootData[]) => {
  const sorted = [...shoots].sort((a, b) => getShootTimestamp(b) - getShootTimestamp(a));
  return sorted.find((shoot) => hasRawAssets(shoot)) ?? sorted[0] ?? null;
};

const getMissingRawCount = (shoots: ShootData[]) =>
  shoots.filter((shoot) => !hasRawAssets(shoot)).length;

const formatShortDate = (value?: string | null) => {
  if (!value) return 'Date TBD';
  try {
    return format(new Date(value), 'MMM d');
  } catch {
    return 'Date TBD';
  }
};

const formatTimeLabel = (value?: string | null) => {
  if (!value) return 'Time TBD';
  return value;
};

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

const isRawStage = (mediaStage?: string | null) => {
  const normalized = String(mediaStage || 'raw').toLowerCase();
  return normalized === 'raw' || normalized.startsWith('raw_');
};

const getLaneMediaStage = (lane?: string | null) => {
  const normalized = String(lane || '').toLowerCase();
  if (normalized === 'photo') return 'raw_photo';
  if (normalized === 'video') return 'raw_video';
  return 'raw';
};

const getAssignedLaneFromAssignments = (
  assignments: ShootEditorAssignment[] | undefined,
  editorId: string | number | null | undefined,
) => {
  const normalizedEditorId = normalizeId(editorId);
  if (!normalizedEditorId) return null;

  return (
    assignments?.find((assignment) => {
      const assignmentEditorId = normalizeId(assignment.editorId ?? assignment.editor?.id);
      return assignmentEditorId === normalizedEditorId;
    })?.lane ?? null
  );
};

const getAssignedLaneFromServices = (
  services: ShootServiceObject[] | undefined,
  editorId: string | number | null | undefined,
) => {
  const normalizedEditorId = normalizeId(editorId);
  if (!normalizedEditorId) return null;

  return (
    services?.find((service) => {
      const serviceEditorId = normalizeId(
        service.resolved_editor_id ?? service.editor_id ?? service.editor?.id,
      );
      return serviceEditorId === normalizedEditorId;
    })?.lane ?? null
  );
};

const getPreferredRawMediaStage = (
  shoot: ShootData,
  editorId: string | number | null | undefined,
) => {
  const assignmentLane = getAssignedLaneFromAssignments(shoot.editorAssignments, editorId);
  if (assignmentLane) {
    return getLaneMediaStage(assignmentLane);
  }

  const serviceLane = getAssignedLaneFromServices(shoot.serviceObjects, editorId);
  return getLaneMediaStage(serviceLane);
};

const sortShareLinks = (links: ShareLink[]) =>
  [...links].sort((a, b) => {
    const first = a.created_at ? new Date(a.created_at).getTime() : 0;
    const second = b.created_at ? new Date(b.created_at).getTime() : 0;
    return second - first;
  });

export function EditorRawLinksCard({
  shoots,
  editorId,
  isLoading = false,
  isError = false,
  onOpenShoot,
}: EditorRawLinksCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shareLinks, setShareLinks] = React.useState<ShareLink[]>([]);
  const [shareLinksLoading, setShareLinksLoading] = React.useState(false);
  const [shareLinksError, setShareLinksError] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = React.useState(false);

  const highlightShoot = React.useMemo(() => getHighlightShoot(shoots), [shoots]);
  const missingRawCount = React.useMemo(() => getMissingRawCount(shoots), [shoots]);
  const rawCount = highlightShoot ? getRawFileCount(highlightShoot) : 0;
  const canUseRawActions = Boolean(highlightShoot && hasRawAssets(highlightShoot));
  const preferredMediaStage = highlightShoot
    ? getPreferredRawMediaStage(highlightShoot, editorId)
    : 'raw';

  const loadShareLinks = React.useCallback(async () => {
    if (!highlightShoot) {
      setShareLinks([]);
      setShareLinksError(null);
      return;
    }

    try {
      setShareLinksLoading(true);
      setShareLinksError(null);
      const response = await fetch(`${API_BASE_URL}/api/shoots/${highlightShoot.id}/share-links`, {
        headers: {
          ...getApiHeaders(),
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Unable to load share links');
      }

      const data = await response.json();
      setShareLinks(sortShareLinks(normalizeShareLinksResponse(data)));
    } catch (error) {
      console.error('Failed to load editor raw share links:', error);
      setShareLinks([]);
      setShareLinksError(error instanceof Error ? error.message : 'Unable to load share links');
    } finally {
      setShareLinksLoading(false);
    }
  }, [highlightShoot]);

  React.useEffect(() => {
    void loadShareLinks();
  }, [loadShareLinks]);

  const activeRawShareLink = React.useMemo(() => {
    const activeRawLinks = shareLinks.filter((link) => {
      if (link.is_revoked || link.is_expired || link.is_active === false) {
        return false;
      }

      return isRawStage(link.media_stage);
    });

    return (
      activeRawLinks.find(
        (link) => String(link.media_stage || 'raw').toLowerCase() === preferredMediaStage,
      ) ??
      activeRawLinks.find((link) => String(link.media_stage || 'raw').toLowerCase() === 'raw') ??
      activeRawLinks[0] ??
      null
    );
  }, [preferredMediaStage, shareLinks]);

  const handleCopyShareLink = async () => {
    if (!highlightShoot) return;

    if (!activeRawShareLink?.share_url) {
      toast({
        title: 'No share link yet',
        description: 'Generate a new link first for this shoot.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(activeRawShareLink.share_url);
      toast({
        title: 'Share link copied',
        description: 'Raw files link copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy the share link right now.',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateShareLink = async () => {
    if (!highlightShoot || !canUseRawActions) {
      return;
    }

    try {
      setIsGeneratingShareLink(true);
      const response = await fetch(`${API_BASE_URL}/api/shoots/${highlightShoot.id}/generate-share-link`, {
        method: 'POST',
        headers: {
          ...getApiHeaders(),
          Accept: 'application/json',
        },
        body: JSON.stringify({
          media_stage: preferredMediaStage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate share link' }));
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data = await response.json();
      const generatedLink = data.share_link as string | undefined;
      if (generatedLink) {
        await navigator.clipboard.writeText(generatedLink);
      }

      await loadShareLinks();
      toast({
        title: 'Share link ready',
        description: generatedLink ? 'New link copied to clipboard.' : 'Raw files link generated successfully.',
      });
    } catch (error) {
      console.error('Error generating raw share link:', error);
      toast({
        title: 'Share link failed',
        description: error instanceof Error ? error.message : 'Failed to generate share link.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingShareLink(false);
    }
  };

  const handleDownloadRaw = async () => {
    if (!highlightShoot || !canUseRawActions) {
      return;
    }

    try {
      setIsDownloading(true);
      const response = await fetch(`${API_BASE_URL}/api/shoots/${highlightShoot.id}/editor-download-raw`, {
        method: 'GET',
        headers: {
          ...getApiHeaders(),
          Accept: 'application/json, application/zip',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.type === 'redirect' && data.url) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `shoot-${highlightShoot.id}-raw-files-${Date.now()}.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: 'Download started',
        description: 'Raw files are opening in a new tab or downloading now.',
      });
    } catch (error) {
      console.error('Error downloading raw files:', error);
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download raw files.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenShoot = () => {
    if (!highlightShoot) return;

    if (onOpenShoot) {
      onOpenShoot(highlightShoot.id);
      return;
    }

    navigate(`/shoots/${highlightShoot.id}`);
  };

  const handleOpenQueue = () => {
    navigate('/shoot-history?tab=completed');
  };

  return (
    <Card className="h-full flex flex-col bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.95))] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]">
      <div className="flex h-full flex-col">
        <div>
          <h3 className="text-[2rem] font-semibold tracking-tight leading-none">Raw Files &amp; Links</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Quick access to latest uploads and share tools
          </p>
        </div>

        {isLoading && shoots.length === 0 ? (
          <div className="mt-5 flex min-h-[250px] flex-1 items-center justify-center rounded-[28px] border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading raw file tools...
          </div>
        ) : isError && shoots.length === 0 ? (
          <div className="mt-5 flex min-h-[250px] flex-1 items-center rounded-[28px] border border-dashed border-border/60 bg-muted/10 p-5 text-sm text-muted-foreground">
            Unable to load raw file tools right now.
          </div>
        ) : !highlightShoot ? (
          <div className="mt-5 flex min-h-[250px] flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-border/60 bg-muted/10 px-6 text-center">
            <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground/70" />
            <p className="text-base font-medium">No active raw files to manage.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This card fills in automatically when a new assigned edit has raw files or a share link.
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-1 flex-col justify-between gap-5">
            <button
              type="button"
              onClick={handleOpenShoot}
              className="group relative flex min-h-[250px] flex-1 flex-col justify-between overflow-hidden rounded-[30px] border border-slate-200/90 bg-[linear-gradient(160deg,rgba(255,255,255,0.92),rgba(248,250,252,0.98)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_32%)] p-5 text-left transition-all duration-200 hover:border-sky-300/80 hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(239,246,255,0.98)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_36%)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.10)] dark:border-border/60 dark:bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_30%)] dark:hover:border-primary/35 dark:hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.20),transparent_34%)] dark:hover:shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
            >
              <div className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white/80 p-2 text-slate-500 transition-colors group-hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground dark:group-hover:text-white">
                <ArrowUpRight className="h-4 w-4" />
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700/75 dark:text-sky-200/75">
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>{hasRawAssets(highlightShoot) ? 'Latest raw upload' : 'Latest assigned shoot'}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-full border px-3 py-1 text-[11px] font-semibold',
                        activeRawShareLink
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
                      )}
                    >
                      {activeRawShareLink ? 'Share link ready' : 'No share link yet'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    >
                      {rawCount > 0 ? `${rawCount} raw files` : 'Awaiting raw files'}
                    </Badge>
                  </div>

                  <h4 className="max-w-[18rem] text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-slate-950 transition-colors group-hover:text-sky-900 dark:text-white dark:group-hover:text-sky-100">
                    {highlightShoot.location.address}
                  </h4>

                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {formatShortDate(highlightShoot.scheduledDate)} · {formatTimeLabel(highlightShoot.time)}
                    {highlightShoot.location.city ? ` · ${highlightShoot.location.city}` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200/90 pt-4 dark:border-white/10">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-muted-foreground">
                    Latest raw upload
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                    {rawCount > 0 ? rawCount : 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                    {rawCount === 1 ? 'file available' : 'files available'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-muted-foreground">
                    Missing raw files
                  </p>
                  <p
                    className={cn(
                      'mt-2 text-2xl font-semibold',
                      missingRawCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-950 dark:text-white',
                    )}
                  >
                    {missingRawCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                    active shoot{missingRawCount === 1 ? '' : 's'} still waiting
                  </p>
                </div>
              </div>
            </button>

            {missingRawCount > 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-3.5 py-3 text-sm text-amber-200/90">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{missingRawCount} active assigned shoot{missingRawCount === 1 ? ' is' : 's are'} still missing raw files.</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2.5">
              <Button
                type="button"
                variant={activeRawShareLink ? 'default' : 'outline'}
                className="h-12 justify-between rounded-2xl px-4 text-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCopyShareLink();
                }}
                disabled={!activeRawShareLink?.share_url}
              >
                <span className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Share link
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-70" />
              </Button>

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 justify-between rounded-2xl px-4 text-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDownloadRaw();
                  }}
                  disabled={isDownloading || !canUseRawActions}
                >
                  <span className="flex items-center gap-2">
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download raw
                  </span>
                  <ArrowUpRight className="h-4 w-4 opacity-70" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 justify-between rounded-2xl px-4 text-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleGenerateShareLink();
                  }}
                  disabled={isGeneratingShareLink || !canUseRawActions}
                >
                  <span className="flex items-center gap-2">
                    {isGeneratingShareLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    Generate new link
                  </span>
                  <ArrowUpRight className="h-4 w-4 opacity-70" />
                </Button>
              </div>
            </div>

            {shareLinksError ? (
              <p className="text-xs text-muted-foreground">
                Share links are unavailable right now, but raw download still works.
              </p>
            ) : shareLinksLoading ? (
              <p className="text-xs text-muted-foreground">Checking current share links...</p>
            ) : null}

            {!hasRawAssets(highlightShoot) ? (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
                Raw files have not been uploaded for this shoot yet. Open the queue to check the rest of your assigned edits.
                <div className="mt-3">
                  <Button type="button" variant="secondary" size="sm" onClick={handleOpenQueue}>
                    Open editing queue
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Applies to active assigned edits only.
      </p>
    </Card>
  );
}

import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowUpRight, CalendarClock, Copy, Loader2, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/dashboard/v2/SharedComponents';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import type { ShootData } from '@/types/shoots';
import { cn } from '@/lib/utils';

interface EditorRawLinksCardProps {
  shoots: ShootData[];
  editorId?: string | number | null;
  isLoading?: boolean;
  isError?: boolean;
  onOpenShoot?: (shootId: string | number) => void;
}

type ShareLink = {
  id: number;
  share_url: string;
  media_stage?: string;
  created_at?: string | null;
  is_active?: boolean;
  is_revoked?: boolean;
  is_expired?: boolean;
};

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

const sortShoots = (shoots: ShootData[]) =>
  [...shoots].sort((a, b) => getShootTimestamp(b) - getShootTimestamp(a));

const formatShortDate = (value?: string | null) => {
  if (!value) return 'Date TBD';
  try {
    return format(new Date(value), 'MMM d');
  } catch {
    return 'Date TBD';
  }
};

const formatTimeLabel = (value?: string | null) => value || 'Time TBD';

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

const sortShareLinks = (links: ShareLink[]) =>
  [...links].sort((a, b) => {
    const first = a.created_at ? new Date(a.created_at).getTime() : 0;
    const second = b.created_at ? new Date(b.created_at).getTime() : 0;
    return second - first;
  });

const isRawStage = (mediaStage?: string | null) => {
  const normalized = String(mediaStage || 'raw').toLowerCase();
  return normalized === 'raw' || normalized.startsWith('raw_');
};

export function EditorRawLinksCard({
  shoots,
  isLoading = false,
  isError = false,
  onOpenShoot,
}: EditorRawLinksCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shareLinksByShoot, setShareLinksByShoot] = React.useState<Record<string, ShareLink | null>>({});
  const [scheduleSummary, setScheduleSummary] = React.useState<{
    today: number;
    tomorrow: number;
    thisWeek: number;
  } | null>(null);
  const [scheduleSummaryLoading, setScheduleSummaryLoading] = React.useState(true);

  const MAX_VISIBLE_SHOOTS = 5;
  const sortedShoots = React.useMemo(() => sortShoots(shoots), [shoots]);
  const visibleShoots = React.useMemo(
    () => sortedShoots.slice(0, MAX_VISIBLE_SHOOTS),
    [sortedShoots],
  );
  const hasMoreShoots = sortedShoots.length > MAX_VISIBLE_SHOOTS;
  const missingRawCount = React.useMemo(
    () => visibleShoots.filter((shoot) => !hasRawAssets(shoot)).length,
    [visibleShoots],
  );

  React.useEffect(() => {
    let isMounted = true;

    const loadShareLinks = async () => {
      if (sortedShoots.length === 0) {
        if (isMounted) {
          setShareLinksByShoot({});
        }
        return;
      }

      const results = await Promise.all(
        sortedShoots.map(async (shoot) => {
          try {
            const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/share-links`, {
              headers: {
                ...getApiHeaders(),
                Accept: 'application/json',
              },
            });

            if (!response.ok) {
              return [String(shoot.id), null] as const;
            }

            const data = await response.json();
            const links = sortShareLinks(normalizeShareLinksResponse(data));
            const activeRawLink =
              links.find((link) => {
                if (link.is_revoked || link.is_expired || link.is_active === false) {
                  return false;
                }

                return isRawStage(link.media_stage);
              }) ?? null;

            return [String(shoot.id), activeRawLink] as const;
          } catch {
            return [String(shoot.id), null] as const;
          }
        }),
      );

      if (isMounted) {
        setShareLinksByShoot(Object.fromEntries(results));
      }
    };

    void loadShareLinks();

    return () => {
      isMounted = false;
    };
  }, [sortedShoots]);

  React.useEffect(() => {
    let isMounted = true;

    const loadScheduleSummary = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/schedule-summary`, {
          headers: {
            ...getApiHeaders(),
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          if (isMounted) setScheduleSummaryLoading(false);
          return;
        }

        const payload = await response.json();
        const data = (payload && typeof payload === 'object' && 'data' in payload)
          ? (payload.data as Record<string, unknown>)
          : (payload as Record<string, unknown>);

        if (!isMounted || !data) return;

        setScheduleSummary({
          today: Number(data.scheduled_today ?? 0),
          tomorrow: Number(data.scheduled_tomorrow ?? 0),
          thisWeek: Number(data.scheduled_this_week ?? 0),
        });
      } catch {
        // Silently swallow — header gracefully degrades.
      } finally {
        if (isMounted) setScheduleSummaryLoading(false);
      }
    };

    void loadScheduleSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenShoot = (shootId: string | number) => {
    if (onOpenShoot) {
      onOpenShoot(shootId);
      return;
    }

    navigate(`/shoots/${shootId}`);
  };

  const handleOpenQueue = () => {
    navigate('/shoot-history?tab=completed');
  };

  const handleCopyShareLink = async (event: React.MouseEvent<HTMLButtonElement>, shootId: string | number) => {
    event.stopPropagation();
    const shareLink = shareLinksByShoot[String(shootId)]?.share_url;

    if (!shareLink) {
      toast({
        title: 'No share link yet',
        description: 'This shoot does not have an active raw share link yet.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
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

  return (
    <Card className="h-full bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.96))] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]">
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <CalendarClock className="h-4 w-4 text-sky-500 dark:text-sky-300" />
              <span>Workload outlook</span>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 whitespace-nowrap rounded-full border-slate-200/90 bg-white/75 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {sortedShoots.length} assigned
            </Badge>
          </div>

          <div className="flex items-stretch divide-x divide-slate-200/70 rounded-xl border border-slate-200/80 bg-white/55 dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.025]">
            {([
              { label: 'Today', value: scheduleSummary?.today ?? 0, primary: true },
              { label: 'Tomorrow', value: scheduleSummary?.tomorrow ?? 0, primary: false },
              { label: 'This week', value: scheduleSummary?.thisWeek ?? 0, primary: false },
            ] as const).map((stat) => {
              const isLoading = scheduleSummaryLoading && !scheduleSummary;
              return (
                <div
                  key={stat.label}
                  className="flex flex-1 flex-col items-center gap-1 px-2 py-3"
                >
                  <span
                    className={cn(
                      'text-[26px] font-semibold leading-none tabular-nums',
                      stat.primary
                        ? 'text-sky-600 dark:text-sky-300'
                        : 'text-foreground/85',
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      stat.value
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-[0.18em]',
                      stat.primary
                        ? 'text-sky-600/85 dark:text-sky-300/85'
                        : 'text-muted-foreground',
                    )}
                  >
                    {stat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isLoading && shoots.length === 0 ? (
          <div className="mt-5 flex min-h-[210px] flex-1 items-center justify-center rounded-[24px] border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading raw files...
          </div>
        ) : isError && shoots.length === 0 ? (
          <div className="mt-5 flex min-h-[210px] flex-1 items-center rounded-[24px] border border-dashed border-border/60 bg-muted/10 p-5 text-sm text-muted-foreground">
            Unable to load raw file assignments right now.
          </div>
        ) : sortedShoots.length === 0 ? (
          <div className="mt-5 flex min-h-[210px] flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-border/60 bg-muted/10 px-6 text-center">
            <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground/70" />
            <p className="text-base font-medium">No active raw files to manage.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              New assigned edits will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-1 flex-col gap-3">
            {missingRawCount > 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-3.5 py-3 text-sm text-amber-700 dark:text-amber-200/90">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {missingRawCount} assigned shoot{missingRawCount === 1 ? ' is' : 's are'} still waiting for raw files.
                </span>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {visibleShoots.map((shoot, index) => {
                  const rawCount = getRawFileCount(shoot);
                  const isReady = hasRawAssets(shoot);
                  const shareLink = shareLinksByShoot[String(shoot.id)]?.share_url;

                  return (
                    <button
                      key={shoot.id}
                      type="button"
                      onClick={() => handleOpenShoot(shoot.id)}
                      className={cn(
                        'group w-full rounded-[20px] border p-4 text-left transition-all duration-200',
                        index < 2 ? 'opacity-100' : 'opacity-95',
                        'border-slate-200/90 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))] hover:border-sky-300/80 hover:bg-sky-50/70 dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] dark:hover:border-primary/35 dark:hover:bg-white/[0.05]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold text-slate-950 dark:text-white">
                              {shoot.location.address}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                                isReady
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                              )}
                            >
                              {isReady ? 'Raw ready' : 'Awaiting raw'}
                            </Badge>
                          </div>

                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {formatShortDate(shoot.scheduledDate)} · {formatTimeLabel(shoot.time)}
                            {shoot.location.city ? ` · ${shoot.location.city}` : ''}
                          </p>
                        </div>

                        <div className="rounded-full border border-slate-200 bg-white/80 p-2 text-slate-500 transition-colors group-hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground dark:group-hover:text-white">
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-white/10">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-muted-foreground">
                            Raw files
                          </p>
                          <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                            {rawCount}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={(event) => void handleCopyShareLink(event, shoot.id)}
                            disabled={!shareLink}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Share link
                          </Button>
                          <p className="text-xs text-slate-500 dark:text-muted-foreground">
                            Shoot #{shoot.id}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {hasMoreShoots ? (
              <p className="text-xs text-muted-foreground">
                Showing the latest {MAX_VISIBLE_SHOOTS}. Open the editing queue to see all assigned shoots.
              </p>
            ) : null}

            {missingRawCount > 0 ? (
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={handleOpenQueue}>
                  Open editing queue
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

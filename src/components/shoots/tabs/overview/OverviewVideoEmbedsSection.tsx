import React from 'react';
import { Film, Plus, Trash2 } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import type { ShootData } from '@/types/shoots';
import { getRawTourLinks } from '@/utils/shootTourData';
import {
  buildEditorTourLinksEmbedPatch,
  buildOverviewVideoEmbedsPayload,
  canWriteOverviewVideoEmbeds,
  createOverviewVideoEmbedId,
  isValidHttpUrl,
  normalizeOverviewVideoEmbeds,
  type OverviewVideoEmbed,
} from './overviewVideoEmbeds';
import {
  filterVirtualTourEmbeds,
  findDuplicateAmongTourMediaUrls,
  findTourMediaDuplicateConflict,
} from '@/components/tourLinks/tourMediaEmbedUrl';

type OverviewVideoEmbedsSectionProps = {
  unitId?: string | number;
  shoot: ShootData;
  role: string;
  isEditor?: boolean;
  canWrite?: boolean;
  onShootUpdate: () => void | Promise<unknown>;
};

const cloneEmbeds = (embeds: OverviewVideoEmbed[]) =>
  embeds.map((embed) => ({ ...embed }));

export function OverviewVideoEmbedsSection({
  unitId,
  shoot,
  role,
  canWrite: canWriteProp,
  onShootUpdate,
}: OverviewVideoEmbedsSectionProps) {
  const { toast } = useToast();
  const canWrite = canWriteProp ?? canWriteOverviewVideoEmbeds(role);
  const sourceTourLinks = React.useMemo(() => getRawTourLinks(shoot), [shoot]);
  const initialEmbeds = React.useMemo(
    () => normalizeOverviewVideoEmbeds(sourceTourLinks, shoot.id),
    [shoot.id, sourceTourLinks],
  );
  const [embeds, setEmbeds] = React.useState<OverviewVideoEmbed[]>(() => cloneEmbeds(initialEmbeds));
  const [isSaving, setIsSaving] = React.useState(false);
  const [duplicateWarning, setDuplicateWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEmbeds(cloneEmbeds(initialEmbeds));
  }, [initialEmbeds]);

  const isDirty = React.useMemo(
    () => JSON.stringify(embeds) !== JSON.stringify(initialEmbeds),
    [embeds, initialEmbeds],
  );

  const updateEmbed = (id: string, patch: Partial<OverviewVideoEmbed>) => {
    setEmbeds((prev) => prev.map((embed) => (embed.id === id ? { ...embed, ...patch } : embed)));
  };

  const addEmbed = () => {
    setEmbeds((prev) => [
      ...prev,
      {
        id: createOverviewVideoEmbedId(),
        title: `Video ${prev.length + 1}`,
        url: '',
      },
    ]);
  };

  const removeEmbed = (id: string) => {
    setEmbeds((prev) => prev.filter((embed) => embed.id !== id));
  };

  const handleSave = async () => {
    if (!canWrite) return;

    const trimmed = embeds.map((embed) => ({
      ...embed,
      title: embed.title.trim(),
      url: embed.url.trim(),
    }));
    const incomplete = trimmed.find((embed) => !embed.url);
    if (incomplete) {
      toast({
        title: 'Missing URL',
        description: 'Each video embed needs a URL, or remove the empty row.',
        variant: 'destructive',
      });
      return;
    }
    const invalid = trimmed.find((embed) => !isValidHttpUrl(embed.url));
    if (invalid) {
      toast({
        title: 'Invalid URL',
        description: 'Video embed URLs must start with http:// or https://',
        variant: 'destructive',
      });
      return;
    }

    const withUrls = trimmed.filter((embed) => Boolean(embed.url));
    const listConflict = findDuplicateAmongTourMediaUrls(
      withUrls.map((embed, index) => ({
        id: embed.id,
        url: embed.url,
        label: embed.title.trim() || `Video ${index + 1}`,
        kind: 'embed' as const,
      })),
    );
    if (listConflict) {
      setDuplicateWarning(listConflict.message);
      return;
    }

    const existingVideoLink =
      typeof sourceTourLinks.video_link === 'string' ? sourceTourLinks.video_link.trim() : '';
    // When saving multiple rows, later rows must not mirror video_link / primary.
    if (withUrls.length > 1 && existingVideoLink) {
      for (const embed of withUrls.slice(1)) {
        const vsVideo = findTourMediaDuplicateConflict(
          {
            id: embed.id,
            url: embed.url,
            label: embed.title.trim() || 'Video embed',
            kind: 'embed',
          },
          [{ url: existingVideoLink, label: 'the listing Video Link', kind: 'video_link' }],
        );
        if (vsVideo) {
          setDuplicateWarning(vsVideo.message);
          return;
        }
      }
    }

    const featuredEmbedId =
      typeof sourceTourLinks.featured_embed_id === 'string'
        ? sourceTourLinks.featured_embed_id
        : typeof sourceTourLinks.featured_embed === 'string'
          ? sourceTourLinks.featured_embed
          : null;
    const payload = buildOverviewVideoEmbedsPayload(trimmed, featuredEmbedId);

    setIsSaving(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const existingEmbeds = Array.isArray(sourceTourLinks.embeds)
        ? sourceTourLinks.embeds.map((item, index) => {
            const embed = item && typeof item === 'object' ? item as Record<string, unknown> : {};
            const branded = typeof embed.branded === 'string' ? embed.branded
              : typeof embed.url === 'string' ? embed.url : '';
            const mls = typeof embed.mls === 'string' ? embed.mls : branded;
            return {
              id: typeof embed.id === 'string' && embed.id ? embed.id : `embed-${index}`,
              title: typeof embed.title === 'string' ? embed.title : '',
              branded,
              mls,
              url: typeof embed.url === 'string' ? embed.url : branded || mls,
              branded_embed: typeof embed.branded_embed === 'string' ? embed.branded_embed : branded,
              mls_embed: typeof embed.mls_embed === 'string' ? embed.mls_embed : mls,
            };
          })
        : [];
      // Drop listing-video URLs from Virtual Tours; keep true 3D embeds.
      const cleanedEmbeds = filterVirtualTourEmbeds(existingEmbeds, {
        videoUrls: [payload.video_link, ...trimmed.map((embed) => embed.url)],
        getValue: (embed) => embed.branded || embed.mls || embed.url || '',
      });
      const nextFeatured =
        cleanedEmbeds.some((embed) => embed.id === featuredEmbedId)
          ? featuredEmbedId
          : cleanedEmbeds[0]?.id ?? null;
      // BE editor allowlist: embeds | video_link | featured_embed_id | featured_embed only.
      // Never spread sourceTourLinks (property_* / video_branded / etc. → 403).
      const slimTourLinks = buildEditorTourLinksEmbedPatch({
        embeds: cleanedEmbeds,
        video_link: payload.video_link,
        featured_embed_id: nextFeatured,
      });
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}${unitId ? `/units/${unitId}/tour` : ''}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ tour_links: slimTourLinks }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error(
            (errorData as { message?: string }).message
              || 'You do not have permission to update video links on this shoot yet.',
          );
        }
        throw new Error(
          (errorData as { message?: string }).message || 'Failed to save video links',
        );
      }

      setEmbeds(cloneEmbeds(trimmed));
      toast({
        title: 'Saved',
        description: trimmed.length
          ? 'Video links updated for the video tour.'
          : 'Video links cleared from the video tour.',
      });
      await Promise.resolve(onShootUpdate());
    } catch (error) {
      console.error('Save overview video embeds failed', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Failed to save video links. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-2.5 border rounded-lg bg-card" data-testid="overview-video-embeds">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Film className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">
          Video links
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        {canWrite
          ? 'Add YouTube or Vimeo links for the video tour. The first link is the primary video.'
          : 'Video links attached to this shoot’s tour.'}
      </p>

      <div className="space-y-2">
        {embeds.length === 0 ? (
          <div className="text-[11px] text-muted-foreground border-t pt-2">
            No video links yet.
          </div>
        ) : (
          embeds.map((embed, index) => (
            <div
              key={embed.id}
              className="space-y-1.5 border-t pt-2"
              data-testid={`overview-video-embed-row-${index}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] font-medium">Video {index + 1}</Label>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] text-red-600 hover:text-red-700"
                    onClick={() => removeEmbed(embed.id)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <Input
                value={embed.title}
                onChange={(event) => updateEmbed(embed.id, { title: event.target.value })}
                placeholder="Title (optional)"
                className="h-8 text-xs"
                disabled={!canWrite || isSaving}
                aria-label={`Video ${index + 1} title`}
              />
              <Input
                value={embed.url}
                onChange={(event) => updateEmbed(embed.id, { url: event.target.value })}
                placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                className="h-8 text-xs"
                disabled={!canWrite || isSaving}
                aria-label={`Video ${index + 1} URL`}
              />
            </div>
          ))
        )}
      </div>

      {canWrite ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={addEmbed}
            disabled={isSaving}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add more
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1" />
                Saving...
              </>
            ) : (
              'Save links'
            )}
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(duplicateWarning)}
        onOpenChange={(open) => {
          if (!open) setDuplicateWarning(null);
        }}
      >
        <AlertDialogContent data-testid="duplicate-video-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate video link</AlertDialogTitle>
            <AlertDialogDescription>{duplicateWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction type="button" onClick={() => setDuplicateWarning(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import React from 'react';
import { Film, Plus, Trash2 } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import type { ShootData } from '@/types/shoots';
import { getRawTourLinks } from '@/utils/shootTourData';
import {
  buildOverviewVideoEmbedsPayload,
  canWriteOverviewVideoEmbeds,
  createOverviewVideoEmbedId,
  isValidHttpUrl,
  normalizeOverviewVideoEmbeds,
  type OverviewVideoEmbed,
} from './overviewVideoEmbeds';

type OverviewVideoEmbedsSectionProps = {
  shoot: ShootData;
  role: string;
  isEditor?: boolean;
  canWrite?: boolean;
  onShootUpdate: () => void | Promise<unknown>;
};

const cloneEmbeds = (embeds: OverviewVideoEmbed[]) =>
  embeds.map((embed) => ({ ...embed }));

export function OverviewVideoEmbedsSection({
  shoot,
  role,
  isEditor = false,
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
      const nextTourLinks = {
        ...sourceTourLinks,
        embeds: payload.embeds,
        video_link: payload.video_link,
        featured_embed_id: payload.featured_embed_id,
      };
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ tour_links: nextTourLinks }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error(
            (errorData as { message?: string }).message
              || 'You do not have permission to update video embeds on this shoot yet.',
          );
        }
        throw new Error(
          (errorData as { message?: string }).message || 'Failed to save video embeds',
        );
      }

      setEmbeds(cloneEmbeds(trimmed));
      toast({
        title: 'Saved',
        description: trimmed.length
          ? 'Video embeds updated for the video tour.'
          : 'Video embeds cleared from the video tour.',
      });
      await Promise.resolve(onShootUpdate());
    } catch (error) {
      console.error('Save overview video embeds failed', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Failed to save video embeds. Please try again.',
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
          Video Tour Embeds
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        {canWrite
          ? 'Add YouTube/Vimeo links that appear as embeds in the video tour. The first link stays the primary video_link.'
          : isEditor
            ? 'Video links attached to this shoot’s tour. Editing opens for assigned editors once backend write access is enabled.'
            : 'Video links attached to this shoot’s tour.'}
      </p>

      <div className="space-y-2">
        {embeds.length === 0 ? (
          <div className="text-[11px] text-muted-foreground border-t pt-2">
            No video embeds yet.
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
              'Save embeds'
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

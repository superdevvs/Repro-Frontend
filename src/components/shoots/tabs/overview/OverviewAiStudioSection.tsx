import { Images, Sparkles, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { buildShootStudioHref } from '@/components/studio/shootStudioDeepLink';
import { usePermission } from '@/hooks/usePermission';

interface OverviewAiStudioSectionProps {
  shootId: string;
  isClient: boolean;
  isClientReleaseLocked: boolean;
  isEditMode: boolean;
}

export function OverviewAiStudioSection({
  shootId,
  isClient,
  isClientReleaseLocked,
  isEditMode,
}: OverviewAiStudioSectionProps) {
  const { can, isLoading } = usePermission();
  const imageHref = buildShootStudioHref({ shootId, media: 'images', presetId: 'listing-ready' });
  const videoHref = buildShootStudioHref({ shootId, media: 'videos', presetId: 'walkthrough' });

  if (isLoading || !can('ai-editing', 'view') || isEditMode || (isClient && isClientReleaseLocked) || !imageHref || !videoHref) {
    return null;
  }

  return (
    <section aria-label="AI Studio" className="rounded-lg border bg-card p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            AI Studio
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Choose an image or video preset for this shoot.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-11 px-3 text-xs">
            <Link to={imageHref}>
              <Images aria-hidden="true" />
              Image presets
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-3 text-xs">
            <Link to={videoHref}>
              <Video aria-hidden="true" />
              Video presets
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

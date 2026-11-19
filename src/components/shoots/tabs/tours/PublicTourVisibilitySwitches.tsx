import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  tourVisibilityKey,
  type PublicTourVisibilityControl,
  type TourVisibilityContent,
  type TourVisibilityPage,
} from './usePublicTourVisibility';

const copy: Record<TourVisibilityContent, { name: string; note: string }> = {
  video: {
    name: 'Video',
    note: 'Off removes the video, its video page and any video embeds from that tour. Your links and files stay here.',
  },
  matterport: {
    name: 'Matterport',
    note: 'Off removes the Matterport walkthrough from that tour. Your saved link stays in the dashboard.',
  },
  iguide: {
    name: 'iGUIDE',
    note: 'Off removes the iGUIDE walkthrough from that tour. Floor plans and your saved link stay.',
  },
  cubicasa: {
    name: 'CubiCasa',
    note: 'Off removes the CubiCasa tour link from that tour. Floor plans and your saved link stay.',
  },
  zillow: {
    name: 'Zillow 3D',
    note: 'Your saved Zillow link stays in the dashboard. MLS pages require an unbranded link.',
  },
};

const pages: Array<{ page: TourVisibilityPage; label: string }> = [
  { page: 'branded', label: 'Show on Branded' },
  { page: 'mls', label: 'Show on MLS' },
];

/** The two switches that keep one kind of tour content off the shared tour pages. */
export function PublicTourVisibilitySwitches({ className = '', content, control }: {
  className?: string;
  content: TourVisibilityContent;
  control?: PublicTourVisibilityControl;
}) {
  const id = useId();
  if (!control?.canManage) return null;

  return (
    <div
      role="group"
      aria-label={`${copy[content].name} public tour visibility`}
      aria-busy={control.saving}
      data-testid={`tour-visibility-${content}`}
      className={`space-y-2 ${className}`}
    >
      <p className="text-xs font-medium">Public tour visibility</p>
      <p className="text-[11px] text-muted-foreground">{copy[content].note}</p>
      {pages.map(({ page, label }) => {
        const key = tourVisibilityKey(content, page);
        return (
          <div key={key} className="flex items-center justify-between gap-3">
            <Label htmlFor={`${id}-${page}`} className="text-xs">{label}</Label>
            <Switch
              id={`${id}-${page}`}
              checked={control.visibility[key]}
              disabled={control.saving}
              onCheckedChange={(value) => void control.save(key, value)}
            />
          </div>
        );
      })}
    </div>
  );
}

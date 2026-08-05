import { Sparkles } from 'lucide-react';
import { type MediaFile } from '@/hooks/useShootFiles';

interface MediaTileBadgesProps {
  file: MediaFile;
  variant?: 'grid' | 'list';
}

/**
 * Status badges (EXTRA / HERO / AI) overlaid on a media tile's thumbnail.
 *
 * Extracted so every MediaGrid render path — grid cards, sortable grid cards,
 * list rows and sortable list rows — renders the same badges from one place.
 * Previously the HERO badge lived only in the grid-card path, so marking a
 * file as the hero looked like it did nothing in the list and manual-sort
 * views (task 17.3, Req 3.12).
 *
 * EXTRA and HERO are mutually exclusive (a hero is never an extra) and share
 * the top-left corner; the AI badge sits in the opposite bottom corner.
 */
export function MediaTileBadges({ file, variant = 'grid' }: MediaTileBadgesProps) {
  const isExtra = Boolean(file.isExtra);
  const isHero = Boolean(file.is_cover) && !isExtra;
  const isAiEdited = Boolean(file.is_ai_edited || file.isAiEdited);

  if (!isExtra && !isHero && !isAiEdited) {
    return null;
  }

  const cornerClass = variant === 'grid' ? 'top-1 left-1' : 'top-0.5 left-0.5';
  const labelClass = variant === 'grid' ? 'text-[8px] px-1 py-0.5' : 'text-[6px] px-0.5 py-0';
  const aiClass =
    variant === 'grid'
      ? 'bottom-2 right-2 text-[9px] px-1.5 py-0.5'
      : 'bottom-1 right-1 text-[8px] px-1 py-0.5';

  return (
    <>
      {isExtra && (
        <div className={`absolute ${cornerClass} z-[3] rounded bg-orange-500 font-medium text-white ${labelClass}`}>
          EXTRA
        </div>
      )}
      {isHero && (
        <div className={`absolute ${cornerClass} z-[3] rounded bg-blue-600 font-medium text-white ${labelClass}`}>
          HERO
        </div>
      )}
      {isAiEdited && (
        <div
          className={`absolute ${aiClass} z-[3] flex items-center gap-1 rounded-full bg-violet-600/90 font-semibold uppercase tracking-wide text-white`}
        >
          <Sparkles className={variant === 'grid' ? 'h-2.5 w-2.5' : 'h-2 w-2'} />
          AI
        </div>
      )}
    </>
  );
}

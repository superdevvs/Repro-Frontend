import { useState } from 'react';
import { findTourMediaDuplicateConflict, type TourMediaUrlRef } from '@/components/tourLinks/tourMediaEmbedUrl';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type TourEmbed = { id: string; title: string; branded: string; mls: string };
type EmbedCandidate = {
  embeds: TourEmbed[];
  editingEmbedId: string | null;
  embedId: string;
  links: string[];
  title: string;
  videoLink?: string;
};

const embedReferences = (embeds: TourEmbed[], fallbackLabel: string): TourMediaUrlRef[] =>
  embeds.flatMap((item) => {
    const refs: TourMediaUrlRef[] = [];
    const reference = (url: string): TourMediaUrlRef => ({
      id: item.id, url, label: item.title || fallbackLabel, kind: 'embed',
    });
    if (item.branded.trim()) refs.push(reference(item.branded));
    if (item.mls.trim() && item.mls.trim() !== item.branded.trim()) refs.push(reference(item.mls));
    return refs;
  });

/** Shared duplicate guard and warning presentation for both tour editor save paths. */
export function useTourMediaDuplicateWarning() {
  const [warning, setWarning] = useState<string | null>(null);

  const warnIfEmbedDuplicate = ({ embeds, editingEmbedId, embedId, links, title, videoLink }: EmbedCandidate) => {
    const existing = embedReferences(embeds.filter((item) => item.id !== editingEmbedId), 'an existing embed');
    if (videoLink?.trim()) existing.push({ url: videoLink.trim(), label: 'the listing Video Link', kind: 'video_link' });
    for (const link of links) {
      // Preserve the editor's HTML-snippet behavior; this guard compares URL inputs.
      if (link.includes('<') && link.includes('>')) continue;
      const conflict = findTourMediaDuplicateConflict({ id: embedId, url: link, label: title, kind: 'embed' }, existing);
      if (conflict) {
        setWarning(conflict.message);
        return true;
      }
    }
    return false;
  };

  const warnIfVideoDuplicate = (value: string, embeds: TourEmbed[]) => {
    const conflict = findTourMediaDuplicateConflict(
      { url: value, label: 'Video Link', kind: 'video_link' },
      embedReferences(embeds, 'an existing Virtual Tours embed'),
    );
    if (!conflict) return false;
    setWarning(`This Video Link matches ${conflict.existing.label}. Remove the duplicate Virtual Tours embed first, or use a different video.`);
    return true;
  };

  const duplicateWarningDialog = (
    <AlertDialog open={Boolean(warning)} onOpenChange={(open) => { if (!open) setWarning(null); }}>
      <AlertDialogContent data-testid="tour-duplicate-video-warning">
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate video link</AlertDialogTitle>
          <AlertDialogDescription>{warning}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction type="button" onClick={() => setWarning(null)}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { warnIfEmbedDuplicate, warnIfVideoDuplicate, duplicateWarningDialog };
}

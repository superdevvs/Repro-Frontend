import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { ReviewedAddition } from './serviceAdditionReview';
import type { useShootDetailsModalSave } from './useShootDetailsModalSave';

type Review = ReturnType<typeof useShootDetailsModalSave>['conflictReview'];

export function ShootSaveConflictPanel({ review, saving, children }: {
  review: Review; saving: boolean; children: ReactNode;
}) {
  const { conflict, comparison } = review;
  const editor = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const visible = Boolean(conflict);
  useLayoutEffect(() => {
    if (editor.current) editor.current.inert = visible;
    if (visible) heading.current?.focus();
  }, [visible]);
  const rows: ReviewedAddition[] = comparison?.rows ?? conflict?.draft?.additions ?? [];
  const complete = comparison?.canApply && !comparison.missing.length;
  return <>
    {conflict && (
      <section aria-label="Booking changes" className="shrink-0 max-h-[50dvh] overflow-y-auto border-b bg-background px-4 py-3 sm:px-6">
        <h2 ref={heading} tabIndex={-1} className="text-base font-semibold">
          {complete ? 'These services are already saved' : 'This booking changed while you were editing'}
        </h2>
        <div aria-live="polite" className="mt-1 text-sm">
          {conflict.message && <p role="alert">{conflict.message}</p>}
          {!comparison && !conflict.message && <p>Review the latest booking. Your draft is still here.</p>}
          {comparison && !comparison.canApply && <p>
            {rows.some(row => row.status === 'different')
              ? 'Check the booked quantities before making changes.'
              : 'Review your edits against the latest booking.'}
            {' '}You can return to your draft or discard it and open the latest booking.
          </p>}
          {comparison?.canApply && !complete && <p>Confirm the missing services to add them to this booking.</p>}
          {rows.length > 0 && (
            <ul className="my-2 space-y-1">
              {rows.map(row => (
                <li key={row.id}>{row.name} × {row.quantity}
                  {row.status && <span className="ml-2 text-muted-foreground">{
                    row.status === 'missing' ? 'Missing' : row.status === 'saved' ? 'Already saved'
                      : row.savedQuantity != null ? `Currently booked × ${row.savedQuantity}` : 'Check booked quantity'
                  }</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {!comparison && <Button size="sm" disabled={conflict.loading} onClick={review.review}>
            {conflict.loading ? 'Loading booking…' : 'Review changes'}
          </Button>}
          {comparison && (comparison.canApply && !complete
            ? <Button size="sm" disabled={saving} onClick={review.applyReviewedAdditions}>{saving ? 'Saving…' : 'Save missing services'}</Button>
            : <Button size="sm" onClick={review.openReviewedBooking}>{complete ? 'Done' : 'Discard draft and open latest booking'}</Button>)}
          <Button variant="outline" size="sm" disabled={saving} onClick={review.clear}>Back to draft</Button>
        </div>
      </section>
    )}
    <div ref={editor} className="contents">{children}</div>
  </>;
}

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { PrivateImportReview } from './PrivateImportReview';

afterEach(cleanup);

describe('private historical import review', () => {
  it('forwards the calendar focus-restoration callback when the review closes', async () => {
    const shoot = { id: '167', status: 'import_draft', location: { address: 'Historical home' }, files: [] } as unknown as ShootData;
    const restore = vi.fn((event: Event) => event.preventDefault());
    const close = vi.fn();
    const { rerender } = render(<PrivateImportReview shoot={shoot} isOpen onClose={close} onCloseAutoFocus={restore} />);
    rerender(<PrivateImportReview shoot={shoot} isOpen={false} onClose={close} onCloseAutoFocus={restore} />);
    await waitFor(() => expect(restore).toHaveBeenCalledOnce());
  });

  it('shows actual source services, dates and historical payments without billing or notification controls', () => {
    const shoot = {
      id: '167', status: 'import_draft',
      external_booking_payload: {
        source_snapshot_at: '2026-09-28T08:33:49-04:00',
        source_record: {
          scheduled_date: '2026-09-26', completed_date: '2026-09-27',
          source_record: { 'FULL ADDRESS': '105 Westwick Court, 6', CLIENT: 'Kevin', SERVICES: 'HDR 30 Photos', 'TOTAL PAID': '$176.23', 'CLIENT PHONE': '0012345678' },
          links: [{ text: 'Branded', url: 'https://source.test/tour' }, { text: 'Unsafe', url: 'javascript:alert(1)' }],
        },
      },
      files: [{ id: '1', filename: 'photo-FULL.JPG', media_type: 'edited', url: 'https://media.test/full.jpg', web_url: 'https://media.test/small.jpg' }],
    } as unknown as ShootData;
    render(<PrivateImportReview shoot={shoot} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Private import draft')).toBeInTheDocument();
    expect(screen.getAllByText('HDR 30 Photos').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-09-26')).toBeInTheDocument();
    expect(screen.getByText('2026-09-27')).toBeInTheDocument();
    expect(screen.getAllByText('$176.23').length).toBeGreaterThan(0);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://media.test/small.jpg');
    expect(screen.getByRole('img').closest('a')).toHaveAttribute('href', 'https://media.test/full.jpg');
    expect(screen.queryByRole('button', { name: /notify|payment|paid|invoice|upload|publish|edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
  });
});

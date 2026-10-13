import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getShootMediaRequirements } from './shootMediaRequirements';
import { ShootMediaEmptyState } from './ShootMediaEmptyState';

afterEach(cleanup);
const shoot = { id: '1', serviceItems: [
  { id: 11, shoot_service_id: 11, name: 'HDR Photos', photo_count: 35, upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5 },
  { id: 12, shoot_service_id: 12, name: 'Aerial Photos', photo_count: 10, upload_intake_type: 'photo' },
  { id: 13, shoot_service_id: 13, name: 'Twilight Photos', photo_count: 5, upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 3 },
  { id: 14, shoot_service_id: 14, name: 'Property Video', upload_intake_type: 'video' },
] } as unknown as ShootData;

describe('compact upload requirements', () => {
  it('keeps service rows off the page and exposes the real service targets in a read-only dialog', () => {
    const onUpload = vi.fn();
    render(<ShootMediaEmptyState title="No uploaded files yet" description="Upload property photos to get started." uploadLabel="Upload Files" onUpload={onUpload} requirements={getShootMediaRequirements(shoot, [])} />);
    expect(screen.getByTestId('shoot-media-counts')).toHaveTextContent('200');
    expect(screen.getByTestId('shoot-media-counts')).toHaveTextContent('50');
    expect(screen.queryByText('HDR Photos')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View shoot image requirements' }));
    const dialog = screen.getByRole('dialog', { name: 'Shoot image requirements' });
    expect(within(dialog).getByText('HDR Photos')).toBeVisible();
    expect(within(dialog).getByText('35 final photos × 5 raw images')).toBeVisible();
    expect(within(dialog).getByText('10 final photos × 1 raw image')).toBeVisible();
    expect(within(dialog).getByText('5 final photos × 3 raw images')).toBeVisible();
    expect(within(dialog).getByText('Property Video')).toBeVisible();
    expect(within(dialog).getByText('Video files are separate from photo counts')).toBeVisible();
    expect(onUpload).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload Files' }));
    expect(onUpload).toHaveBeenCalledOnce();
  });
  it('does not invent a denominator or upload capability when a service count is unset', () => {
    const requirements = getShootMediaRequirements({ id: '2', serviceItems: [{ id: 21, shoot_service_id: 21, name: 'Variable photo service', upload_intake_type: 'photo', quantity: 1 }] } as unknown as ShootData, []);
    render(<ShootMediaEmptyState title="No uploaded files yet" description="Media will appear here when it is ready." uploadLabel="Upload Files" requirements={requirements} />);
    expect(screen.getAllByText('Not set')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Upload Files' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View shoot image requirements' }));
    expect(screen.getByText('Photo count not set')).toBeVisible();
  });
  it('retains a generic empty state when internal requirements are not supplied', () => {
    render(<ShootMediaEmptyState title="No edited files yet" description="Media will appear here when it is ready." uploadLabel="Upload Files" />);
    expect(screen.queryByTestId('shoot-media-counts')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View shoot image requirements' })).not.toBeInTheDocument();
  });
});

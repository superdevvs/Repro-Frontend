import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { MediaListRow } from './MediaListRow';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'superadmin' }) }));
afterEach(cleanup);

const props = (): ComponentProps<typeof MediaListRow> => ({
  file: { id: '1', filename: 'DSC_0172.jpg', shoot_service_id: 10, fileSize: 204800, width: 4000, height: 3000 },
  selected: false, canSelect: true, onSelect: vi.fn(), onOpen: vi.fn(),
  previewUrl: '/photo.jpg', hasStillPreview: true, isVideo: false, videoUrl: '', isClient: false,
  actions: <button type="button">Media actions</button>,
});

describe('compact media list rows', () => {
  it('shows the actual property address above its filename and keeps selection over the preview', () => {
    const options = { ...props(), shootAddress: '2703 Maurleen Drive, Baltimore, MD' };
    render(<MediaListRow {...options} />);
    expect(screen.getByRole('button', { name: options.shootAddress })).toBeTruthy();
    expect(screen.getByText('DSC_0172.jpg')).toBeTruthy();
    const checkbox = screen.getByRole('checkbox', { name: 'Select DSC_0172.jpg' });
    expect(checkbox.closest('.shoot-media-list-preview')).toBeTruthy();
    fireEvent.click(checkbox);
    fireEvent.keyDown(checkbox, { key: ' ' });
    expect(options.onSelect).toHaveBeenCalledTimes(2);
    expect(options.onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: options.shootAddress }));
    expect(options.onOpen).toHaveBeenCalledOnce();
  });

  it('uses the filename without inventing an address, and the tools do not open the viewer', () => {
    const options = props();
    render(<MediaListRow {...options} />);
    expect(screen.getByRole('button', { name: 'DSC_0172.jpg' })).toBeTruthy();
    expect(screen.getAllByText('DSC_0172.jpg')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Media actions' }));
    expect(options.onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByAltText('DSC_0172.jpg'));
    expect(options.onOpen).toHaveBeenCalledOnce();
  });

  it('keeps file permissions and badges clear of the selection and sort handles', () => {
    const options = props();
    const { container } = render(<MediaListRow {...options} canSelect={false}
      file={{ ...options.file, is_cover: true, treatment: 'twilight' }}
      dragHandle={<button type="button">Drag to reorder</button>} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Drag to reorder' }).closest('.shoot-media-list-preview')).toBeTruthy();
    expect(screen.getByText('HERO').closest('.shoot-media-list-details')).toBeTruthy();
    expect(screen.getByText('TW').closest('.shoot-media-list-details')).toBeTruthy();
    expect(container.querySelectorAll('.shoot-media-list-actions')).toHaveLength(1);
  });

  it('shows a file fallback after a broken preview without losing selection', () => {
    const { container } = render(<MediaListRow {...props()} selected />);
    fireEvent.error(screen.getByAltText('DSC_0172.jpg'));
    expect((container.querySelector('.file-fallback') as HTMLElement).style.display).toBe('flex');
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';

const mocks = vi.hoisted(() => ({ model: vi.fn(), toast: vi.fn() }));
vi.mock('./shootDownloadCenterModel', () => ({ buildShootDownloadCenterModel: mocks.model }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { ShootDownloadCenterDialog } from './ShootDownloadCenterDialog';

const shoot = { id: 'fixture-shoot', services: [], files: [] } as unknown as ShootData;
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const model = () => ({
  wholeShootPhotoCount: 2,
  services: [],
  editedVideos: [{ id: 'video', label: 'Edited walkthrough.mp4', fileId: 61, kind: 'video', action: 'download' }],
  videoLinks: [
    { id: 'branded-video', label: 'Branded video', kind: 'video', action: 'link', href: 'https://reprodashboard.com/tour/video/branded?shootId=fixture-shoot&unitId=11' },
    { id: 'mls-video', label: 'Unbranded / MLS video', kind: 'video', action: 'link', href: 'https://reprodashboard.com/tour/video/mls?shootId=fixture-shoot&unitId=11' },
    { id: 'generic-video', label: 'Generic video', kind: 'video', action: 'link', href: 'https://reprodashboard.com/tour/video/generic?shootId=fixture-shoot&unitId=11' },
  ],
  threeDLinks: [{ id: 'matterport', label: 'Matterport', kind: 'file', action: 'link', href: 'https://reprodashboard.com/tour/3d/branded?shootId=fixture-shoot&unitId=11&provider=matterport' }],
  floorplanPdfs: [{ id: 'pdf', label: 'Floorplan PDF', fileId: 71, kind: 'floorplan', action: 'download' }],
  floorplanJpgs: [{ id: 'jpg-page-2', label: 'Floorplan page 2 JPG', fileId: 71, format: 'jpg', page: 2, kind: 'floorplan', action: 'download' }],
  tourLinks: [{ id: 'tour', label: 'Branded tour', kind: 'file', action: 'link', href: 'https://reprodashboard.com/tour/branded?shootId=fixture-shoot&unitId=11' }],
});

const renderDialog = (onDownloadFile?: (fileId: string | number, label?: string, options?: { format?: 'jpg'; page?: number }) => void | Promise<void>) =>
  render(<ShootDownloadCenterDialog shoot={shoot} open isClient isDownloading={false} downloadStatusMessage=""
    onOpenChange={vi.fn()} onDownloadArchive={vi.fn()} onDownloadFile={onDownloadFile} />);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.model.mockReturnValue(model());
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('Download Center delivery categories', () => {
  it('renders requested categories in order and offers high res before MLS/small photos', () => {
    renderDialog(vi.fn());
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
      'Photos', 'Edited video files', 'Video only hosted links', '3D links', 'Floorplan PDFs', 'Floorplan JPGs', 'Tour links',
    ]);
    const photos = within(screen.getByRole('region', { name: 'Photos' })).getAllByRole('button');
    expect(photos[0]).toHaveTextContent('High res');
    expect(photos[1]).toHaveTextContent('MLS / small');
  });

  it('omits empty categories and shows the empty state when no deliverables exist', () => {
    const onlyVideo = { ...model(), wholeShootPhotoCount: 0, videoLinks: [], threeDLinks: [], floorplanPdfs: [], floorplanJpgs: [], tourLinks: [] };
    mocks.model.mockReturnValue(onlyVideo);
    const view = renderDialog(vi.fn());
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Edited video files']);
    view.unmount();
    mocks.model.mockReturnValue({ ...onlyVideo, editedVideos: [] });
    renderDialog(vi.fn());
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(screen.getByText('No downloads available yet')).toBeInTheDocument();
  });

  it('opens and copies each exact hosted video variant without treating links as file downloads', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderDialog(vi.fn());
    const section = within(screen.getByRole('region', { name: 'Video only hosted links' }));
    for (const item of model().videoLinks) {
      const open = section.getByRole('link', { name: `Open ${item.label}` });
      expect(open).toHaveAttribute('href', item.href);
      expect(open).toHaveAttribute('target', '_blank');
      expect(open).toHaveAttribute('rel', 'noopener noreferrer');
      expect(open).not.toHaveAttribute('download');
      fireEvent.click(section.getByRole('button', { name: `Copy ${item.label} link` }));
      await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(item.href));
    }
    expect(section.queryByRole('button', { name: /^Download/ })).not.toBeInTheDocument();
  });

  it('requests the selected PDF page as JPG and preserves the original PDF download action', async () => {
    const onDownloadFile = vi.fn().mockResolvedValue(undefined);
    renderDialog(onDownloadFile);
    fireEvent.click(screen.getByRole('button', { name: 'Download Floorplan page 2 JPG' }));
    await waitFor(() => expect(onDownloadFile).toHaveBeenCalledWith(71, 'Floorplan page 2 JPG', { format: 'jpg', page: 2 }));
    const pdf = screen.getByRole('button', { name: 'Download Floorplan PDF' });
    await waitFor(() => expect(pdf).toBeEnabled());
    fireEvent.click(pdf);
    await waitFor(() => expect(onDownloadFile).toHaveBeenLastCalledWith(71, 'Floorplan PDF', undefined));
  });

  it('disables stored-file actions when no file download callback is supplied while hosted links stay available', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Download Edited walkthrough.mp4' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download Floorplan PDF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download Floorplan page 2 JPG' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open Branded video' })).toHaveAttribute('href', model().videoLinks[0].href);
  });
});

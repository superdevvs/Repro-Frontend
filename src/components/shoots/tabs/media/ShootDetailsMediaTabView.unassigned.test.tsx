import { useState, type ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import type { MediaSubTab, ShootDetailsMediaTabViewProps } from './shootDetailsMediaTabViewTypes';
import { ShootDetailsMediaTabView } from './ShootDetailsMediaTabView';

const mocks = vi.hoisted(() => ({ openMark: vi.fn() }));
vi.mock('./ShootMediaHeader', () => ({ ShootMediaHeader: ({ onOpenMark, isClient, renderClientEditedCategoryTabs, selectedFiles, sortMenuOpen, setSortMenuOpen }: {
  onOpenMark: () => void; isClient: boolean; renderClientEditedCategoryTabs: () => ReactNode;
  selectedFiles: Set<string>; sortMenuOpen: boolean; setSortMenuOpen: (open: boolean) => void;
}) => isClient ? renderClientEditedCategoryTabs() : <><button onClick={onOpenMark}>Mark selected files</button>{selectedFiles.size > 0 && <button aria-expanded={sortMenuOpen} onClick={() => setSortMenuOpen(!sortMenuOpen)}>Sort selected files</button>}</> }));
vi.mock('./mark/mediaMarkEvents', () => ({ openMediaMark: mocks.openMark }));
vi.mock('./MediaUploadSections', () => ({ RawUploadSection: () => null, EditedUploadSection: () => null }));
vi.mock('./MediaUploadPanels', () => ({ UploadProgressCard: () => null }));
vi.mock('./MediaGrid', () => ({ MediaGrid: () => <p>Floorplan grid</p> }));
vi.mock('./MediaServiceSections', () => ({ MediaServiceSections: ({ renderGrid, files }: { renderGrid: (files: MediaFile[]) => ReactNode; files: MediaFile[] }) => renderGrid(files) }));
vi.mock('./IguideMediaPanel', () => ({ IguideMediaPanel: () => <p>iGUIDE panel</p> }));
vi.mock('./MediaPresentationSelectionActions', () => ({ MediaPresentationSelectionActions: () => null }));

const photo: MediaFile = { id: 'photo', filename: 'assigned.jpg', shoot_service_id: 12 };
const orphan: MediaFile = { id: 'outside-unit', filename: 'unassigned.jpg' };
const floorplan: MediaFile = { id: 'floorplan', filename: 'floorplan.jpg', shoot_service_id: 13 };

function props(): ShootDetailsMediaTabViewProps {
  return {
    role: 'admin', isAdmin: true, isClient: false, isPhotographer: false, isEditor: false,
    shoot: { id: '5912', location: { address: 'Test property' } } as ShootData,
    downloadPopup: { visible: false } as ShootDetailsMediaTabViewProps['downloadPopup'],
    handleManualDownload: vi.fn(), closeDownloadPopup: vi.fn(),
    activeSubTab: 'uploaded', displayTab: 'uploaded', defaultTab: 'uploaded',
    rawFiles: [photo], editedFiles: [photo], unassignedFiles: [],
    setActiveSubTab: vi.fn(), setDisplayTab: vi.fn(),
    mediaViewMode: 'grid', toggleMediaViewMode: vi.fn(), sortOrder: 'manual', isDragMode: false,
    sortSaveStatus: 'idle', changeSortOrder: vi.fn(), toggleDragMode: vi.fn(),
    activeShootUploads: [], showUploadTab: false, selectedFiles: new Set(),
    setRequestManagerOpen: vi.fn(), downloading: false,
    handleDownload: vi.fn(), handleDeleteFiles: vi.fn(), handleGenerateShareLink: vi.fn(), handleEditorDownloadRaw: vi.fn(),
    canDelete: true, canDownload: true, handleReclassify: vi.fn(), markMenuOptions: [],
    directUploading: false, directUploadCompleted: 0, directUploadTotal: 0, directUploadProgress: 0, dragOverTab: null,
    handleTabDragEnter: vi.fn(), handleTabDragLeave: vi.fn(), handleTabDragOver: vi.fn(), handleDirectDrop: vi.fn(),
    uploadedMediaTab: 'photos', setUploadedMediaTab: vi.fn(), uploadedPhotos: [photo], uploadedVideos: [],
    shootHasVideoService: false, iguideUrl: '', iguideFloorplans: [], uploadedFloorplans: [floorplan],
    uploadedVirtualStaging: [], uploadedGreenGrass: [], uploadedTwilight: [], uploadedDrone: [], uploadedExtras: [],
    renderMediaGridPane: (files) => <p>Files: {files.map(file => file.filename).join(', ')}</p>,
    renderAdminUploadSection: () => <p>Upload controls</p>, toast: vi.fn(),
    queryClient: { invalidateQueries: vi.fn() } as unknown as ShootDetailsMediaTabViewProps['queryClient'], onShootUpdate: vi.fn(),
    clientEditedMediaTabs: [{ id: 'photos', label: 'Photos (1)' }], editedMediaTab: 'photos', setEditedMediaTab: vi.fn(),
    editedPhotos: [photo], editedVideos: [], editedFloorplans: [floorplan], editedVirtualStaging: [], editedGreenGrass: [],
    editedTwilight: [], editedDrone: [], editedExtras: [], openViewer: vi.fn(), toggleSelection: vi.fn(), setSelectedFiles: vi.fn(),
    manualOrder: [], handleManualOrderChange: vi.fn(), getImageUrl: vi.fn(), getSrcSet: vi.fn(),
    isPreviewableImage: () => true, isVideoFile: () => false, toggleFileHidden: vi.fn(),
  };
}

function StatefulView({ options }: { options: ShootDetailsMediaTabViewProps }) {
  const [uploadedMediaTab, setUploadedMediaTab] = useState<MediaSubTab>('photos');
  const [editedMediaTab, setEditedMediaTab] = useState<MediaSubTab>('photos');
  return <ShootDetailsMediaTabView {...options} uploadedMediaTab={uploadedMediaTab} setUploadedMediaTab={setUploadedMediaTab} editedMediaTab={editedMediaTab} setEditedMediaTab={setEditedMediaTab} />;
}

afterEach(() => { cleanup(); mocks.openMark.mockReset(); });

describe('Unassigned media category', () => {
  it('hides the empty filter for admins while retaining the normal categories', () => {
    render(<StatefulView options={props()} />);
    const tabs = screen.getByRole('tablist', { name: 'Media categories' });
    expect(within(tabs).getByRole('tab', { name: 'Photos (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(within(tabs).getByRole('tab', { name: 'Floor Plans (1)' })).toBeVisible();
    expect(screen.queryByText(/Unassigned/)).not.toBeInTheDocument();
  });

  it.each(['uploaded', 'edited'] as const)('keeps Unassigned in the %s category row with one active category', async (collection) => {
    const user = userEvent.setup();
    const options = { ...props(), displayTab: collection, activeSubTab: collection, unassignedFiles: [orphan] };
    render(<StatefulView options={options} />);
    const tabs = screen.getByRole('tablist', { name: 'Media categories' });
    const unassigned = within(tabs).getByRole('tab', { name: 'Unassigned (1)' });
    const photos = within(tabs).getByRole('tab', { name: 'Photos (1)' });
    await user.click(unassigned);
    expect(unassigned).toHaveAttribute('aria-selected', 'true');
    expect(unassigned).toHaveClass('bg-primary');
    expect(photos).toHaveAttribute('aria-selected', 'false');
    expect(photos).toHaveClass('bg-muted');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Files: unassigned.jpg');
    expect(screen.getByRole('tablist', { name: 'Media categories' })).toBe(tabs);
    await user.click(within(tabs).getByRole('tab', { name: 'Floor Plans (1)' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Floorplan grid');
    expect(unassigned).toHaveAttribute('aria-selected', 'false');
    expect(options.setSelectedFiles).toHaveBeenCalledTimes(2);
  });

  it('returns to the normal category when the final unassigned file is fixed and stays there after later uploads', async () => {
    const user = userEvent.setup();
    const options = { ...props(), unassignedFiles: [orphan] };
    const { rerender } = render(<StatefulView options={options} />);
    await user.click(screen.getByRole('tab', { name: 'Unassigned (1)' }));
    rerender(<StatefulView options={{ ...options, unassignedFiles: [] }} />);
    expect(screen.queryByRole('tab', { name: /Unassigned/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Photos (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Files: assigned.jpg');
    rerender(<StatefulView options={options} />);
    expect(screen.getByRole('tab', { name: 'Photos (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Unassigned (1)' })).toHaveAttribute('aria-selected', 'false');
  });

  it('resets the filter between Raw and Edited and when opening another shoot', async () => {
    const user = userEvent.setup();
    const options = { ...props(), unassignedFiles: [orphan] };
    const { rerender } = render(<StatefulView options={options} />);
    await user.click(screen.getByRole('tab', { name: 'Unassigned (1)' }));
    rerender(<StatefulView options={{ ...options, displayTab: 'edited', activeSubTab: 'edited' }} />);
    expect(screen.getByRole('tab', { name: 'Photos (1)' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Unassigned (1)' }));
    rerender(<StatefulView options={{ ...options, shoot: { ...options.shoot, id: 'new-shoot' } }} />);
    expect(screen.getByRole('tab', { name: 'Photos (1)' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps cross-unit files available to the existing Mark assignment workflow', async () => {
    const user = userEvent.setup();
    const options = { ...props(), unassignedFiles: [orphan], selectedFiles: new Set([orphan.id]) };
    render(<StatefulView options={options} />);
    await user.click(screen.getByRole('button', { name: 'Mark selected files' }));
    expect(mocks.openMark).toHaveBeenCalledWith(expect.objectContaining({ shootId: '5912', files: [orphan], allowType: true }));
  });

  it('keeps the filter reachable when the active unit has no normal files', async () => {
    const user = userEvent.setup();
    render(<StatefulView options={{ ...props(), rawFiles: [], uploadedPhotos: [], uploadedFloorplans: [], unassignedFiles: [orphan] }} />);
    await user.click(screen.getByRole('tab', { name: 'Unassigned (1)' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Files: unassigned.jpg');
    expect(screen.getByRole('tab', { name: 'Photos (0)' })).toBeVisible();
  });

  it('never offers the repair category to clients', () => {
    render(<StatefulView options={{ ...props(), isClient: true, isAdmin: false, role: 'client', displayTab: 'edited', activeSubTab: 'edited', unassignedFiles: [orphan] }} />);
    expect(screen.queryByRole('tab', { name: /Unassigned/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Files: assigned.jpg');
  });

  it('keeps client category navigation working through the existing header controls', async () => {
    const user = userEvent.setup();
    render(<StatefulView options={{ ...props(), isClient: true, isAdmin: false, role: 'client', displayTab: 'edited', activeSubTab: 'edited',
      clientEditedMediaTabs: [{ id: 'photos', label: 'Photos (1)' }, { id: 'floorplans', label: 'Floor Plans (1)' }],
    }} />);
    await user.click(screen.getByRole('button', { name: 'Floor Plans (1)' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Floorplan grid');
    await user.click(screen.getByRole('button', { name: 'Photos (1)' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Files: assigned.jpg');
  });

  it('closes the selected-file sort menu when selection clears or the media collection changes', async () => {
    const user = userEvent.setup();
    const options = { ...props(), selectedFiles: new Set([photo.id]) };
    const { rerender } = render(<StatefulView options={options} />);
    await user.click(screen.getByRole('button', { name: 'Sort selected files' }));
    expect(screen.getByRole('button', { name: 'Sort selected files' })).toHaveAttribute('aria-expanded', 'true');
    rerender(<StatefulView options={{ ...options, selectedFiles: new Set() }} />);
    expect(screen.queryByRole('button', { name: 'Sort selected files' })).not.toBeInTheDocument();
    rerender(<StatefulView options={options} />);
    expect(screen.getByRole('button', { name: 'Sort selected files' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Sort selected files' }));
    rerender(<StatefulView options={{ ...options, displayTab: 'edited', activeSubTab: 'edited' }} />);
    expect(screen.getByRole('button', { name: 'Sort selected files' })).toHaveAttribute('aria-expanded', 'false');
  });
});

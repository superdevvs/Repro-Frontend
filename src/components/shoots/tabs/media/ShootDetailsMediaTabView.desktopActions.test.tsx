import { useState, type ReactNode } from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import type { MediaSubTab, ShootDetailsMediaTabViewProps } from './shootDetailsMediaTabViewTypes';
import { ShootDetailsMediaTabView } from './ShootDetailsMediaTabView';

const mocks = vi.hoisted(() => ({ openMark: vi.fn() }));
vi.mock('./mark/mediaMarkEvents', () => ({ openMediaMark: mocks.openMark }));
vi.mock('./MediaUploadSections', () => ({ RawUploadSection: () => null, EditedUploadSection: () => null }));
vi.mock('./MediaUploadPanels', () => ({ UploadProgressCard: () => null }));
vi.mock('./RawDownloadBatches', () => ({ RawDownloadBatches: () => null }));
vi.mock('./MediaGrid', () => ({ MediaGrid: () => <p>Floorplan grid</p> }));
vi.mock('./MediaServiceSections', () => ({ MediaServiceSections: ({ renderGrid, files }: { renderGrid: (files: MediaFile[]) => ReactNode; files: MediaFile[] }) => renderGrid(files) }));
vi.mock('./IguideMediaPanel', () => ({ IguideMediaPanel: () => <p>iGUIDE panel</p> }));

let desktop = true;
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
beforeEach(() => {
  desktop = true;
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query === '(min-width: 1024px)' && desktop; },
    media: query,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
  })));
});
afterEach(() => { cleanup(); mediaListeners.clear(); mocks.openMark.mockReset(); vi.unstubAllGlobals(); });

function resizeDesktop(matches: boolean) {
  act(() => {
    desktop = matches;
    mediaListeners.forEach(listener => listener({ matches, media: '(min-width: 1024px)' } as MediaQueryListEvent));
  });
}

const photo: MediaFile = {
  id: 'photo', filename: 'assigned.jpg', shoot_service_id: 12,
  media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, can_set_hero: true,
};
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
    activeShootUploads: [], showUploadTab: false, selectedFiles: new Set([photo.id]),
    setRequestManagerOpen: vi.fn(), downloading: false,
    handleDownload: vi.fn(), handleDeleteFiles: vi.fn(), handleGenerateShareLink: vi.fn(), handleEditorDownloadRaw: vi.fn(),
    canDelete: true, canDownload: true, handleReclassify: vi.fn(), markMenuOptions: [],
    directUploading: false, directUploadCompleted: 0, directUploadTotal: 0, directUploadProgress: 0, dragOverTab: null,
    handleTabDragEnter: vi.fn(), handleTabDragLeave: vi.fn(), handleTabDragOver: vi.fn(), handleDirectDrop: vi.fn(),
    uploadedMediaTab: 'photos', setUploadedMediaTab: vi.fn(), uploadedPhotos: [photo], uploadedVideos: [],
    shootHasVideoService: false, iguideUrl: '', iguideFloorplans: [], uploadedFloorplans: [floorplan],
    uploadedVirtualStaging: [], uploadedGreenGrass: [], uploadedTwilight: [], uploadedDrone: [], uploadedExtras: [],
    renderMediaGridPane: files => <p>Files: {files.map(file => file.filename).join(', ')}</p>,
    renderAdminUploadSection: () => <p>Upload controls</p>, toast: vi.fn(),
    queryClient: { invalidateQueries: vi.fn() } as unknown as ShootDetailsMediaTabViewProps['queryClient'], onShootUpdate: vi.fn(),
    clientEditedMediaTabs: [{ id: 'photos', label: 'Photos (1)' }, { id: 'videos', label: 'Video (0)' }],
    editedMediaTab: 'photos', setEditedMediaTab: vi.fn(),
    editedPhotos: [photo], editedVideos: [], editedFloorplans: [floorplan], editedVirtualStaging: [], editedGreenGrass: [],
    editedTwilight: [], editedDrone: [], editedExtras: [], openViewer: vi.fn(), toggleSelection: vi.fn(), setSelectedFiles: vi.fn(),
    manualOrder: [], handleManualOrderChange: vi.fn(), getImageUrl: vi.fn(), getSrcSet: vi.fn(),
    isPreviewableImage: () => true, isVideoFile: () => false, toggleFileHidden: vi.fn(), toggleFilesHidden: vi.fn(), onSetHero: vi.fn(),
  };
}

function StatefulView({ options }: { options: ShootDetailsMediaTabViewProps }) {
  const [uploadedMediaTab, setUploadedMediaTab] = useState<MediaSubTab>('photos');
  const [editedMediaTab, setEditedMediaTab] = useState<MediaSubTab>('photos');
  return <ShootDetailsMediaTabView {...options} uploadedMediaTab={uploadedMediaTab} setUploadedMediaTab={setUploadedMediaTab} editedMediaTab={editedMediaTab} setEditedMediaTab={setEditedMediaTab} />;
}

describe('desktop media selection action placement', () => {
  it.each(['uploaded', 'edited'] as const)('places one action group beside the %s category tabs and keeps secondary actions in More', async collection => {
    const user = userEvent.setup();
    const options = { ...props(), displayTab: collection, activeSubTab: collection };
    render(<StatefulView options={options} />);
    const categoryBar = screen.getByRole('group', { name: 'Media categories and actions' });
    const tabs = within(categoryBar).getByRole('tablist', { name: 'Media categories' });
    expect(within(tabs).getByRole('tab', { name: 'Photos (1)' })).toBeVisible();
    const actions = within(categoryBar).getByRole('group', { name: 'Media actions' });
    expect(screen.getAllByRole('group', { name: 'Media actions' })).toHaveLength(1);
    expect(tabs.contains(actions)).toBe(false);
    expect(tabs.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(actions).getAllByRole('button', { name: 'Choose media sort order' })).toHaveLength(1);
    expect(within(actions).getByRole('button', { name: 'Mark' })).toBeVisible();
    await user.click(within(actions).getByRole('button', { name: 'Delete selected files' }));
    expect(options.handleDeleteFiles).toHaveBeenCalledOnce();
    await user.click(within(actions).getByRole('button', { name: 'Mark' }));
    expect(mocks.openMark).toHaveBeenCalledWith(expect.objectContaining({ shootId: '5912', files: [photo], allowType: true }));
    expect(within(actions).queryByRole('button', { name: 'Download selected files' })).not.toBeInTheDocument();
    expect(within(actions).queryByRole('button', { name: 'Hide selected' })).not.toBeInTheDocument();
    await user.click(within(actions).getByRole('button', { name: 'More selected file actions' }));
    expect(screen.queryByRole('menuitem', { name: /Delete|Mark media/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Print Resolution/ })).toBeVisible();
    await user.click(screen.getByRole('menuitem', { name: 'Hide selected' }));
    expect(options.toggleFilesHidden).toHaveBeenCalledExactlyOnceWith([photo.id], true);
    await user.click(within(actions).getByRole('button', { name: 'More selected file actions' }));
    await user.click(screen.getByRole('menuitem', { name: /MLS Optimized/ }));
    expect(options.handleDownload).toHaveBeenCalledExactlyOnceWith('small');
    expect(options.handleEditorDownloadRaw).not.toHaveBeenCalled();
  });

  it('keeps the desktop category row and hides all selection actions when nothing is selected', () => {
    render(<StatefulView options={{ ...props(), selectedFiles: new Set() }} />);
    expect(screen.getByRole('tablist', { name: 'Media categories' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Media actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose media sort order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete selected files' })).not.toBeInTheDocument();
  });

  it('places desktop client actions once at the end of their Header category row without granting staff controls', async () => {
    const user = userEvent.setup();
    const options = { ...props(), role: 'client', isClient: true, isAdmin: false, canDelete: false,
      activeSubTab: 'edited' as const, displayTab: 'edited' as const };
    render(<StatefulView options={options} />);
    const photos = screen.getByRole('button', { name: 'Photos (1)' });
    const primaryRow = photos.closest('.shoot-media-primary-controls') as HTMLElement;
    expect(primaryRow).toBeTruthy();
    const actions = within(primaryRow).getByRole('group', { name: 'Media actions' });
    expect(screen.getAllByRole('group', { name: 'Media actions' })).toHaveLength(1);
    expect(within(actions).getByRole('button', { name: 'Choose media sort order' })).toBeVisible();
    expect(within(actions).queryByRole('button', { name: 'Mark' })).not.toBeInTheDocument();
    expect(within(actions).queryByRole('button', { name: 'Delete selected files' })).not.toBeInTheDocument();
    await user.click(within(actions).getByRole('button', { name: 'More selected file actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create request' }));
    expect(options.setRequestManagerOpen).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('keeps the mobile selection strip separate from category tabs and retains its download control', () => {
    desktop = false;
    render(<StatefulView options={props()} />);
    const categoryBar = screen.getByRole('group', { name: 'Media categories and actions' });
    expect(within(categoryBar).queryByRole('group', { name: 'Media actions' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: 'Media actions' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Download selected files' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete selected files' })).not.toBeInTheDocument();
  });

  it('moves one live set of controls across desktop and mobile while keeping pending Save available', async () => {
    const user = userEvent.setup();
    const options = { ...props(), isDragMode: true, sortSaveStatus: 'error' as const };
    render(<StatefulView options={options} />);
    const categoryBar = screen.getByRole('group', { name: 'Media categories and actions' });
    expect(within(categoryBar).getByRole('button', { name: 'Save media order' })).toBeVisible();
    resizeDesktop(false);
    expect(screen.getAllByRole('group', { name: 'Media actions' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Save media order' })).toHaveLength(1);
    expect(within(categoryBar).queryByRole('button', { name: 'Save media order' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save media order' }));
    expect(options.toggleDragMode).toHaveBeenCalledOnce();
    resizeDesktop(true);
    expect(screen.getAllByRole('group', { name: 'Media actions' })).toHaveLength(1);
    expect(within(categoryBar).getByRole('button', { name: 'Save media order' })).toBeVisible();
  });

  it('retains a desktop Header fallback during Upload when no category bar exists', () => {
    render(<StatefulView options={{ ...props(), activeSubTab: 'upload' }} />);
    expect(screen.queryByRole('group', { name: 'Media categories and actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Media actions' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose media sort order' })).toBeVisible();
    expect(screen.getByText('Upload controls')).toBeVisible();
  });

  it('keeps the photographer Header fallback when the Edited lane has no in-app category bar', () => {
    render(<StatefulView options={{ ...props(), role: 'photographer', isPhotographer: true, isAdmin: false,
      activeSubTab: 'edited', displayTab: 'edited', canDelete: false }} />);
    expect(screen.queryByRole('group', { name: 'Media categories and actions' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: 'Media actions' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Choose media sort order' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete selected files' })).not.toBeInTheDocument();
  });

  it('keeps editor RAW download routing in More and never enables the restricted Sort control', async () => {
    const user = userEvent.setup();
    const options = { ...props(), role: 'editor', isEditor: true, isAdmin: false, canDelete: false };
    render(<StatefulView options={options} />);
    const actions = within(screen.getByRole('group', { name: 'Media categories and actions' })).getByRole('group', { name: 'Media actions' });
    expect(within(actions).queryByRole('button', { name: 'Choose media sort order' })).not.toBeInTheDocument();
    expect(within(actions).queryByRole('button', { name: 'Mark' })).not.toBeInTheDocument();
    await user.click(within(actions).getByRole('button', { name: 'More selected file actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download selected RAW files' }));
    expect(options.handleEditorDownloadRaw).toHaveBeenCalledExactlyOnceWith(false);
    expect(options.handleDownload).not.toHaveBeenCalled();
  });
});

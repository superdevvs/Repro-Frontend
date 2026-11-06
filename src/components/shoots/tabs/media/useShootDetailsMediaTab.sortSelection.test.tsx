import { Children, isValidElement, type ReactElement } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import type { ShootDetailsMediaTabViewProps } from './shootDetailsMediaTabViewTypes';
import { useShootDetailsMediaTab } from './useShootDetailsMediaTab';

const mocks = vi.hoisted(() => ({
  raw: [{ id: '1', filename: '01.jpg' }, { id: '2', filename: '02.jpg' }],
  edited: [{ id: '3', filename: '03.jpg' }],
  emptyUnit: false,
  allRaw: null as MediaFile[] | null,
  desktop: false,
  uploads: [],
  toast: vi.fn(),
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 99, role: 'superadmin' } }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ uploads: mocks.uploads, trackUpload: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => mocks.desktop }));
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-query')>(),
  useQueryClient: () => mocks.queryClient,
}));
vi.mock('@/features/shoot-units/useUnitMediaScope', () => ({
  useUnitMediaScope: (shoot: ShootData) => ({ shoot, activeUnitId: mocks.emptyUnit ? 'unit-1' : null }),
  useScopedShootFiles: (_shoot: ShootData, _unitId: null, lane: string) => ({
    data: mocks.emptyUnit ? [] : lane === 'raw' ? mocks.raw : mocks.edited,
    allData: lane === 'raw' ? mocks.allRaw ?? mocks.raw : mocks.edited,
    isLoading: false,
  }),
}));
vi.mock('@/services/autoenhanceService', () => ({ autoenhanceService: { getEditingTypes: async () => [] } }));
vi.mock('./useShootMediaActions', () => ({ markMenuOptions: [], useShootMediaActions: () => ({}) }));
vi.mock('./usePostRenameBatchPrompt', () => ({ usePostRenameBatchPrompt: () => ({}) }));
vi.mock('./useShootFileScanStatusRenderer', () => ({ useShootFileScanStatusRenderer: () => () => null }));
vi.mock('./ShootDetailsMediaTabView', () => ({ ShootDetailsMediaTabView: () => null }));
vi.mock('./ShootDetailsMediaTabDialogs', () => ({ ShootDetailsMediaTabDialogs: () => null }));

const shoot = { id: '5933', status: 'scheduled' } as ShootData;
const options = { shoot, role: 'superadmin', isAdmin: true, isPhotographer: false, isEditor: false,
  isClient: false, onShootUpdate: vi.fn() };
const success = () => new Response('{}', { status: 200 });
const failure = () => new Response('{"message":"Offline"}', { status: 503 });

function setup() {
  const hook = renderHook(supplied => useShootDetailsMediaTab(supplied), { initialProps: options });
  const controls = () => {
    const view = Children.toArray(hook.result.current.props.children)
      .find(child => isValidElement(child) && 'changeSortOrder' in (child.props as object));
    return (view as ReactElement<ShootDetailsMediaTabViewProps>).props;
  };
  const select = (ids: string[]) => act(() => controls().setSelectedFiles(new Set(ids)));
  const drag = () => act(() => controls().handleManualOrderChange(mocks.raw as MediaFile[], ['2', '1']));
  return { ...hook, controls, select, drag };
}

beforeEach(() => {
  localStorage.clear();
  mocks.toast.mockClear();
  mocks.queryClient.invalidateQueries.mockClear();
  mocks.emptyUnit = false;
  mocks.allRaw = null;
  mocks.desktop = false;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => success()));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('selection-scoped media sorting', () => {
  it('reports potential Delete capability separately from an actionable selection', () => {
    const view = setup();
    expect(view.controls().hasDeletableFiles).toBe(true);
    expect(view.controls().canDelete).toBe(false);
    view.select(['1']);
    expect(view.controls().canDelete).toBe(true);
    view.select([]);
    expect(view.controls().hasDeletableFiles).toBe(true);
    expect(view.controls().canDelete).toBe(false);
    view.rerender({ ...options, role: 'editor', isEditor: true, isAdmin: false });
    expect(view.controls().hasDeletableFiles).toBe(false);
  });

  it('sorts, drags, and saves on desktop without selecting images', async () => {
    mocks.desktop = true;
    const view = setup();
    await act(async () => view.controls().changeSortOrder('name'));
    expect(view.controls().sortOrder).toBe('name');
    await act(async () => view.controls().changeSortOrder('manual'));
    expect(view.controls().isDragMode).toBe(true);
    view.drag();
    await act(async () => view.controls().toggleDragMode());
    expect(view.controls().selectedFiles.size).toBe(0);
    expect(view.controls().isDragMode).toBe(false);
    expect(view.controls().sortSaveStatus).toBe('saved');
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ file_ids: [2, 1, 3] });
  });

  it('retains and retries a failed desktop save without a selection', async () => {
    mocks.desktop = true;
    vi.mocked(fetch).mockImplementationOnce(async () => failure());
    const view = setup();
    await act(async () => view.controls().changeSortOrder('manual'));
    view.drag();
    await act(async () => view.controls().toggleDragMode());
    expect(view.controls().sortSaveStatus).toBe('error');
    expect(view.controls().manualOrder).toEqual(['2', '1', '3']);
    expect(view.controls().isDragMode).toBe(true);
    await act(async () => view.controls().toggleDragMode());
    expect(view.controls().sortSaveStatus).toBe('saved');
    expect(view.controls().isDragMode).toBe(false);
    expect(view.controls().selectedFiles.size).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('continues desktop manual sorting when its image selection is cleared', async () => {
    mocks.desktop = true;
    const view = setup();
    view.select(['1']);
    await act(async () => view.controls().changeSortOrder('manual'));
    view.select([]);
    expect(view.controls().isDragMode).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => view.controls().toggleDragMode());
    expect(view.controls().isDragMode).toBe(false);
  });

  it.each(['lane', 'breakpoint'] as const)('flushes a pending desktop drag and blocks an outdated async sort after a %s change', async target => {
    mocks.desktop = true;
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = setup();
    await act(async () => view.controls().changeSortOrder('manual'));
    view.drag();
    let changing!: Promise<void>;
    act(() => { changing = view.controls().changeSortOrder('name') as unknown as Promise<void>; });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    if (target === 'lane') act(() => view.controls().setDisplayTab('edited'));
    else { mocks.desktop = false; view.rerender(options); }
    expect(view.controls().isDragMode).toBe(false);
    await act(async () => { finish(success()); await changing; });
    expect(view.controls().sortOrder).toBe('manual');
    expect(view.controls().isDragMode).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ file_ids: [2, 1, 3] });
  });

  it('keeps mobile sort changes unavailable without a selection', async () => {
    const view = setup();
    await act(async () => view.controls().changeSortOrder('name'));
    expect(view.controls().sortOrder).toBe('time');
    await act(async () => view.controls().changeSortOrder('manual'));
    expect(view.controls().sortOrder).toBe('time');
    expect(view.controls().isDragMode).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('flushes a closing shoot draft through its original writer before the new shoot can accept drags', async () => {
    mocks.desktop = true;
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = setup();
    await act(async () => view.controls().changeSortOrder('manual'));
    view.drag();
    view.rerender({ ...options, shoot: { ...shoot, id: '6000' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/shoots/5933/files/reorder');
    expect(view.controls().isDragMode).toBe(false);
    await act(async () => { finish(success()); });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    { label: 'selectable unassigned media', assigned: false, allowed: true, retained: true },
    { label: 'unassigned media without permissions', assigned: false, allowed: false, retained: false },
    { label: 'assigned media from another unit', assigned: true, allowed: true, retained: false },
  ])('preserves permissions for $label when the active unit is empty', ({ assigned, allowed, retained }) => {
    mocks.emptyUnit = true;
    mocks.allRaw = [{ id: '90', filename: 'other-unit.jpg', shoot_service_id: assigned ? 7 : undefined,
      can_download: allowed, can_delete: allowed, can_manage_visibility: allowed, can_interact: allowed }];
    const view = setup();
    view.select(['90']);
    expect([...view.controls().selectedFiles]).toEqual(retained ? ['90'] : []);
  });

  it('keeps the selected IDs through sort changes, dragging, saving, and restarting', async () => {
    const view = setup();
    view.select(['1']);
    await act(async () => view.controls().changeSortOrder('name'));
    expect([...view.controls().selectedFiles]).toEqual(['1']);
    await act(async () => view.controls().changeSortOrder('manual'));
    expect(view.controls().isDragMode).toBe(true);
    expect([...view.controls().selectedFiles]).toEqual(['1']);
    view.drag();
    await act(async () => view.controls().toggleDragMode());
    expect(view.controls().isDragMode).toBe(false);
    expect([...view.controls().selectedFiles]).toEqual(['1']);
    expect(view.controls().sortSaveStatus).toBe('saved');
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ file_ids: [2, 1, 3] });
    await act(async () => view.controls().changeSortOrder('manual'));
    expect(view.controls().isDragMode).toBe(true);
    expect([...view.controls().selectedFiles]).toEqual(['1']);
  });

  it('flushes when selection clears, retains failed drafts, and retries after reselecting', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => failure());
    const view = setup();
    view.select(['1']);
    await act(async () => view.controls().changeSortOrder('manual'));
    view.drag();
    view.select([]);
    await waitFor(() => expect(view.controls().sortSaveStatus).toBe('error'));
    expect(view.controls().isDragMode).toBe(false);
    expect(view.controls().manualOrder).toEqual(['2', '1', '3']);
    view.select(['2']);
    await act(async () => view.controls().toggleDragMode());
    expect(view.controls().sortSaveStatus).toBe('saved');
    expect(view.controls().isDragMode).toBe(false);
    expect([...view.controls().selectedFiles]).toEqual(['2']);
    expect(vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(init!.body as string)))
      .toEqual([{ file_ids: [2, 1, 3] }, { file_ids: [2, 1, 3] }]);
  });

  it('flushes the same pending arrangement on lane switch and does not rearm dragging after an in-flight save', async () => {
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = setup();
    view.select(['1']);
    await act(async () => view.controls().changeSortOrder('manual'));
    view.drag();
    let saving!: Promise<void>;
    act(() => { saving = view.controls().toggleDragMode() as unknown as Promise<void>; });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    act(() => view.controls().setDisplayTab('edited'));
    expect(view.controls().selectedFiles.size).toBe(0);
    expect(view.controls().isDragMode).toBe(false);
    view.select(['3']);
    await act(async () => { finish(success()); await saving; });
    expect(view.controls().isDragMode).toBe(false);
    expect([...view.controls().selectedFiles]).toEqual(['3']);
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ file_ids: [2, 1, 3] });
  });
});

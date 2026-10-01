import { cleanup, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { MediaGridProps } from './mediaGridTypes';
import { MediaGrid } from './MediaGrid';
import { useMediaViewerController } from './useMediaViewerController';

const auth = vi.hoisted(() => ({
  role: undefined as string | undefined,
  // The active viewing role must win over a saved privileged user/impersonator.
  user: { role: 'superadmin', secondary_roles: ['editing_manager'] },
  originalUser: { role: 'superadmin' },
}));

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => true }));

const roleCases = [
  { role: 'superadmin', allowed: true },
  { role: 'editing_manager', allowed: true },
  { role: 'client', allowed: false },
  { role: 'photographer', allowed: false },
  { role: 'editor', allowed: false },
  { role: 'salesRep', allowed: false },
  { role: 'admin', allowed: false },
  { role: undefined, allowed: false },
] as const;

const files: MediaFile[] = [
  { id: 'snake-ai', filename: 'hero.jpg', fileType: 'image/jpeg', is_ai_edited: true, is_cover: true },
  { id: 'camel-ai', filename: 'staged.jpg', fileType: 'image/jpeg', isAiEdited: true, treatment: 'virtual_staging' },
  { id: 'extra-ai', filename: 'extra.jpg', fileType: 'image/jpeg', is_ai_edited: true, isExtra: true, treatment: 'green_grass' },
] as MediaFile[];

const gridProps: MediaGridProps = {
  files,
  onFileClick: vi.fn(),
  selectedFiles: new Set<string>(),
  onSelectionChange: vi.fn(),
  canSelect: false,
  getImageUrl: () => '/photo.jpg',
  getSrcSet: () => '',
  isImage: () => true,
};

const viewerProps = {
  isOpen: true,
  files,
  currentIndex: 0,
  onClose: vi.fn(),
  onIndexChange: vi.fn(),
  getImageUrl: () => '/photo.jpg',
};

beforeEach(() => { auth.role = undefined; });
afterEach(cleanup);

describe.each([
  { name: 'grid', viewMode: 'grid', sortable: false },
  { name: 'list', viewMode: 'list', sortable: false },
  { name: 'sortable grid', viewMode: 'grid', sortable: true },
  { name: 'sortable list', viewMode: 'list', sortable: true },
] as const)('AI provenance in $name', ({ viewMode, sortable }) => {
  it.each(roleCases)('uses the active $role role without hiding other badges', ({ role, allowed }) => {
    auth.role = role;
    render(<MediaGrid
      {...gridProps}
      viewMode={viewMode}
      isClient={role === 'client'}
      sortOrder={sortable ? 'manual' : 'time'}
      manualSortActive={sortable}
      manualOrder={files.map((file) => file.id)}
      onManualOrderChange={vi.fn()}
    />);

    expect(screen.queryAllByText('AI', { exact: true })).toHaveLength(allowed ? 3 : 0);
    expect(screen.getByText('HERO', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('EXTRA', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('VS', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('GG', { exact: true })).toBeInTheDocument();
  });
});

describe('AI provenance in the shared media viewer controller', () => {
  it.each(roleCases)('includes the detail row only for allowed active role $role', ({ role, allowed }) => {
    auth.role = role;
    const { result, rerender } = renderHook(({ currentIndex }) => useMediaViewerController({
      ...viewerProps,
      currentIndex,
      isClient: role === 'client',
      isAdmin: ['admin', 'superadmin', 'editing_manager'].includes(role ?? ''),
    }), { initialProps: { currentIndex: 0 } });

    const expectAiRow = () => {
      const row = result.current?.detailRows.find((detail) => detail.label === 'Edited with AI');
      expect(row).toEqual(allowed ? { label: 'Edited with AI', value: 'Yes' } : undefined);
      expect(result.current?.detailRows.some((detail) => detail.label === 'Type')).toBe(true);
    };
    expectAiRow();
    rerender({ currentIndex: 1 });
    expectAiRow();
  });

  it('removes both existing grid badges and viewer details when the mounted viewing role changes to client', () => {
    auth.role = 'superadmin';
    const grid = render(<MediaGrid {...gridProps} viewMode="grid" />);
    const viewer = renderHook(() => useMediaViewerController(viewerProps));
    expect(screen.getAllByText('AI', { exact: true })).toHaveLength(3);
    expect(viewer.result.current?.detailRows.some((row) => row.label === 'Edited with AI')).toBe(true);

    auth.role = 'client';
    grid.rerender(<MediaGrid {...gridProps} viewMode="grid" isClient />);
    viewer.rerender();

    expect(screen.queryByText('AI', { exact: true })).not.toBeInTheDocument();
    expect(viewer.result.current?.detailRows.some((row) => row.label === 'Edited with AI')).toBe(false);
    expect(screen.getByText('HERO', { exact: true })).toBeInTheDocument();
  });
});

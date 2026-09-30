import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { transformShootFromApi } from '@/context/shootNormalization';
import { ShootSettingsTab } from './ShootSettingsTab';

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { id: '1', role: 'admin' } }) }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://reprodashboard.com' }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/components/invoices/PaymentDialog', () => ({ PaymentDialog: () => null }));
vi.mock('@/components/dashboard/ShootAutoEditSettings', () => ({ ShootAutoEditSettings: () => null }));

// GET /shoots/127 returns storage paths, while GET /shoots/127/files returns URL
// aliases. The selected Media HERO must also be selectable from the detail shape.
const detailCover = {
  id: 10757,
  shoot_id: 127,
  filename: '8085 Crooked Oaks Ct-13.jpg',
  path: 'shoots/127/completed/COMPLETED_6abcdccc3942d1_55837454_8085 Crooked Oaks Ct-13.jpg',
  web_path: 'shoots/127/webs/8085 Crooked Oaks Ct-13_web.jpg',
  thumbnail_path: 'shoots/127/thumbnails/8085 Crooked Oaks Ct-13_thumbnail.jpg',
  file_type: 'image/jpeg',
  mime_type: null,
  workflow_stage: 'verified',
  scan_status: 'clean',
  is_cover: true,
  is_hidden: false,
};
const signedHero = 'https://reprodashboard.com/api/public/shoot-media/file/shoots/127/webs/8085%20Crooked%20Oaks%20Ct-13_web.jpg?expires=1900000000&signature=test-signature';
const gallery = [
  { shoot_file_id: 10758, sort: 1, alt: 'Kitchen', focal: '60% 40%' },
  { shoot_file_id: 10759, sort: 2, alt: 'Living room', focal: '35% 50%' },
];
const apiDetail = {
  id: 127,
  address: '8085 Crooked Oaks Court',
  status: 'delivered',
  workflow_status: 'delivered',
  is_featured: true,
  hero_image: signedHero,
  files: [detailCover],
};

describe('homepage cover from the shoot detail response', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockImplementation(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => init?.method === 'PATCH'
        ? { data: { ...apiDetail, ...JSON.parse(String(init.body)) } }
        : { data: [] },
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ['an empty gallery', []],
    ['an existing gallery', gallery],
  ] as const)('saves the path-only Media HERO with %s', async (_label, images) => {
    const onUpdate = vi.fn();
    const shoot = transformShootFromApi({ ...apiDetail, featured_homepage_images: images });
    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(<ShootSettingsTab shoot={shoot} isAdmin onUpdate={onUpdate} />);
    });
    const button = screen.getByRole('button', { name: 'Set project cover' });

    expect(button).toBeEnabled();
    // Prefer the presenter's signed URL; constructing one from a storage path
    // drops the signature and produces a broken preview on the protected route.
    expect(screen.getByRole('img', { name: 'Cover' })).toHaveAttribute('src', signedHero);
    await act(async () => { fireEvent.click(button); });

    const expectedImages = [
      { shoot_file_id: 10757, sort: 1, alt: '', focal: '50% 50%' },
      ...images.map((image, index) => ({ ...image, sort: index + 2 })),
    ];
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Homepage project cover updated.'));
    const patchCalls = mocks.fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0][0]).toBe('https://reprodashboard.com/api/shoots/127');
    expect(JSON.parse(patchCalls[0][1].body)).toEqual({ featured_homepage_images: expectedImages });
    expect(onUpdate).toHaveBeenCalledWith({
      featured_homepage_images: expectedImages,
      featuredHomepageImages: expectedImages,
    });
    expect(mocks.error).not.toHaveBeenCalled();

    await act(async () => {
      view.rerender(<ShootSettingsTab
        shoot={transformShootFromApi({ ...apiDetail, featured_homepage_images: expectedImages })}
        isAdmin
        onUpdate={onUpdate}
      />);
    });
    expect(screen.getByRole('button', { name: 'Update project cover' })).toBeEnabled();
  });

  it.each([
    ['hidden', { is_hidden: true }],
    ['unscanned', { scan_status: 'quarantined' }],
    ['raw', { workflow_stage: 'todo' }],
  ])('does not enable an unsafe %s cover just because it has paths and a signed preview', async (_label, changes) => {
    const shoot = transformShootFromApi({ ...apiDetail, files: [{ ...detailCover, ...changes }] });
    await act(async () => { render(<ShootSettingsTab shoot={shoot} isAdmin />); });
    expect(screen.getByRole('button', { name: 'Set project cover' })).toBeDisabled();
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(0);
  });
});

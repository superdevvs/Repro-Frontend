import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ImgHTMLAttributes, PropsWithChildren } from 'react';
import PhotographerAccount from './PhotographerAccount';

const mocks = vi.hoisted(() => ({
  post: vi.fn(), fetch: vi.fn(), toast: vi.fn(), setUser: vi.fn(),
  user: { id: '42', name: 'Photo User', email: 'photo@example.test', role: 'photographer', avatar: '/old.jpg' },
}));
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, post: mocks.post } };
});
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user, setUser: mocks.setUser, logout: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: vi.fn() }));
vi.mock('@/hooks/useResendVerificationEmail', () => ({ useResendVerificationEmail: () => ({ resendVerification: vi.fn() }) }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({ preferences: {}, setTemperatureUnit: vi.fn(), setTimeFormat: vi.fn() }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: PropsWithChildren) => <main>{children}</main> }));
vi.mock('@/components/equipment/EquipmentVerificationDialog', () => ({ EquipmentVerificationDialog: () => null }));
vi.mock('@/components/ui/auto-expanding-tabs', () => ({ AutoExpandingTabsList: () => null }));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: PropsWithChildren) => <div>{children}</div>,
  AvatarImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img alt="Current photo" {...props} />,
  AvatarFallback: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

const mount = () => render(<MemoryRouter initialEntries={['/photographer-account?tab=personal']}><PhotographerAccount /></MemoryRouter>);
const upload = () => fireEvent.change(screen.getByLabelText('Profile photo'), { target: { files: [new File(['image'], 'portrait.png', { type: 'image/png' })] } });

describe('photographer profile photo persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.avatar = '/old.jpg';
    mocks.post.mockResolvedValue({ data: { url: '/new.jpg' } });
    mocks.setUser.mockImplementation((user: typeof mocks.user) => { mocks.user = user; });
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: { ...mocks.user, avatar: '/new.jpg' } }) });
    vi.stubGlobal('fetch', mocks.fetch);
    localStorage.setItem('authToken', 'test-token');
  });
  afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('uploads then persists only the avatar through the authenticated profile API and refreshes user state', async () => {
    const view = mount();
    upload();
    await waitFor(() => expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ avatar: '/new.jpg' })));
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/profile$/), expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ avatar: '/new.jpg' }),
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Profile photo updated' }));
    view.unmount();
    mount();
    expect(screen.getByAltText('Current photo')).toHaveAttribute('src', '/new.jpg');
  });

  it('does not claim success or replace the saved photo if the profile API rejects the uploaded image', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'Profile could not be saved' }) });
    mount();
    upload();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', description: 'Profile could not be saved' })));
    expect(mocks.setUser).not.toHaveBeenCalled();
    expect(screen.getByAltText('Current photo')).toHaveAttribute('src', '/old.jpg');
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('persists photo removal as null and refreshes the account', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: { ...mocks.user, avatar: null } }) });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile photo' }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/profile$/), expect.objectContaining({ body: JSON.stringify({ avatar: null }) })));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Profile photo removed' })));
    expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ avatar: null }));
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

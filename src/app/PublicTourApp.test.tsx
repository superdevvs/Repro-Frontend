import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Link } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PublicTourApp from './PublicTourApp';
import { isPublicTourEntry } from './publicTourEntry';

const dashboard = vi.hoisted(() => ({ loaded: vi.fn() }));
vi.mock('../App', () => {
  dashboard.loaded();
  return { default: () => <BrowserRouter><div>Dashboard app</div></BrowserRouter> };
});
vi.mock('@/components/tourLinks/BrandedPage', () => ({ BrandedPage: ({ legacyPath }: { legacyPath?: boolean }) => <div>{legacyPath ? 'Legacy branded' : 'Branded tour'}<Link to="/dashboard">Open dashboard</Link></div> }));
vi.mock('@/components/tourLinks/MlsCompliant', () => ({ MlsCompliant: ({ legacyPath }: { legacyPath?: boolean }) => <div>{legacyPath ? 'Legacy MLS' : 'MLS tour'}</div> }));
vi.mock('@/components/tourLinks/GenericMLS', () => ({ GenericMLS: () => <div>Generic MLS</div> }));
vi.mock('@/components/tourLinks/PublicVideoPage', () => ({ PublicVideoPage: ({ variant }: { variant: string }) => <div>Video {variant}</div> }));
vi.mock('@/components/tourLinks/Public3dRedirect', () => ({ Public3dRedirect: ({ variant }: { variant: string }) => <div>3D {variant}</div> }));
vi.mock('@/pages/ShootShareRedirect', () => ({ default: () => <div>Share link</div> }));
vi.mock('@/pages/ShootArchiveRedirect', () => ({ default: () => <div>Archive link</div> }));

afterEach(cleanup);

describe('standalone public tour entry', () => {
  it.each(['/dashboard', '/', '/tour-branding', '/payment/123', '/share', '/download/private'])('keeps %s in the full application', path => {
    expect(isPublicTourEntry(path)).toBe(false);
  });

  it.each([
    ['/tour/branded?shootId=1', 'Branded tour'], ['/tours/branded', 'Branded tour'],
    ['/tour/mls', 'MLS tour'], ['/tours/mls', 'MLS tour'], ['/tour/g-mls', 'Generic MLS'], ['/tours/g-mls', 'Generic MLS'],
    ['/tour/MLS/123.html', 'Legacy MLS'], ['/tour/123.html', 'Legacy branded'],
    ['/tour/video/branded', 'Video branded'], ['/tour/video/mls', 'Video mls'], ['/tour/video/generic', 'Video generic'],
    ['/tour/3d/branded', '3D branded'], ['/tour/3d/mls', '3D mls'], ['/share/public-token', 'Share link'], ['/download/media', 'Archive link'],
  ])('renders %s without importing the dashboard', async (path, label) => {
    window.history.replaceState({}, '', path);
    render(<PublicTourApp />);
    expect(await screen.findByText(label)).toBeTruthy();
    expect(dashboard.loaded).not.toHaveBeenCalled();
  });

  it('hands off a client navigation to the full app without nesting routers', async () => {
    window.history.replaceState({}, '', '/tour/branded');
    render(<PublicTourApp />);
    fireEvent.click(await screen.findByRole('link', { name: 'Open dashboard' }));
    expect(await screen.findByText('Dashboard app')).toBeTruthy();
    expect(window.location.pathname).toBe('/dashboard');
  });
});

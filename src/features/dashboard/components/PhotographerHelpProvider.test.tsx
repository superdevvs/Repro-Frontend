import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotographerHelpProvider } from './PhotographerHelpProvider';
import { usePhotographerHelp } from './photographerHelpContext';
import { requestDashboardOnboardingReplay } from '@/lib/dashboardOnboardingEvents';

vi.mock('@/lib/dashboardOnboardingEvents', () => ({ requestDashboardOnboardingReplay: vi.fn() }));
vi.mock('./PhotographerHelpChat', () => ({
  usePhotographerHelpChat: () => ({}),
  PhotographerHelpChat: ({ children }: { children?: React.ReactNode }) => <>{children}<textarea aria-label="Ask Robbie" /></>,
}));
vi.mock('./PhotographerUploadGuide', () => ({ PhotographerUploadGuide: ({ onOpenChange }: { onOpenChange: (open: boolean) => void }) => <div role="dialog" aria-label="Upload video"><button onClick={() => onOpenChange(false)}>Back from upload</button></div> }));
vi.mock('./PhotographerCubiCasaGuide', () => ({ PhotographerCubiCasaGuide: ({ onOpenChange }: { onOpenChange: (open: boolean) => void }) => <div role="dialog" aria-label="CubiCasa video"><button onClick={() => onOpenChange(false)}>Back from CubiCasa</button></div> }));

function Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const help = usePhotographerHelp();
  return <><output aria-label="Location">{location.pathname}{location.search}</output><output aria-label="Tour paused">{String(help?.overlayOpen ?? false)}</output><button onClick={() => navigate('/dashboard?guide=cubicasa&tab=upcoming')}>CubiCasa email link</button></>;
}
function renderHelp(path = '/dashboard', enabled = true, userId: string | number = 1) {
  return render(<MemoryRouter initialEntries={[path]}><PhotographerHelpProvider enabled={enabled} userId={userId} bottomInset={64}><Page /></PhotographerHelpProvider></MemoryRouter>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Photographer help hub integration', () => {
  it('offers help with no shoots or onboarding and positions it above mobile navigation', () => {
    renderHelp();
    const pill = screen.getByRole('button', { name: 'Need help?' });
    expect(pill).toHaveStyle({ bottom: '80px' });
    expect(pill).toHaveAttribute('data-onboarding-target', 'photographer-help-hub');
    fireEvent.click(pill);
    expect(screen.getByRole('dialog', { name: 'How can we help?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Upload shoot media/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /CubiCasa floor plans/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Dashboard tour/ })).toBeVisible();
    expect(screen.getByLabelText('Ask Robbie')).toBeVisible();
    expect(screen.getByLabelText('Tour paused')).toHaveTextContent('true');
  });

  it.each([['uploads','Upload video','Back from upload'],['cubicasa','CubiCasa video','Back from CubiCasa']])('opens %s email links, returns to help and preserves unrelated parameters', async (guide, name, back) => {
    renderHelp(`/dashboard?tab=upcoming&guide=${guide}`);
    expect(await screen.findByRole('dialog', { name })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: back }));
    expect(await screen.findByRole('dialog', { name: 'How can we help?' })).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/dashboard?tab=upcoming');
    fireEvent.click(screen.getByRole('button', { name: 'Close help panel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Need help?' })).toBeVisible();
    expect(screen.getByLabelText('Tour paused')).toHaveTextContent('false');
  });

  it('has only one guide overlay and handles a changed email query after mount', async () => {
    renderHelp('/dashboard?guide=uploads');
    await screen.findByRole('dialog', { name: 'Upload video' });
    fireEvent.click(screen.getByRole('button', { name: 'CubiCasa email link' }));
    expect(await screen.findByRole('dialog', { name: 'CubiCasa video' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Upload video' })).not.toBeInTheDocument();
  });

  it('opens a guide from the library and returns to the library on close', async () => {
    renderHelp();
    fireEvent.click(screen.getByRole('button', { name: 'Need help?' }));
    fireEvent.click(screen.getByRole('button', { name: /Upload shoot media/ }));
    expect(await screen.findByRole('dialog', { name: 'Upload video' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'How can we help?' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back from upload' }));
    expect(await screen.findByRole('dialog', { name: 'How can we help?' })).toBeVisible();
  });

  it('starts the dashboard tour from another photographer page', async () => {
    renderHelp('/shoot-history');
    fireEvent.click(screen.getByRole('button', { name: 'Need help?' }));
    fireEvent.click(screen.getByRole('button', { name: /Dashboard tour/ }));
    expect(requestDashboardOnboardingReplay).toHaveBeenCalledExactlyOnceWith('photographer');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/dashboard');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not mount photographer help for another role, even with a guide query', () => {
    renderHelp('/dashboard?guide=cubicasa', false);
    expect(screen.queryByRole('button', { name: 'Need help?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

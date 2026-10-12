import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeDashboardInstall } from '@/hooks/useDashboardInstall';
import { DashboardInstallButton } from './DashboardInstallButton';
import { DashboardInstallBanner } from './DashboardInstallBanner';

let standalone = false;
let dispose: () => void;
beforeEach(() => {
  standalone = false;
  localStorage.clear();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  dispose = initializeDashboardInstall();
});
afterEach(() => { cleanup(); dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('shows Safari instructions and the enable-alerts step without requesting notifications', async () => {
  const requestPermission = vi.fn();
  vi.stubGlobal('Notification', { requestPermission });
  render(<DashboardInstallButton forCalls />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('Safari');
  expect(screen.getByRole('dialog')).toHaveTextContent('Open as Web App');
  expect(screen.getByRole('dialog')).toHaveTextContent('Enable this device');
  expect(requestPermission).not.toHaveBeenCalled();
});

it('captures the native prompt before mounting and consumes it once from the button', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome');
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  render(<DashboardInstallButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }));
  expect(prompt).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Home Screen' })).toBeEnabled());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('Install app');
  expect(prompt).toHaveBeenCalledOnce();
});

it('falls back to instructions if the browser rejects its native install prompt', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome');
  const event = new Event('beforeinstallprompt');
  Object.assign(event, { prompt: vi.fn().mockRejectedValue(new Error('Unavailable')), userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  window.dispatchEvent(event);
  render(<DashboardInstallButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('Install app');
});

it('hides install UI in the Home Screen app and immediately after browser installation', () => {
  standalone = true;
  const { rerender } = render(<DashboardInstallButton />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  standalone = false;
  rerender(<DashboardInstallButton />);
  expect(screen.getByRole('button', { name: 'Add to Home Screen' })).toBeVisible();
  act(() => { window.dispatchEvent(new Event('appinstalled')); });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('lets users dismiss the dashboard suggestion without removing the settings install button', () => {
  render(<><DashboardInstallBanner /><DashboardInstallButton forCalls /></>);
  expect(screen.getAllByRole('button', { name: 'Add to Home Screen' })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss Home Screen suggestion' }));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add to Home Screen' })).toBeVisible();
  cleanup();
  render(<DashboardInstallBanner />);
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});

it('does not show a mobile install banner on a desktop browser', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Desktop Chrome');
  render(<DashboardInstallBanner />);
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});

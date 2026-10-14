import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CallsLayout from './CallsLayout';

vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('@/services/voice', () => ({ getVoiceNumbers: vi.fn().mockResolvedValue([
  { id: 1, phone_number: '+18888041663', is_default: true, line_policy: { mode: 'sms_only' }, can_call_from: false },
  { id: 2, phone_number: '+12028681663', label: 'Main', line_policy: { mode: 'staff_voicemail' }, can_call_from: true },
]) }));
vi.mock('./workspace/NewCallDialog', () => ({ default: ({ initialFrom, trigger }: { initialFrom: string; trigger: ReactNode }) => <><span data-testid="voice-source">{initialFrom}</span>{trigger}</> }));
vi.mock('./CallsInbox', () => ({ default: () => <p>Inbox page</p> }));
vi.mock('./CallsSettings', () => ({ default: () => <p>Settings page</p> }));

const mount = () => render(<MemoryRouter initialEntries={['/calls/inbox']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/calls/*" element={<CallsLayout />} /></Routes></QueryClientProvider></MemoryRouter>);
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
});
afterAll(() => { vi.unstubAllGlobals(); Reflect.deleteProperty(document, 'fonts'); });
afterEach(cleanup);
describe('Calls workspace navigation', () => {
  it('selects an authorized voice line rather than the SMS-only default', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('voice-source')).toHaveTextContent('+12028681663'));
  });
  it('keeps all secondary settings reachable without overcrowding the main tabs', async () => {
    mount();
    expect(screen.getByRole('navigation', { name: 'Calls navigation' }).querySelectorAll('a')).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Calls settings and tools' }));
    expect(await screen.findByRole('menuitem', { name: 'Audio & alerts' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Business hours' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Support requests' })).toBeVisible();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Business settings' }));
    expect(await screen.findByText('Settings page')).toBeVisible();
  });
});

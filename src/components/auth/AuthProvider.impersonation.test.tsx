import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';
import type { UserData } from '@/types/auth';

vi.mock('@/features/system-overview/telemetryClient', () => ({ trackTelemetryBlocker: vi.fn() }));
const rep: UserData = { id: '7', name: 'Account rep', email: 'rep@example.test', role: 'salesRep' };
const client: UserData = { id: '42', name: 'Assigned client', email: 'client@example.test', role: 'client', can_impersonate: true };
function Probe({ target = client }: { target?: UserData }) {
  const auth = useAuth();
  return <>
    <output data-testid="identity">{auth.isLoading ? 'loading' : `${auth.user?.id}:${auth.role}:${auth.isImpersonating}`}</output>
    <button onClick={() => auth.impersonate(target)}>Open client</button>
    <button onClick={auth.stopImpersonating}>Exit view</button>
  </>;
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('user', JSON.stringify(rep));
  localStorage.setItem('authToken', 'rep-token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('switches to the client and restores the rep without replacing the bearer token', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('7:salesRep:false'));
  fireEvent.click(screen.getByText('Open client'));
  expect(screen.getByTestId('identity')).toHaveTextContent('42:client:true');
  expect(JSON.parse(localStorage.getItem('originalUser')!).id).toBe('7');
  expect(localStorage.getItem('authToken')).toBe('rep-token');
  fireEvent.click(screen.getByText('Exit view'));
  expect(screen.getByTestId('identity')).toHaveTextContent('7:salesRep:false');
  expect(localStorage.getItem('originalUser')).toBeNull();
  expect(localStorage.getItem('authToken')).toBe('rep-token');
});

it('restores a rep impersonation session after refresh and exits to the original rep', async () => {
  localStorage.setItem('originalUser', JSON.stringify(rep));
  localStorage.setItem('user', JSON.stringify(client));
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('42:client:true'));
  fireEvent.click(screen.getByText('Exit view'));
  expect(screen.getByTestId('identity')).toHaveTextContent('7:salesRep:false');
});

it.each([{ ...client, can_impersonate: false }, { ...client, role: 'admin' as const }])('keeps the rep identity for unauthorized targets', async (target) => {
  render(<AuthProvider><Probe target={target} /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('7:salesRep:false'));
  fireEvent.click(screen.getByText('Open client'));
  expect(screen.getByTestId('identity')).toHaveTextContent('7:salesRep:false');
  expect(localStorage.getItem('originalUser')).toBeNull();
});

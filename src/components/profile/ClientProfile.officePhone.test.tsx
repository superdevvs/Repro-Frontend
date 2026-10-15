import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserData } from '@/types/auth';
import { ClientProfile } from './ClientProfile';

const mocks = vi.hoisted(() => ({
  user: {} as UserData, setUser: vi.fn(), logout: vi.fn(), requests: [] as Record<string, unknown>[], failSave: false,
  saveGate: null as Promise<void> | null,
}));
const auth = () => ({ user: mocks.user, setUser: mocks.setUser, logout: mocks.logout });
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth() }));
vi.mock('@/components/auth', () => ({ useAuth: () => auth() }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({
  preferences: { temperatureUnit: 'fahrenheit', timeFormat: '12h' }, setTemperatureUnit: vi.fn(), setTimeFormat: vi.fn(),
}) }));
vi.mock('@/components/profile/ImageUpload', () => ({ ImageUpload: () => null }));
vi.mock('@/hooks/useResendVerificationEmail', () => ({ useResendVerificationEmail: () => ({
  isResendingVerification: false, resendVerification: vi.fn(), resendFeedback: null,
}) }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const initialUser = (): UserData => ({
  id: '1', name: 'Client One', email: 'client-one@example.test', role: 'client',
  office_phone: '202-555-0100', show_office_phone_on_tour: false, metadata: {},
});
const profile = () => <MemoryRouter><ClientProfile /></MemoryRouter>;
const officePhone = () => screen.getByLabelText('Office Phone');
const visibility = () => screen.getByRole('switch', { name: 'Show office phone on branded tour' });
const submit = () => fireEvent.submit(officePhone().closest('form')!);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = initialUser(); mocks.requests = []; mocks.failSave = false; mocks.saveGate = null;
  mocks.setUser.mockImplementation((user: UserData) => { mocks.user = user; });
  localStorage.setItem('authToken', 'test-token');
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    if (String(input).endsWith('/api/profile') && options?.method === 'PUT') {
      const payload = JSON.parse(String(options.body)) as Record<string, unknown>;
      mocks.requests.push(payload);
      if (mocks.saveGate) await mocks.saveGate;
      if (mocks.failSave) return new Response(JSON.stringify({ message: 'Save failed' }), { status: 500 });
      return new Response(JSON.stringify({ message: 'Profile updated successfully', user: {
        ...mocks.user, office_phone: payload.office_phone, show_office_phone_on_tour: payload.show_office_phone_on_tour,
      } }));
    }
    return new Response(JSON.stringify([]));
  }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('ClientProfile office phone draft and save', () => {
  it('keeps an edited toggle across an unrelated background user refresh, then submits that choice', async () => {
    const view = render(profile());
    await screen.findByText('No photographers are currently available.');
    fireEvent.click(visibility());
    expect(visibility()).toBeChecked();
    mocks.user = { ...mocks.user, metadata: { refreshed: true } };
    view.rerender(profile());
    expect(visibility()).toBeChecked();
    submit();
    await waitFor(() => expect(mocks.requests).toHaveLength(1));
    expect(mocks.requests[0].show_office_phone_on_tour).toBe(true);
  });

  it('does not refill an office phone the client deliberately cleared when the session refreshes', async () => {
    const view = render(profile());
    await screen.findByText('No photographers are currently available.');
    fireEvent.change(officePhone(), { target: { value: '' } });
    mocks.user = { ...mocks.user, metadata: { refreshed: true } };
    view.rerender(profile());
    expect(officePhone()).toHaveValue('');
    submit();
    await waitFor(() => expect(mocks.requests).toHaveLength(1));
    expect(mocks.requests[0].office_phone).toBeNull();
  });

  it('hydrates changed server values while the office fields have not been edited', async () => {
    const view = render(profile());
    await screen.findByText('No photographers are currently available.');
    mocks.user = { ...mocks.user, office_phone: '202-555-0122', show_office_phone_on_tour: true };
    view.rerender(profile());
    expect(officePhone()).toHaveValue('202-555-0122');
    expect(visibility()).toBeChecked();
  });

  it('persists explicit false through the real save hook, auth update and a profile remount', async () => {
    mocks.user = { ...mocks.user, show_office_phone_on_tour: true };
    const view = render(profile());
    await screen.findByText('No photographers are currently available.');
    fireEvent.click(visibility());
    fireEvent.change(officePhone(), { target: { value: ' 202-555-0199 ' } });
    submit();
    await waitFor(() => expect(mocks.setUser).toHaveBeenCalled());
    expect(mocks.requests[0]).toMatchObject({ office_phone: '202-555-0199', show_office_phone_on_tour: false });
    view.rerender(profile());
    expect(visibility()).not.toBeChecked();
    expect(officePhone()).toHaveValue('202-555-0199');
    view.unmount();
    render(profile());
    expect(visibility()).not.toBeChecked();
    expect(officePhone()).toHaveValue('202-555-0199');
  });

  it('retains the draft after a failed save and a background refresh so the client can retry', async () => {
    mocks.failSave = true;
    const view = render(profile());
    await screen.findByText('No photographers are currently available.');
    fireEvent.click(visibility());
    submit();
    await waitFor(() => expect(mocks.requests).toHaveLength(1));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Updating...' })).toHaveLength(0));
    mocks.user = { ...mocks.user, metadata: { refreshed: true } };
    view.rerender(profile());
    expect(visibility()).toBeChecked();
    mocks.failSave = false;
    submit();
    await waitFor(() => expect(mocks.setUser).toHaveBeenCalled());
    expect(mocks.requests[1].show_office_phone_on_tour).toBe(true);
  });

  it('replaces the previous account draft when the authenticated identity changes', async () => {
    const view = render(profile());
    await screen.findByText('No photographers are currently available.');
    fireEvent.click(visibility());
    fireEvent.change(officePhone(), { target: { value: 'Unsaved previous account' } });
    mocks.user = { ...initialUser(), id: '2', name: 'Client Two', office_phone: '202-555-0122' };
    view.rerender(profile());
    expect(officePhone()).toHaveValue('202-555-0122');
    expect(visibility()).not.toBeChecked();
    expect(screen.getByLabelText('Full Name')).toHaveValue('Client Two');
  });

  it('offers a nearby save action and protects office fields while its request is pending', async () => {
    let finishSave!: () => void;
    mocks.saveGate = new Promise<void>(resolve => { finishSave = resolve; });
    const view = render(profile());
    await screen.findByText('No photographers are currently available.');
    const buttons = screen.getAllByRole('button', { name: 'Update My Info' });
    expect(buttons).toHaveLength(2);
    fireEvent.change(officePhone(), { target: { value: ' 202-555-0199 ' } });
    fireEvent.click(visibility());
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(mocks.requests).toHaveLength(1));
    expect(officePhone()).toBeDisabled();
    expect(visibility()).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Updating...' })).toHaveLength(2);
    await act(async () => { finishSave(); });
    await waitFor(() => expect(mocks.setUser).toHaveBeenCalled());
    view.rerender(profile());
    expect(officePhone()).not.toBeDisabled();
    expect(officePhone()).toHaveValue('202-555-0199');
    expect(visibility()).toBeChecked();
  });
});

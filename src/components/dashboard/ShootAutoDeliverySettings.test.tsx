import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootAutoDeliverySettings } from './ShootAutoDeliverySettings';
import type { ShootAutoDelivery } from '@/types/shoots';

const mocks = vi.hoisted(() => ({ role: 'admin', userId: '984', fetch: vi.fn(), refresh: vi.fn() }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { id: mocks.userId, role: mocks.role } }) }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => mocks.refresh }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://reprodashboard.com' }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer staff-session' }) }));

const enabled: ShootAutoDelivery = { enabled: true, available: true, can_manage: true };
const shoot = (policy = enabled) => ({ id: '5930', autoDelivery: policy });
const reply = (policy = enabled, id = 5930) => ({ ok: true, json: async () => ({ data: { id, auto_delivery: policy } }) });

describe('Auto delivery setting', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.role = 'admin'; mocks.userId = '984';
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockResolvedValue(reply({ ...enabled, enabled: false }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it.each(['admin', 'superadmin', 'super_admin', 'editing_manager'])('shows the backend default on for %s', role => {
    mocks.role = role;
    render(<ShootAutoDeliverySettings shoot={shoot()} />);
    expect(screen.getByRole('switch', { name: 'Auto delivery' })).toBeChecked();
    expect(screen.getByText(/Photo and video work still needs approval/)).toBeVisible();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(['client', 'editor', 'photographer', 'salesRep'])('hides the control for %s even with stale staff capability', role => {
    mocks.role = role;
    render(<ShootAutoDeliverySettings shoot={shoot()} />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['unsupported provider', { ...enabled, available: false, reason: 'Provider not supported.' }],
    ['management permission denied', { ...enabled, can_manage: false }],
  ])('hides the control when %s', (_label, policy) => {
    render(<ShootAutoDeliverySettings shoot={shoot(policy)} />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('keeps the saved value during a pending request and publishes only the confirmed response', async () => {
    let finish!: (response: ReturnType<typeof reply>) => void;
    mocks.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onUpdate = vi.fn();
    render(<ShootAutoDeliverySettings shoot={shoot()} onUpdate={onUpdate} />);
    const control = screen.getByRole('switch', { name: 'Auto delivery' });
    fireEvent.click(control);
    expect(control).toBeChecked(); expect(control).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    expect(onUpdate).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledWith('https://reprodashboard.com/api/shoots/5930/auto-delivery', expect.objectContaining({ method: 'PATCH', body: '{"enabled":false}', headers: expect.objectContaining({ Authorization: 'Bearer staff-session' }) }));
    await act(async () => { finish(reply({ ...enabled, enabled: false })); });
    expect(control).not.toBeChecked(); expect(control).toBeEnabled();
    expect(onUpdate).toHaveBeenCalledWith({ autoDelivery: { ...enabled, enabled: false }, auto_delivery: { ...enabled, enabled: false } });
    expect(mocks.refresh).toHaveBeenCalledWith('5930');
    expect(screen.getByRole('status')).toHaveTextContent('Auto delivery is off.');
  });

  it('shows an explicitly saved off value and can enable it', async () => {
    mocks.fetch.mockResolvedValue(reply());
    render(<ShootAutoDeliverySettings shoot={shoot({ ...enabled, enabled: false })} />);
    const control = screen.getByRole('switch', { name: 'Auto delivery' });
    expect(control).not.toBeChecked(); fireEvent.click(control);
    await waitFor(() => expect(control).toBeChecked());
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ enabled: true });
  });

  it('preserves the last confirmed value after failure and retries the same explicit choice', async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Provider work changed. Try again.' }) });
    const onUpdate = vi.fn();
    render(<ShootAutoDeliverySettings shoot={shoot()} onUpdate={onUpdate} />);
    const control = screen.getByRole('switch', { name: 'Auto delivery' });
    fireEvent.click(control);
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider work changed');
    expect(control).toBeChecked(); expect(control).toBeEnabled();
    expect(onUpdate).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(control).not.toBeChecked());
    expect(mocks.fetch.mock.calls.map(([, init]) => JSON.parse(init.body))).toEqual([{ enabled: false }, { enabled: false }]);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing capability', { data: { id: 5930 } }],
    ['different shoot', { data: { id: 5912, auto_delivery: { ...enabled, enabled: false } } }],
  ])('does not report success for a 200 response with %s', async (_label, data) => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => data });
    const onUpdate = vi.fn();
    render(<ShootAutoDeliverySettings shoot={shoot()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Auto delivery' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');
    expect(screen.getByRole('switch')).toBeChecked();
    expect(onUpdate).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('ignores an old response after switching shoots', async () => {
    let finish!: (response: ReturnType<typeof reply>) => void;
    mocks.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onUpdate = vi.fn();
    const view = render(<ShootAutoDeliverySettings shoot={shoot()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('switch'));
    view.rerender(<ShootAutoDeliverySettings shoot={{ id: '5912', autoDelivery: enabled }} onUpdate={onUpdate} />);
    await act(async () => { finish(reply({ ...enabled, enabled: false })); });
    expect(screen.getByRole('switch')).toBeChecked(); expect(screen.getByRole('switch')).toBeEnabled();
    expect(onUpdate).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

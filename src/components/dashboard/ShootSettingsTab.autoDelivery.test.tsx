import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { transformShootFromApi } from '@/context/shootNormalization';
import { ShootSettingsTab } from './ShootSettingsTab';

const mocks = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { id: '984', role: mocks.role } }) }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/components/invoices/PaymentDialog', () => ({ PaymentDialog: () => null }));
vi.mock('@/components/dashboard/ShootAutoEditSettings', () => ({ ShootAutoEditSettings: () => null }));

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(['admin', 'editing_manager'])('exposes Auto delivery in the existing Settings for authorized %s on reopened work', async role => {
  mocks.role = role;
  const shoot = transformShootFromApi({ id: 5930, status: 'active', workflow_status: 'editing', auto_delivery: { enabled: true, available: true, can_manage: true } });
  await act(async () => { render(<ShootSettingsTab shoot={shoot} />); });
  expect(screen.getByRole('switch', { name: 'Auto delivery' })).toBeChecked();
});

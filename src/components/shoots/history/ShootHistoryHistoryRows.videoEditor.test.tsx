import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ShootHistoryRecord } from '@/types/shoots';
import { HistoryRow } from './ShootHistoryHistoryRows';

vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({ formatDate: () => 'October 1' }) }));
afterEach(cleanup);

it.each([true, false, undefined])('keeps history video context read-only and other client details private (%s)', permission => {
  const record = { id: 42, status: 'delivered', canViewVideoEditorContext: permission,
    client: { name: 'Jordan Video Client', email: 'private@example.test', phone: '555-0100', company: 'Private company' },
    address: { full: '118 Cedar Grove Lane' }, services: [], notes: { company: 'Brand the end card.' },
  } as unknown as ShootHistoryRecord;
  render(<HistoryRow record={record} isEditor shouldHideClientDetails />);
  fireEvent.click(screen.getByText('118 Cedar Grove Lane'));
  if (permission) {
    expect(screen.getByText('Jordan Video Client')).toBeVisible();
    expect(screen.getByText('Brand the end card.')).toBeVisible();
  } else {
    expect(screen.queryByText('Jordan Video Client')).toBeNull();
    expect(screen.queryByText('Brand the end card.')).toBeNull();
  }
  expect(screen.queryByText('private@example.test')).toBeNull();
  expect(screen.queryByText('555-0100')).toBeNull();
  expect(screen.queryByText('Private company')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
});

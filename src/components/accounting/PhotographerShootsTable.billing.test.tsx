import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ShootData } from '@/types/shoots';
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1', name: 'Photographer' } }) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('@/components/shoots/history/shootHistoryUtils', () => ({ getShootPlaceholderSrc: () => '/placeholder.svg', resolveShootThumbnail: () => null }));
import { PhotographerShootsTable } from './PhotographerShootsTable';
beforeAll(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: false }); });
afterEach(cleanup);
const shoot = (id: number, photographerId = '1'): ShootData => ({ id: String(id), photographer: { id: photographerId, name: photographerId === '1' ? 'Photographer' : 'Other' }, client: { id: '5', name: 'Client' }, location: { address: `Property ${id}`, city: 'City', state: 'VA', zip: '12345' }, services: ['Photography'], status: 'completed', scheduledDate: '2026-09-10', completedDate: `2026-09-${String(id + 1).padStart(2, '0')}`, totalPhotographerPay: 100 } as ShootData);
describe('photographer billing list', () => {
  it('preserves payout cents in both list and grid views', () => {
    render(<PhotographerShootsTable shoots={[{ ...shoot(1), totalPhotographerPay: 123.75 }]} />);
    expect(screen.getByText('$123.75')).toBeInTheDocument();
    expect(screen.queryByText('$124')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(screen.getByText('$123.75')).toBeInTheDocument();
    expect(screen.queryByText('$124')).not.toBeInTheDocument();
  });

  it('keeps own-account scope and paginates all assigned shoots', () => {
    render(<PhotographerShootsTable shoots={[...Array.from({ length: 8 }, (_, i) => shoot(i + 1)), shoot(9, '2')]} onViewShoot={vi.fn()} />);
    expect(screen.getByText('Showing 1–6 of 8')).toBeInTheDocument();
    expect(screen.queryByText('Property 9')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next shoots page' }));
    expect(screen.getByText('Showing 7–8 of 8')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search photographer shoots' }), { target: { value: 'Property 8' } });
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Property 8')).toBeInTheDocument();
  });
});

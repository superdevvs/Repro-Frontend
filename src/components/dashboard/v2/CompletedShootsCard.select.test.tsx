import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DashboardShootSummary } from '@/types/dashboard';

import { CompletedShootsCard } from './CompletedShootsCard';

const shoot = (overrides: Partial<DashboardShootSummary> = {}): DashboardShootSummary =>
  ({
    id: 161,
    addressLine: '3932 Bel Pre Road',
    clientName: 'Example Client',
    status: 'delivered',
    workflowStatus: 'delivered',
    services: [],
    isFlagged: false,
    heroImage: 'https://cdn.test/shoots/bel-pre.jpg',
    previewImages: ['https://cdn.test/shoots/bel-pre.jpg'],
    ...overrides,
  }) as DashboardShootSummary;

describe('CompletedShootsCard selection', () => {
  it('invokes onSelect when a delivered shoot card is clicked', () => {
    const onSelect = vi.fn();
    render(<CompletedShootsCard shoots={[shoot()]} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('3932 Bel Pre Road'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 161 }));
  });

  it('omits the old Latest deliveries subtitle by default to shrink the title band', () => {
    render(<CompletedShootsCard shoots={[shoot()]} />);
    expect(screen.getByText('Delivered shoots')).toBeTruthy();
    expect(screen.queryByText('Latest deliveries')).toBeNull();
  });
});

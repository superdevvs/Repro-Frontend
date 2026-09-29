import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { CompletedShootsCard } from './CompletedShootsCard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const shoot = (id: number): DashboardShootSummary =>
  ({
    id,
    addressLine: `Delivered Address ${id}`,
    clientName: 'Client',
    status: 'delivered',
    workflowStatus: 'delivered',
    services: [],
    isFlagged: false,
    heroImage: `/hero-${id}.jpg`,
    previewImages: [`/hero-${id}.jpg`],
  }) as DashboardShootSummary;

describe('CompletedShootsCard compact viewport', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width: 1024px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it('mounts every delivered shoot so the Completed tab can scroll past ~2 cards', () => {
    const shoots = Array.from({ length: 6 }, (_, i) => shoot(300 + i));
    const { container } = render(<CompletedShootsCard shoots={shoots} stretch />);

    expect(container.querySelectorAll('[data-delivered-shoot-card="true"]')).toHaveLength(6);
    expect(screen.getByText('Delivered Address 305')).toBeVisible();
    expect(screen.queryByText('Latest deliveries')).not.toBeInTheDocument();
  });

  it('hides duplicate title and subtitle below sm so section tabs name the panel', () => {
    render(
      <CompletedShootsCard
        shoots={[shoot(1)]}
        title="Ready to deliver"
        subtitle="Shoots with ready status"
        stretch
      />,
    );

    const title = screen.getByText('Ready to deliver');
    const subtitle = screen.getByText('Shoots with ready status');
    expect(title).toHaveClass('hidden', 'sm:block');
    expect(subtitle).toHaveClass('hidden', 'sm:block');
    expect(screen.getByText('1 ready')).toBeInTheDocument();
  });
});

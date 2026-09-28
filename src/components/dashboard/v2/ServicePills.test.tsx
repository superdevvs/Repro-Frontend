import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ServicePills } from './ServicePills';

describe('ServicePills', () => {
  it('renders the real empty state instead of a fabricated package', () => {
    render(<ServicePills shootId={12} items={[]} variant="desktop" />);

    expect(screen.getByText('No services')).toBeTruthy();
    expect(screen.queryByText(/standard package|general package/i)).toBeNull();
  });

  it.each(['compact', 'desktop'] as const)('collapses a large multi-unit booking in the %s layout', (variant) => {
    const { container } = render(<ServicePills shootId={108} variant={variant} items={[
      ...Array.from({ length: 100 }, () => ({ label: 'HDR Photos', type: 'photos' })),
      { label: 'Drone Photos', type: 'photos' },
    ]} />);

    expect(screen.getAllByText('HDR Photos')).toHaveLength(1);
    expect(screen.getByText('× 100')).toBeTruthy();
    expect(screen.getByText('Drone Photos')).toBeTruthy();
    expect(screen.queryByText('× 1')).toBeNull();
    expect(container.textContent).not.toContain('+99');
  });

  it('keeps package names distinct and updates the count when unit services change', () => {
    const { rerender } = render(<ServicePills shootId={108} variant="desktop" items={[
      { label: 'HDR Photos', type: 'photo' },
      { label: 'HDR Photos', type: 'photo' },
      { label: '5 HDR Photos', type: 'photo' },
    ]} />);
    expect(screen.getByText('× 2')).toBeTruthy();
    expect(screen.getByText('5 HDR Photos')).toBeTruthy();
    rerender(<ServicePills shootId={108} variant="desktop" items={[{ label: 'HDR Photos', type: 'photo' }]} />);
    expect(screen.queryByText(/×/)).toBeNull();
    expect(screen.getByText('HDR Photos')).toBeTruthy();
  });
});

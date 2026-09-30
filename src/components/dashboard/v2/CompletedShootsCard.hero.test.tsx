import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DashboardShootSummary } from '@/types/dashboard';

import { CompletedShootsCard } from './CompletedShootsCard';

describe('CompletedShootsCard hero selection', () => {
  it('prefers an exterior photo over CubiCasa floorplan list heroes', () => {
    const floorplan =
      'https://cdn.test/shoots/166/grids/0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg';
    const exterior =
      'https://cdn.test/shoots/166/grids/5933%20Keysville%20Rd-2847_0116_grid.jpg';

    const shoot = {
      id: 166,
      addressLine: '5933 Keysville Road',
      clientName: 'Example Client',
      status: 'delivered',
      workflowStatus: 'delivered',
      services: [],
      isFlagged: false,
      heroImage: floorplan,
      previewImages: [floorplan, exterior],
    } as DashboardShootSummary;

    render(<CompletedShootsCard shoots={[shoot]} />);
    const img = screen.getByAltText('5933 Keysville Road') as HTMLImageElement;
    expect(img.src).toContain('5933%20Keysville%20Rd-2847_0116_grid.jpg');
    expect(img.src).not.toContain('united-states-0-6d830b71');
  });
});

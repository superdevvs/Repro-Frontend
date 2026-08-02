import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { MetricsStrip } from './MetricsStrip';

const metricsMock = vi.fn();
vi.mock('@/hooks/useStudio', () => ({
  useStudioMetricsSummary: () => metricsMock(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MetricsStrip states', () => {
  it('preserves layout while loading', () => {
    metricsMock.mockReturnValue({ isLoading: true });
    render(<MetricsStrip />);
    expect(screen.getByRole('status', { name: 'Loading Studio metrics' })).toBeInTheDocument();
  });

  it('renders an isolated error without sample values', () => {
    metricsMock.mockReturnValue({ isLoading: false, isError: true, refetch: vi.fn() });
    render(<MetricsStrip />);
    expect(screen.getByRole('alert')).toHaveTextContent('No sample values');
    expect(screen.queryByText('95%')).not.toBeInTheDocument();
  });

  it('renders zero as zero', () => {
    metricsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        projectsProcessed: 0,
        aiJobsCompleted: 0,
        successRate: 0,
        mediaOutputs: 0,
        windowStart: '2026-01-01T00:00:00Z',
        windowEnd: '2026-01-30T00:00:00Z',
      },
    });
    render(<MetricsStrip />);
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});


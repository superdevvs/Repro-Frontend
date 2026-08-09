import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { FinalizeProgress } from '@/services/finalizeShootService';

import { FinalizeProgressToastContent } from './FinalizeProgressToastContent';

const baseProgress: FinalizeProgress = {
  shoot_id: 12,
  run_id: 'run-1',
  status: 'running',
  message: 'Caching delivered files',
  error: null,
  failures: [],
  percentage: 55,
  indeterminate: false,
  stages: [
    {
      key: 'commit',
      label: 'Verifying media and updating delivery status',
      status: 'completed',
      message: null,
      processed: null,
      total: null,
      indeterminate: false,
    },
    {
      key: 'local_cache',
      label: 'Caching delivered files',
      status: 'running',
      message: null,
      processed: 3,
      total: 8,
      indeterminate: false,
    },
    {
      key: 'mls_publish',
      label: 'Publishing to Bright MLS',
      status: 'skipped',
      message: null,
      processed: null,
      total: null,
      indeterminate: false,
    },
  ],
};

describe('FinalizeProgressToastContent', () => {
  it('lists every background process with a measurable bar', () => {
    render(<FinalizeProgressToastContent progress={baseProgress} />);

    expect(screen.getByText('55%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('55');
    expect(screen.getByText('Verifying media and updating delivery status')).toBeTruthy();
    expect(screen.getByText('3/8')).toBeTruthy();
    expect(screen.getByText('Publishing to Bright MLS')).toBeTruthy();
  });

  it('hides the percentage while the running stage is not measurable', () => {
    render(
      <FinalizeProgressToastContent
        progress={{ ...baseProgress, percentage: 0, indeterminate: true }}
      />,
    );

    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  });

  it('falls back to a plain message when no progress document exists', () => {
    render(<FinalizeProgressToastContent progress={null} fallbackMessage="Finalizing…" />);

    expect(screen.getByText('Finalizing…')).toBeTruthy();
    expect(screen.queryByText('%')).toBeNull();
  });
});

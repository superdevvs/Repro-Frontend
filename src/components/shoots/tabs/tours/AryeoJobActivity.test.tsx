import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { AryeoJobActivity, type AryeoJob } from './AryeoJobActivity';

const now = Date.parse('2026-10-03T08:00:00Z');
const stamp = (seconds = 0) => new Date(now - seconds * 1000).toISOString();
const fixture = (): AryeoJob => ({ id: 'job', status: 'running', media_version: 'v', error: null, steps: {}, receipt: null,
  lease_expires_at: stamp(-60), progress: { action: 'adding_files', message: 'Adding photo to Aryeo', completed: 1, total: 49, current_file: 'Reservoir-02.jpg', updated_at: stamp(5), activity_at: stamp(10) } });
afterEach(cleanup);

describe('Mac activity', () => {
  it('shows actual file progress and update age without inventing a percent', () => {
    render(<AryeoJobActivity job={fixture()} online now={now} />);
    expect(screen.getByText('Adding photo to Aryeo · 1 / 49')).toBeVisible();
    expect(screen.getByText('Reservoir-02.jpg')).toBeVisible();
    expect(screen.getByText(/Last worker update 5s ago/)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('distinguishes a connected worker with unchanged activity from real progress', () => {
    const job = fixture(); job.progress!.activity_at = stamp(310);
    render(<AryeoJobActivity job={job} online now={now} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No activity change for 5m 10s');
  });
  it('warns when the job lease expires despite a healthy general heartbeat', () => {
    render(<AryeoJobActivity job={{ ...fixture(), lease_expires_at: stamp(1) }} online now={now} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Worker stopped responding to this job');
  });
  it('shows stopped errors next to activity and preserves confirmed delivery', () => {
    render(<AryeoJobActivity job={{ ...fixture(), status: 'followup_pending', receipt: { verified_at: stamp() }, error: 'filing_destination_conflict' }} online now={now} />);
    expect(screen.getByText('Delivered · follow-up needs attention')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('filing destination conflict');
    expect(screen.queryByText('Reservoir-02.jpg')).not.toBeInTheDocument();
  });
  it('does not confuse old phase strings with a real error', () => {
    render(<AryeoJobActivity job={{ ...fixture(), progress: null, error: 'Progress: uploading' }} online now={now} />);
    expect(screen.getByText('uploading — waiting for detailed Mac activity')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

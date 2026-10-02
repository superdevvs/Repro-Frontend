import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TravelFeasibilityPanel } from './TravelFeasibilityPanel';
import { useTravelFeasibility } from './useTravelFeasibility';
import type { TravelConfirmation } from './types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const warning = { enabled: true, status: 'conflict', available: false, can_override: true,
  policy_version: '1', schedule_version: '1', alternatives: [], transitions: [], reason_codes: ['insufficient_travel_time'] };
function Harness({ save, applied, cancelled, client = false, permitted = true }: {
  save: (value: { duration: number; confirmation: TravelConfirmation }) => void;
  applied: (values: Record<string, number>) => void; cancelled: () => void; client?: boolean; permitted?: boolean;
}) {
  const [duration, setDuration] = useState(30);
  const [renderCount, setRenderCount] = useState(0);
  const travel = useTravelFeasibility({ payload: { address: 'Proposed property', service_items: [{ service_id: 6, duration_minutes: duration }] }, requestedOnly: client });
  return <><button onClick={() => setRenderCount(value => value + 1)}>Render {renderCount}</button>
    <button onClick={async () => {
      // Match callers which prepare their payload before awaiting confirmation.
      const captured = duration;
      const confirmation = await travel.confirmSave();
      if (confirmation) save({ duration: captured, confirmation }); else cancelled();
    }}>Save schedule</button>
    <TravelFeasibilityPanel travel={travel} durationAdjuster={permitted ? {
      items: [{ key: 'unit-a:6', name: 'Exterior · Unit A', currentMinutes: duration, minMinutes: 5, maxMinutes: 300 },
        { key: 'unit-b:6', name: 'Exterior · Unit B', currentMinutes: 30, minMinutes: 5, maxMinutes: 300 }],
      onApply: values => { applied(values); if (values['unit-a:6'] != null) setDuration(values['unit-a:6']); },
    } : undefined} /></>;
}
function fakePreview(canOverride = true) {
  const fetcher = vi.fn().mockImplementation((_url, options) => {
    const duration = JSON.parse(options.body).service_items[0].duration_minutes;
    return Promise.resolve(new Response(JSON.stringify({ data: { ...warning, can_override: canOverride, confirmation_version: `duration-${duration}` } })));
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
async function open() {
  await screen.findByText('Travel needs attention');
  fireEvent.click(screen.getByText('Save schedule'));
  await screen.findByRole('dialog');
  expect(screen.queryByRole('slider', { name: 'Shoot duration for Exterior · Unit A' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Adjust duration' }));
}
const swipe = () => screen.getByRole('slider', { name: 'Swipe to confirm travel exception' });
function reason() { fireEvent.change(screen.getByLabelText('Travel exception reason'), { target: { value: 'Coordinated with photographer' } }); }

describe('warning-only duration adjustment', () => {
  it('cancels the captured save, applies only the exact unit line, and requires a fresh confirmation before one write', async () => {
    const fetcher = fakePreview(); const save = vi.fn(), applied = vi.fn(), cancelled = vi.fn();
    render(<Harness save={save} applied={applied} cancelled={cancelled} />); await open(); reason();
    fireEvent.change(screen.getByRole('slider', { name: 'Shoot duration for Exterior · Unit A' }), { target: { value: '15' } });
    expect(swipe()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hide duration options' })).toBeDisabled();
    expect(screen.getByLabelText('Selected duration for Exterior · Unit B')).toHaveTextContent('30 min');
    fireEvent.click(screen.getByText('Apply duration and recheck'));
    await waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
    expect(applied).toHaveBeenCalledExactlyOnceWith({ 'unit-a:6': 15 });
    expect(save).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await screen.findByText('Travel needs attention');
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save schedule')); await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Adjust duration' }));
    expect(screen.getByLabelText('Selected duration for Exterior · Unit A')).toHaveTextContent('15 min');
    expect(swipe()).toBeDisabled(); reason();
    fireEvent.keyDown(swipe(), { key: 'End' }); fireEvent.keyDown(swipe(), { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ duration: 15, confirmation: {
      travel_override: true, travel_override_confirmed: true, travel_override_reason: 'Coordinated with photographer', travel_override_confirmation_version: 'duration-15',
    } }));
    expect(fetcher.mock.calls.every(([url]) => String(url).endsWith('/availability/feasibility'))).toBe(true);
  });

  it('keeps local edits across equivalent adapter renders, rejects invalid custom input, and discards cancelled drafts', async () => {
    fakePreview(); const save = vi.fn(), applied = vi.fn(), cancelled = vi.fn();
    render(<Harness save={save} applied={applied} cancelled={cancelled} />); await open(); reason();
    fireEvent.click(screen.getByLabelText('Set custom duration for Exterior · Unit A'));
    const custom = screen.getByLabelText('Custom duration for Exterior · Unit A');
    fireEvent.change(custom, { target: { value: '37' } });
    fireEvent.click(screen.getByText('Render 0'));
    expect(screen.getByLabelText('Custom duration for Exterior · Unit A')).toHaveValue(37);
    expect(swipe()).toBeDisabled();
    for (const value of ['', '4', '301', '12.5']) {
      fireEvent.change(screen.getByLabelText('Custom duration for Exterior · Unit A'), { target: { value } });
      expect(screen.getByText('Apply duration and recheck')).toBeDisabled(); expect(swipe()).toBeDisabled();
    }
    fireEvent.change(screen.getByLabelText('Custom duration for Exterior · Unit A'), { target: { value: '37' } });
    expect(screen.getByText('Apply duration and recheck')).toBeEnabled();
    fireEvent.click(screen.getByText('Cancel duration changes'));
    expect(screen.getByLabelText('Selected duration for Exterior · Unit A')).toHaveTextContent('30 min');
    expect(swipe()).toBeEnabled(); expect(applied).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('slider', { name: 'Shoot duration for Exterior · Unit A' }), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Go back without saving'));
    expect(applied).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save schedule')); await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Adjust duration' }));
    expect(screen.getByLabelText('Selected duration for Exterior · Unit A')).toHaveTextContent('30 min');
  });

  it.each(['client', 'unauthorized', 'no-adapter'])('does not expose duration adjustment to %s', async mode => {
    fakePreview(mode !== 'unauthorized');
    render(<Harness save={vi.fn()} applied={vi.fn()} cancelled={vi.fn()} client={mode === 'client'} permitted={mode !== 'no-adapter'} />);
    await screen.findByText('Travel needs attention'); fireEvent.click(screen.getByText('Save schedule'));
    expect(screen.queryByRole('region', { name: 'Adjust proposed service duration' })).not.toBeInTheDocument();
  });
});

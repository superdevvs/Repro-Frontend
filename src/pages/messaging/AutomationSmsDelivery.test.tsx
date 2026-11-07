import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { AutomationRun } from '@/types/messaging';
import { AutomationRunHistory } from './AutomationRunHistory';
import { AutomationSmsDelivery } from './AutomationSmsDelivery';

const auth = vi.hoisted(() => ({ role: 'superadmin' as string | undefined }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); auth.role = 'superadmin'; });
const run: AutomationRun = {
  id: 1, automation_rule_id: 3, status: 'completed', created_at: '2026-10-25T13:00:00Z',
  updated_at: '2026-10-25T13:00:00Z',
  sms_delivery: { status: 'failed', total: 2, delivered: 1, failed: 1, blocked: 0, pending: 0, unknown: 0,
    errors: ['SMS was blocked by a spam filter (Telnyx 40002). Review the message and contact Telnyx before retrying.'] },
};

describe('automation SMS delivery outcomes', () => {
  it('removes visible diagnostics immediately when switching away from superadmin', () => {
    const { container, rerender } = render(<AutomationRunHistory runs={[run]} updatedSinceFailedRun={false} runChronologyKnown />);
    expect(screen.getAllByText(/Telnyx 40002/).length).toBeGreaterThan(0);
    auth.role = 'admin';
    rerender(<AutomationRunHistory runs={[run]} updatedSinceFailedRun={false} runChronologyKnown />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([undefined, 'client', 'photographer', 'sales_rep', 'editing_manager', 'admin'])('hides cached diagnostics for %s', (role) => {
    auth.role = role;
    const { container } = render(<>
      <AutomationRunHistory runs={[{ ...run, status: 'failed', error_message: 'Private run failure' }]} updatedSinceFailedRun={false} runChronologyKnown />
      <AutomationSmsDelivery run={run} />
    </>);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows partial delivery failure separately from completed execution', () => {
    render(<AutomationRunHistory runs={[run]} updatedSinceFailedRun={false} runChronologyKnown />);
    expect(screen.getByText(/Last run completed/)).toBeInTheDocument();
    expect(screen.getAllByText('SMS delivery failed · 1/2 delivered').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Telnyx 40002/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/awaiting next run/)).not.toBeInTheDocument();
  });

  it('does not describe provider acceptance as delivery', () => {
    render(<AutomationSmsDelivery run={{ ...run, sms_delivery: { ...run.sms_delivery!, status: 'pending', delivered: 0, failed: 0, pending: 2, errors: [] } }} />);
    expect(screen.getByText('SMS delivery pending confirmation · 0/2 delivered')).toBeInTheDocument();
    expect(screen.queryByText(/^SMS delivered/)).not.toBeInTheDocument();
  });
});

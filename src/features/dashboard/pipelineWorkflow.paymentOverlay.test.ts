import { describe, expect, it } from 'vitest';
import type { DashboardShootSummary, DashboardWorkflow } from '@/types/dashboard';
import { buildPipelineWorkflow } from './pipelineWorkflow';

const shoot = (overrides: Partial<DashboardShootSummary>): DashboardShootSummary =>
  ({
    id: 1,
    dayLabel: 'Today',
    timeLabel: null,
    scheduledLocalDate: '2026-10-01',
    startTime: '2026-10-01T12:00:00.000Z',
    addressLine: '1 Main',
    cityStateZip: 'City, ST',
    status: 'delivered',
    workflowStatus: 'delivered',
    clientName: 'Client',
    services: [],
    isFlagged: false,
    ...overrides,
  }) as DashboardShootSummary;

describe('buildPipelineWorkflow payment overlay', () => {
  it('overlays paymentStatus from allSummaries onto overview workflow shoots that omit it', () => {
    const workflow: DashboardWorkflow = {
      columns: [
        {
          key: 'ready',
          label: 'Ready / Delivered',
          accent: '#22c55e',
          count: 1,
          shoots: [shoot({ paymentStatus: null })],
        },
      ],
    };

    const next = buildPipelineWorkflow(workflow, [shoot({ paymentStatus: 'paid' })]);
    const ready = next?.columns.find((column) => column.key === 'ready');
    expect(ready?.shoots[0]?.paymentStatus).toBe('paid');
  });

  it('keeps unpaid when the full summary says unpaid', () => {
    const workflow: DashboardWorkflow = {
      columns: [
        {
          key: 'ready',
          label: 'Ready / Delivered',
          accent: '#22c55e',
          count: 1,
          shoots: [shoot({ id: 2, paymentStatus: undefined })],
        },
      ],
    };

    const next = buildPipelineWorkflow(workflow, [shoot({ id: 2, paymentStatus: 'unpaid' })]);
    const ready = next?.columns.find((column) => column.key === 'ready');
    expect(ready?.shoots[0]?.paymentStatus).toBe('unpaid');
  });
});

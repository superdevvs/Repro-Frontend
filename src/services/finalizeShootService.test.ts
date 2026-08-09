import { describe, expect, it } from 'vitest';

import { readFinalizeOutcomeFromShoot } from './finalizeShootService';

describe('readFinalizeOutcomeFromShoot', () => {
  it('reads camelCase, snake_case and wrapped payloads alike', () => {
    expect(readFinalizeOutcomeFromShoot({ workflowStatus: 'DELIVERED' })).toBe('delivered');
    expect(readFinalizeOutcomeFromShoot({ workflow_status: 'client_delivered' })).toBe('delivered');
    expect(readFinalizeOutcomeFromShoot({ data: { status: 'admin_verified' } })).toBe('delivered');
  });

  it('treats a finalize_failed workflow log as a failure', () => {
    expect(
      readFinalizeOutcomeFromShoot({
        workflowStatus: 'ready',
        workflow_logs: [{ action: 'finalize_started' }, { action: 'FINALIZE_FAILED' }],
      }),
    ).toBe('failed');
  });

  it('stays pending while the shoot is still mid-pipeline', () => {
    expect(readFinalizeOutcomeFromShoot({ workflowStatus: 'ready' })).toBe('pending');
    expect(readFinalizeOutcomeFromShoot(null)).toBe('pending');
    expect(readFinalizeOutcomeFromShoot({})).toBe('pending');
  });
});

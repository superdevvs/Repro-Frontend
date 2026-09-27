import { describe, expect, it } from 'vitest';
import type { AutomationRule, AutomationRun } from '@/types/messaging';
import { getAutomationHealth, runTimestamp } from './automationHealth';

const oldTime = '2026-09-15T13:00:04Z';
const editedAt = '2026-09-27T04:59:11Z';
const newTime = '2026-09-27T05:00:00Z';
const validation = { valid: true, errors: [], warnings: [], node_errors: {}, summary: { node_count: 4, edge_count: 3, reachable_action_count: 2 } };
const run: AutomationRun = {
  id: 857, automation_rule_id: 21, status: 'failed', created_at: oldTime,
  started_at: oldTime, completed_at: oldTime, updated_at: oldTime,
  error_message: 'Workflow must contain at least one reachable action node.',
};
const rule = (changes: Partial<AutomationRun> = {}, ruleChanges: Partial<AutomationRule> = {}) => ({
  id: 21, name: 'Shoot Reminder - 2 Hours Before', trigger_type: 'SHOOT_REMINDER',
  is_active: true, scope: 'SYSTEM', created_at: oldTime, updated_at: editedAt,
  validation_state: validation, recent_runs: [{ ...run, ...changes }], ...ruleChanges,
}) as AutomationRule;

describe('automation configuration health and run chronology', () => {
  it('keeps the repaired reminder failure as history without claiming successful delivery', () => {
    expect(getAutomationHealth(rule())).toMatchObject({
      configurationIssue: null, failed: true, updatedSinceFailedRun: true, needsAttention: false,
      run: { id: 857, status: 'failed', error_message: run.error_message },
    });
  });

  it.each(['started_at', 'completed_at', 'updated_at', 'created_at'] as const)(
    'keeps a failure current when %s is after the edit', (field) => {
      expect(getAutomationHealth(rule({ [field]: newTime }))).toMatchObject({ updatedSinceFailedRun: false, needsAttention: true });
    },
  );

  it('keeps a run that resumed and failed after the edit current', () => {
    expect(getAutomationHealth(rule({ started_at: oldTime, completed_at: newTime, updated_at: newTime })))
      .toMatchObject({ updatedSinceFailedRun: false, needsAttention: true });
  });

  it('selects a resumed failure by latest activity rather than array or creation order', () => {
    const newerCreated = { ...run, id: 858, status: 'completed' as const, created_at: '2026-09-20T13:00:00Z', started_at: '2026-09-20T13:00:00Z', completed_at: '2026-09-20T13:00:00Z', updated_at: '2026-09-20T13:00:00Z' };
    const resumed = { ...run, completed_at: newTime, updated_at: newTime };
    const recent_runs = [newerCreated, resumed];
    const health = getAutomationHealth(rule({}, { recent_runs }));
    expect(health).toMatchObject({ run: { id: 857 }, updatedSinceFailedRun: false, needsAttention: true });
    expect(health.runs.map((item) => item.id)).toEqual([857, 858]);
    expect(recent_runs.map((item) => item.id)).toEqual([858, 857]);
  });

  it('retains unknown failure chronology beside a newer dated success', () => {
    const success = { ...run, id: 858, status: 'completed' as const, completed_at: newTime, updated_at: newTime };
    expect(getAutomationHealth(rule({}, { recent_runs: [success, { ...run, completed_at: null }] })))
      .toMatchObject({ run: { id: 857 }, updatedSinceFailedRun: false, needsAttention: true });
  });

  it.each([
    { completed_at: editedAt }, { completed_at: null }, { started_at: null },
    { updated_at: '' }, { created_at: 'not-a-date' }, { completed_at: 'invalid' },
  ])('conservatively retains attention with equal or unknown activity: %j', (changes) => {
    expect(getAutomationHealth(rule(changes))).toMatchObject({ updatedSinceFailedRun: false, needsAttention: true });
  });

  it.each(['', 'not-a-date'])('retains attention with an unknown rule edit date: %s', (updated_at) => {
    expect(getAutomationHealth(rule({}, { updated_at }))).toMatchObject({ updatedSinceFailedRun: false, needsAttention: true });
  });

  it.each(['running', 'waiting', 'pending', 'completed'] as const)('never labels a %s run awaiting its next run', (status) => {
    expect(getAutomationHealth(rule({ status }))).toMatchObject({ failed: false, updatedSinceFailedRun: false, needsAttention: false });
  });

  it('gives current validation priority over historical failures', () => {
    expect(getAutomationHealth(rule({}, { validation_state: { ...validation, valid: false, errors: ['Pick a template'] } })))
      .toMatchObject({ configurationIssue: 'Pick a template', updatedSinceFailedRun: true, needsAttention: true });
  });

  it('uses node errors and a fallback for invalid configurations without messages', () => {
    expect(getAutomationHealth(rule({}, { validation_state: { ...validation, valid: false, errors: [], node_errors: { action: ['Pick a sender'] } } })).configurationIssue).toBe('Pick a sender');
    expect(getAutomationHealth(rule({}, { validation_state: { ...validation, valid: false, errors: [], node_errors: {} } })).configurationIssue).toBe('This workflow needs a configuration fix.');
  });

  it('does not need an error message to retain a current failed-run warning', () => {
    expect(getAutomationHealth(rule({ completed_at: newTime, error_message: null }))).toMatchObject({ failed: true, needsAttention: true });
  });

  it('shows the latest valid run activity and handles missing dates', () => {
    expect(runTimestamp({ ...run, updated_at: newTime })).toBe('2026-09-27T05:00:00.000Z');
    expect(runTimestamp({ ...run, started_at: null, completed_at: null, updated_at: '', created_at: 'invalid' })).toBeNull();
  });
});

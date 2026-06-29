// Tests for per-service photographer assignment grouping (booking Scheduling step).
//
// Product rule: assignment is PER SELECTED SERVICE, never grouped by category,
// and identical for every role (Sales Rep === Super Admin). These tests pin that
// behaviour so the old category-collapsing regression cannot return.

import { describe, expect, it } from 'vitest';
import {
  buildAssignmentGroups,
  requiresPerServiceAssignment,
  type AssignableService,
} from './photographerAssignment';

const svc = (id: string, name: string, category?: string | null): AssignableService => ({
  id,
  name,
  category: category === undefined ? undefined : category === null ? null : { name: category },
});

// The helper takes no role argument; calling it represents BOTH roles identically.
describe('buildAssignmentGroups (role-agnostic, per-service)', () => {
  it('Sales Rep selects two Photos services -> two separate assignment sections', () => {
    const services = [
      svc('s1', '10 Exterior HDR Photos', 'Photos'),
      svc('s2', '25 Flash Photos', 'Photos'),
    ];
    const groups = buildAssignmentGroups(services);

    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.serviceId)).toEqual(['s1', 's2']);
    expect(groups.map(g => g.serviceName)).toEqual(['10 Exterior HDR Photos', '25 Flash Photos']);
    // Same category must NOT collapse them into one assignment.
    expect(new Set(groups.map(g => g.key)).size).toBe(2);
  });

  it('Super Admin selects the same two Photos services -> identical two sections', () => {
    const services = [
      svc('s1', '10 Exterior HDR Photos', 'Photos'),
      svc('s2', '25 Flash Photos', 'Photos'),
    ];
    // Identical call (no role param) => identical result for Super Admin.
    expect(buildAssignmentGroups(services)).toHaveLength(2);
  });

  it('selects Photos + Drone + Floor Plans -> three assignment sections', () => {
    const services = [
      svc('p', '25 HDR Photos', 'Photos'),
      svc('d', '10-12 Drone Photos Package', 'Drone'),
      svc('f', '2D Floor plans', 'Floor Plans'),
    ];
    const groups = buildAssignmentGroups(services);

    expect(groups).toHaveLength(3);
    expect(groups.map(g => g.categoryName)).toEqual(['Photos', 'Drone', 'Floor Plans']);
    expect(groups.map(g => g.serviceId)).toEqual(['p', 'd', 'f']);
  });

  it('single service -> exactly one assignment section', () => {
    const groups = buildAssignmentGroups([svc('only', '45 HDR Photos', 'Photos')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].serviceId).toBe('only');
  });

  it('services missing a category do not collapse into one assignment', () => {
    const services = [
      svc('a', 'Service A', null),
      svc('b', 'Service B', undefined),
      svc('c', 'Service C', 'Photos'),
    ];
    const groups = buildAssignmentGroups(services);

    expect(groups).toHaveLength(3);
    expect(new Set(groups.map(g => g.key)).size).toBe(3);
    // Missing category falls back to a display-only 'Other' label, still independent.
    expect(groups[0].categoryName).toBe('Other');
    expect(groups[1].categoryName).toBe('Other');
    expect(groups[2].categoryName).toBe('Photos');
  });

  it('empty selection -> no assignment sections', () => {
    expect(buildAssignmentGroups([])).toEqual([]);
  });
});

describe('requiresPerServiceAssignment', () => {
  it('is false for zero or one selected service', () => {
    expect(requiresPerServiceAssignment([])).toBe(false);
    expect(requiresPerServiceAssignment([svc('s1', 'Only', 'Photos')])).toBe(false);
  });

  it('is true for more than one service, including same-category selections', () => {
    expect(requiresPerServiceAssignment([
      svc('s1', '10 Exterior HDR Photos', 'Photos'),
      svc('s2', '25 Flash Photos', 'Photos'),
    ])).toBe(true);

    expect(requiresPerServiceAssignment([
      svc('p', 'Photos', 'Photos'),
      svc('d', 'Drone', 'Drone'),
      svc('f', 'Floor', 'Floor Plans'),
    ])).toBe(true);
  });
});

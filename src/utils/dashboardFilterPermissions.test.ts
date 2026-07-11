import { describe, expect, it } from 'vitest';

import { canFilterByPhotographer, normalizeDashboardRole } from './dashboardFilterPermissions';

describe('dashboard filter permissions', () => {
  it.each(['admin', 'superadmin', 'salesRep', 'sales_rep', 'rep', 'editing_manager', 'editingmanager'])(
    'allows assignment filters for %s',
    (role) => expect(canFilterByPhotographer(role)).toBe(true),
  );

  it.each(['photographer', 'client', 'editor', undefined])(
    'hides assignment filters for %s',
    (role) => expect(canFilterByPhotographer(role)).toBe(false),
  );

  it('normalizes known role aliases', () => {
    expect(normalizeDashboardRole('Sales-Rep')).toBe('salesrep');
    expect(normalizeDashboardRole('super_admin')).toBe('superadmin');
  });
});

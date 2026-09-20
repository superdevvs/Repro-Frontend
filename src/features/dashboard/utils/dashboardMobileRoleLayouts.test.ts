import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (...parts: string[]) => readFileSync(resolve(root, ...parts), 'utf8');

describe('role dashboard compact mobile tabs', () => {
  it('gives sales the same compact tab cards as admin (shoots, assign, requests, completed)', () => {
    const sales = read('features/dashboard/views/SalesDashboardView.tsx');

    expect(sales).toContain('mobileTabs=');
    expect(sales).toMatch(/id:\s*['"]shoots['"]/);
    expect(sales).toMatch(/id:\s*['"]assign['"]/);
    expect(sales).toMatch(/id:\s*['"]requests['"]/);
    expect(sales).toMatch(/id:\s*['"]completed['"]/);
  });

  it('uses the 1024px compact shell for client and editing-manager tabs', () => {
    const dashboard = read('pages/Dashboard.tsx');
    const jsxOpen = (tag: string) => {
      const start = dashboard.indexOf(`<${tag}`);
      expect(start).toBeGreaterThan(-1);
      const selfClose = dashboard.indexOf('/>', start);
      return dashboard.slice(start, selfClose);
    };

    expect(jsxOpen('ClientDashboardView')).toContain('isMobile={isCompactDashboardViewport}');
    expect(jsxOpen('EditingManagerDashboardView')).toContain('isMobile={isCompactDashboardViewport}');
  });

  it('marks the client invoices card as a fill-height mobile panel', () => {
    const invoices = read('features/dashboard/components/ClientInvoicesCard.tsx');

    expect(invoices).toContain('DASHBOARD_MOBILE_PANEL_CLASS');
  });

  it('keeps photographer and editor on RoleDashboardLayout mobile tabs', () => {
    const photographer = read('features/dashboard/views/PhotographerDashboardView.tsx');
    const editor = read('features/dashboard/views/EditorDashboardView.tsx');

    expect(photographer).toContain('mobileTabs={photographerMobileTabs');
    expect(editor).toContain('mobileTabs={editorMobileTabs');
  });
});

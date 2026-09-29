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

  it('keeps compact dashboard tabs in a contained horizontally scrollable pill row', () => {
    const panel = read('features/dashboard/utils/dashboardMobilePanel.ts');
    const admin = read('features/dashboard/views/AdminDashboardView.tsx');

    expect(panel).toMatch(/DASHBOARD_MOBILE_TAB_ROW_CLASS =\s*'[^']*overflow-x-auto/);
    expect(panel).toMatch(/DASHBOARD_MOBILE_TAB_LIST_CLASS =\s*'[^']*inline-flex/);
    expect(panel).toMatch(/DASHBOARD_MOBILE_TAB_TRIGGER_CLASS =\s*'[^']*shrink-0/);
    expect(admin).toContain('DashboardMobileTabTrigger');
  });

  it('keeps photographer and editor on RoleDashboardLayout mobile tabs', () => {
    const photographer = read('features/dashboard/views/PhotographerDashboardView.tsx');
    const editor = read('features/dashboard/views/EditorDashboardView.tsx');

    expect(photographer).toContain('mobileTabs={photographerMobileTabs');
    expect(editor).toContain('mobileTabs={editorMobileTabs');
  });

  it('EditingManagerDashboardView uses DashboardMobileTabTrigger with icons-only inactive tabs', () => {
    const em = read('features/dashboard/views/EditingManagerDashboardView.tsx');
    expect(em).toContain('DashboardMobileTabTrigger');
    expect(em).toMatch(/icon:\s*Camera/);
    expect(em).toMatch(/icon:\s*MessageCircle/);
    expect(em).toMatch(/icon:\s*CheckCircle2/);
    expect(em).toMatch(/icon:\s*KanbanSquare/);
    expect(em).toContain('DASHBOARD_MOBILE_SECTION_TABS_CLASS');
  });

  it('editing-manager page shell uses dashboard-mobile-page with admin-aligned min-h-0 flex chain', () => {
    const dashboard = read('pages/Dashboard.tsx');
    const start = dashboard.indexOf('isEditingManager ?');
    expect(start).toBeGreaterThan(-1);
    const shell = dashboard.slice(start, start + 900);
    expect(shell).toContain('dashboard-mobile-page');
    expect(shell).toContain('min-h-0');
    expect(shell).toContain('flex-1');
  });

  it('EM Ready card hides subtitle with title below sm; PendingReviews drops empty title row on mobile', () => {
    const completed = read('components/dashboard/v2/CompletedShootsCard.tsx');
    const pending = read('components/dashboard/v2/PendingReviewsCard.tsx');
    const emShoots = read('components/dashboard/v2/EditingManagerShootsTabsView.tsx');

    expect(completed).toMatch(/subtitle[\s\S]*?hidden text-xs text-muted-foreground sm:block/);
    expect(pending).toMatch(/mb-2 hidden flex-shrink-0 items-center justify-between sm:flex/);
    expect(emShoots).toContain('overflow-x-auto');
    expect(emShoots).toContain('hidden sm:block text-lg font-bold');
    // Shoots sub-tabs: compact chips, no wrap on mobile, horizontal scroll.
    expect(emShoots).toContain('flex-nowrap');
    expect(emShoots).toContain('text-[11px]');
    expect(emShoots).toContain('rounded-full');
    expect(emShoots).toContain('py-0.5');
  });

  it('halves the gap below mobile section tabs via shared layout classes', () => {
    const panel = read('features/dashboard/utils/dashboardMobilePanel.ts');
    const admin = read('features/dashboard/views/AdminDashboardView.tsx');
    const em = read('features/dashboard/views/EditingManagerDashboardView.tsx');
    const role = read('features/dashboard/components/RoleDashboardLayout.tsx');

    expect(panel).toMatch(/DASHBOARD_MOBILE_SECTION_TABS_CLASS =\s*'[^']*space-y-1/);
    expect(panel).toMatch(/DASHBOARD_MOBILE_SECTION_TABS_STICKY_CLASS =\s*'[^']*pb-0\.5/);
    expect(panel).toMatch(/DASHBOARD_MOBILE_SECTION_PANEL_INNER_CLASS =\s*'[^']*pt-0\.5/);
    expect(admin).toContain('DASHBOARD_MOBILE_SECTION_TABS_CLASS');
    expect(em).toContain('DASHBOARD_MOBILE_SECTION_TABS_CLASS');
    expect(role).toContain('DASHBOARD_MOBILE_SECTION_TABS_CLASS');
    // Prior space-y-2 / pb-1 / pt-1 must not linger on Admin / EM / Role layout.
    expect(admin).not.toMatch(/space-y-2 overflow-hidden dashboard-mobile-tabs/);
    expect(em).not.toMatch(/space-y-2 overflow-hidden dashboard-mobile-tabs/);
    expect(role).not.toMatch(/space-y-2 overflow-hidden dashboard-mobile-tabs/);
  });

  it('Admin and Editing Manager section tabs pass count into DashboardMobileTabTrigger', () => {
    const admin = read('features/dashboard/views/AdminDashboardView.tsx');
    const em = read('features/dashboard/views/EditingManagerDashboardView.tsx');
    const trigger = read('features/dashboard/components/DashboardMobileTabTrigger.tsx');
    const completed = read('components/dashboard/v2/CompletedShootsCard.tsx');

    expect(trigger).toContain('count?: number');
    expect(trigger).toMatch(/formatTabCount|99\+/);
    expect(admin).toContain('count={tab.count}');
    expect(admin).toContain('count: completedCount');
    expect(em).toContain('count={tab.count}');
    expect(em).toContain('count: readyCount');
    // In-panel "N ready" must not compete with the tab badge on mobile.
    expect(completed).toMatch(/hidden text-xs text-muted-foreground shrink-0 sm:inline/);
  });
});

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_COMPACT_PAGE_X_CLASS,
  DASHBOARD_MOBILE_LIST_SHELL_CLASS,
  DASHBOARD_MOBILE_PAGE_CLASS,
  DASHBOARD_MOBILE_PANEL_CLASS,
  resolveDashboardListMaxHeight,
} from './dashboardMobilePanel';

const src = (...parts: string[]) =>
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), ...parts), 'utf8');

const indexCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../index.css'),
  'utf8',
);

describe('resolveDashboardListMaxHeight', () => {
  it('does not stretch compact viewports to a multi-card desktop window', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: true,
        itemHeight: 320,
        visibleCount: 7.5,
      }),
    ).toBeUndefined();
  });

  it('keeps the desktop peek window from a measured card', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: false,
        itemHeight: 200,
        visibleCount: 7.5,
      }),
    ).toBe('1624px');
  });

  it('counts gaps between whole rows for photographer lists', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: false,
        itemHeight: 56,
        visibleCount: 8,
        gapPx: 8,
        extraPx: 24,
      }),
    ).toBe('528px');
  });

  it('uses the unmeasured desktop fallback instead of inventing a height', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: false,
        itemHeight: 0,
        visibleCount: 5.5,
        unmeasuredFallback: 'calc(100vh - 14rem)',
      }),
    ).toBe('calc(100vh - 14rem)');
  });

  it('does not apply the unmeasured fallback on compact viewports', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: true,
        itemHeight: 0,
        visibleCount: 5.5,
        unmeasuredFallback: 'calc(100vh - 14rem)',
      }),
    ).toBeUndefined();
  });
});

describe('DASHBOARD_MOBILE_PANEL_CLASS', () => {
  it('marks the page and cards so CSS can fill remaining mobile height', () => {
    expect(DASHBOARD_MOBILE_PAGE_CLASS).toBe('dashboard-mobile-page');
    expect(DASHBOARD_MOBILE_PANEL_CLASS).toBe('dashboard-mobile-panel');
  });
});

describe('dashboard mobile tab CSS', () => {
  it('hides inactive tab panels so they cannot share the filled viewport', () => {
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[hidden\]/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="inactive"\]/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] > div > div/);
    expect(indexCss).not.toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] > div > \*/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] #requests-queue/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] #ready-to-deliver/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] #pipeline-section/);
  });

  it('keeps assign photographer name styles in the stylesheet, not a card sibling', () => {
    const assignCard = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../components/dashboard/v2/AssignPhotographersCard.tsx',
      ),
      'utf8',
    );
    expect(assignCard).not.toMatch(/<style>/);
    expect(indexCss).toMatch(/\.assign-photographer-name\s*\{/);
  });

  it('bounds the inner shoots list so compact viewports can scroll cards', () => {
    expect(DASHBOARD_MOBILE_LIST_SHELL_CLASS).toBe('dashboard-mobile-list-shell');
    expect(indexCss).toMatch(
      /\.dashboard-mobile-list-shell\s*\{[\s\S]*?min-height:\s*0[\s\S]*?overflow:\s*hidden/,
    );

    expect(src('../../../components/dashboard/v2/DefaultShootsTabsView.tsx')).toContain(
      'DASHBOARD_MOBILE_LIST_SHELL_CLASS',
    );
    expect(src('../../../components/dashboard/v2/EditingManagerShootsTabsView.tsx')).toContain(
      'DASHBOARD_MOBILE_LIST_SHELL_CLASS',
    );
    expect(src('../../../features/dashboard/components/ClientMyShoots.tsx')).toMatch(
      /hidden-scrollbar[^"'`]*flex-1[^"'`]*min-h-0[^"'`]*overflow-y-auto/,
    );
  });
});

describe('compact page gutters', () => {
  it('matches Availability: layout keeps 12px sides and pages add none', () => {
    expect(DASHBOARD_COMPACT_PAGE_X_CLASS).toBe('px-0');
    expect(src('../../../components/layout/DashboardLayout.tsx')).toMatch(
      /isStudioWorkspace \? 'p-0' : 'px-3 pt-1\.5'/,
    );
    expect(src('../../../pages/Availability.tsx')).toMatch(
      /isCompactLayout \? "px-0 pt-1\.5 pb-6"/,
    );
  });

  it('does not stack extra compact horizontal padding on dashboard pages', () => {
    const files = [
      '../../../components/shoots/history/ShootHistoryView.tsx',
      '../../../pages/Accounts.tsx',
      '../../../pages/Accounting.tsx',
      '../../../pages/Profile.tsx',
      '../../../pages/SchedulingSettings.tsx',
      '../../../pages/PrivateListingPortal.tsx',
      '../../../pages/ServiceAreaAssignment.tsx',
      '../../../pages/BookShootView.tsx',
      '../../../pages/Reports.tsx',
      '../../../pages/PermissionSettings.tsx',
      '../../../pages/IntegrationsSettings.tsx',
      '../../../pages/TourBranding.tsx',
      '../../../pages/Coupons.tsx',
      '../../../pages/ExclusiveListingDetails.tsx',
      '../../../pages/MlsPublishingQueue.tsx',
      '../../../pages/PhotographerAvailability.tsx',
      '../../../pages/messaging/MessagingSettings.tsx',
      '../../../pages/messaging/Automations.tsx',
      '../../../pages/messaging/MessagingOverview.tsx',
      '../../../pages/messaging/AutomationWorkflowEditor.tsx',
      '../../../pages/messaging/Templates.tsx',
      '../../../pages/messaging/EmailRecovery.tsx',
      '../../../components/layout/DashboardRouteSkeleton.tsx',
    ];

    for (const file of files) {
      const text = src(file);
      expect(text, file).not.toMatch(
        /className=["'`][^"'`]*\bpx-2\b[^"'`]*\b(?:pt-1\.5|pt-3|pb-3|py-4|sm:px-6|sm:p-6)/,
      );
      expect(text, file).not.toMatch(/className="space-y-6 p-6"/);
      expect(text, file).not.toMatch(/className="space-y-6 p-4 sm:p-6"/);
      expect(text, file).not.toMatch(/className="space-y-6 px-1 py-4/);
      expect(text, file).not.toMatch(/className="flex-1 px-3 sm:px-6/);
      expect(text, file).not.toMatch(/className="space-y-4 px-3 pt-3/);
    }
  });
});

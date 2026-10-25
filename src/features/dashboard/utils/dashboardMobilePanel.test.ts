import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_COMPACT_PAGE_X_CLASS,
  DASHBOARD_MOBILE_LIST_SHELL_CLASS,
  DASHBOARD_MOBILE_PAGE_CLASS,
  DASHBOARD_MOBILE_PANEL_CLASS,
  measureShootListPeekHeightPx,
  resolveDashboardListMaxHeight,
  UPCOMING_SHOOT_CARD_MIN_HEIGHT_PX,
  UPCOMING_SHOOT_LIST_PEEK_COUNT,
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
    expect(indexCss).toMatch(
      /#pipeline-section \{[\s\S]*?overflow-y:\s*auto/,
    );
  });

  it('insets the compact page with the measured bottom nav so last cards stay above it', () => {
    const pageRule = indexCss.match(/@media \(max-width: 1024px\) \{[\s\S]*?\.dashboard-mobile-page \{([\s\S]*?)\}/)?.[1] ?? '';
    expect(pageRule).toMatch(/flex:\s*1 1 0%/);
    expect(pageRule).toMatch(/min-width:\s*0/);
    expect(pageRule).toMatch(/overflow-x:\s*hidden/);
    expect(pageRule).toMatch(/padding-bottom:\s*calc\(var\(--mobile-bottom-nav-height[^)]*\)\s*\+\s*0\.75rem\)\s*!important/);
    expect(pageRule).not.toMatch(/height:\s*100%/);
  });

  it('keeps tab panels and lists from growing wider than the viewport', () => {
    expect(indexCss).toMatch(
      /\.dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] > div > div \{[\s\S]*?min-width:\s*0/,
    );
    expect(indexCss).toMatch(
      /\.dashboard-mobile-list-shell\s*\{[\s\S]*?min-width:\s*0/,
    );
    expect(indexCss).toMatch(
      /\.dashboard-mobile-page \.overflow-y-auto[\s\S]*?overflow-x:\s*hidden/,
    );
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
    // Upcoming/EM lists must keep the ~10-card maxHeight cap (inner scroll + sticky pills).
    // Do not drop listMaxHeight when filling PIPELINE/delivered columns.
    expect(src('../../../components/dashboard/v2/DefaultShootsTabsView.tsx')).toContain('listMaxHeight');
    expect(src('../../../components/dashboard/v2/EditingManagerShootsTabsView.tsx')).toContain('listMaxHeight');
    expect(src('../../../components/dashboard/v2/useShootsTabsCardController.tsx')).toMatch(
      /UPCOMING_SHOOT_LIST_PEEK_COUNT|visibleCount:\s*10/,
    );
    expect(src('../../../components/dashboard/v2/useShootsTabsCardController.tsx')).toContain(
      'measureShootListPeekHeightPx',
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
      /isStudioWorkspace \|\| fillSms \? 'p-0' : 'px-3 pt-1\.5'/,
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


describe('measureShootListPeekHeightPx', () => {
  const mountCards = (heights: number[], gap = 12, leading = 28) => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
    // Container at y=0, height large enough to not clip.
    container.getBoundingClientRect = () =>
      ({ top: 0, bottom: 4000, height: 4000, left: 0, right: 400, width: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    let y = leading;
    heights.forEach((height) => {
      const card = document.createElement('div');
      card.setAttribute('data-shoot-card', 'true');
      const top = y;
      const bottom = y + height;
      card.getBoundingClientRect = () =>
        ({ top, bottom, height, left: 0, right: 400, width: 400, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
      container.appendChild(card);
      y = bottom + gap;
    });
    return container;
  };

  it('uses the geometric span of the first N cards including leading day-pill chrome', () => {
    // leading 28 + 10*(140+12) - 12 = 28 + 1520 - 12 = 1536 → bottom of 10th = 28+10*140+9*12 = 28+1400+108 = 1536
    const container = mountCards(Array(14).fill(140));
    const metrics = measureShootListPeekHeightPx(container, 10);
    expect(metrics?.itemHeightPx).toBe(140);
    expect(metrics?.peekHeightPx).toBe(28 + 10 * 140 + 9 * 12);
  });

  it('budgets the tallest card so wrapped tags/weather raise the peek', () => {
    const heights = [120, 120, 180, 120, 120, 120];
    const container = mountCards(heights);
    const metrics = measureShootListPeekHeightPx(container, 10);
    expect(metrics?.itemHeightPx).toBe(180);
    // Fewer than 10 cards → extrapolate from tallest + leading chrome
    expect(metrics?.peekHeightPx).toBe(28 + 180 * 10 + 12 * 9);
  });

  it('returns null when no shoot cards are mounted', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    Object.defineProperty(container, 'scrollTop', { value: 0 });
    expect(measureShootListPeekHeightPx(container, UPCOMING_SHOOT_LIST_PEEK_COUNT)).toBeNull();
  });

  it('exposes the unmeasured full-card floor for fallback math only', () => {
    expect(UPCOMING_SHOOT_CARD_MIN_HEIGHT_PX).toBeGreaterThan(150);
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: false,
        itemHeight: UPCOMING_SHOOT_CARD_MIN_HEIGHT_PX,
        visibleCount: UPCOMING_SHOOT_LIST_PEEK_COUNT,
      }),
    ).toMatch(/px$/);
  });
});

import { type Edge, type NodeTypes } from '@xyflow/react';
import {
  Banknote,
  LayoutDashboard,
  MessageSquareText,
  Route,
  Settings2,
  Shield,
  Sparkles,
  Users,
  Plug,
} from 'lucide-react';

import { systemOverviewCatalog } from '@/features/system-overview/catalog';
import type { LiveUserActivity, SystemRouteCatalogEntry, SystemSnapshot } from '@/types/systemOverview';

import SystemOverviewNode from './SystemOverviewNode';
import type { FlowNode } from './systemOverviewFlowTypes';

export type { FlowNode, FlowNodeData } from './systemOverviewFlowTypes';

export const ICONS = {
  shield: Shield,
  layout: LayoutDashboard,
  route: Route,
  users: Users,
  message: MessageSquareText,
  banknote: Banknote,
  plug: Plug,
  sparkles: Sparkles,
  settings: Settings2,
};

const DOMAIN_H = 196;
const PAGE_W = 248;
const PAGE_H = 184;
const CHILD_W = 216;
const CHILD_H = 180;
const COL_GAP = 28;
const PAGE_GAP = 64;
const V_GAP = 40;
const PAIR_W = CHILD_W * 2 + COL_GAP;
const STACK_STEP = CHILD_H + V_GAP;
const PAGE_DETAIL_GAP = PAGE_H + V_GAP;
const DOMAIN_OFFSET = DOMAIN_H + 56;
const CLUSTER_GAP = 80;

const getStackHeight = (count: number) => (count > 0 ? count * CHILD_H + (count - 1) * V_GAP : 0);

export const nodeTypes = {
  overviewNode: SystemOverviewNode,
} satisfies NodeTypes;

export const clearNodePositions = () => {
  try {
    localStorage.removeItem('system-overview.flow.positions.v5');
    localStorage.removeItem('system-overview.flow.positions.v6');
  } catch {
    // Ignore persistence failures.
  }
};

const aggregateRouteMetrics = (paths: string[], snapshot?: SystemSnapshot, routes?: SystemRouteCatalogEntry[]) => {
  const metrics = snapshot?.routeMetrics ?? [];
  const routeLookup = new Map((routes ?? []).map((route) => [route.path, route.metrics]));

  const matched = paths
    .map((path) => routeLookup.get(path) || metrics.find((metric) => metric.path === path))
    .filter(Boolean);

  return {
    requests: matched.reduce((sum, metric) => sum + (metric?.requestCount ?? 0), 0),
    errors: matched.reduce((sum, metric) => sum + (metric?.errorCount ?? 0), 0),
    avgDurationMs:
      matched.length > 0 ? Math.round(matched.reduce((sum, metric) => sum + (metric?.avgDurationMs ?? 0), 0) / matched.length) : 0,
  };
};

const countLiveUsersForRoute = (route: string, users: LiveUserActivity[]) =>
  users.filter((user) => {
    const currentRoute = user.currentRoute || '';
    if (route.includes('/:')) {
      return currentRoute.startsWith(route.split('/:')[0]);
    }
    return currentRoute === route || currentRoute.startsWith(`${route}/`) || currentRoute.startsWith(`${route}?`);
  }).length;

export const buildFlow = (
  snapshot: SystemSnapshot | undefined,
  routes: SystemRouteCatalogEntry[] | undefined,
  expandedDomains: string[],
  showEverything: boolean,
) => {
  const savedPositions: Record<string, { x: number; y: number }> = {};
  const nodes: FlowNode[] = [];
  const edges: Edge[] = [];
  let cursorX = 40;
  let cursorY = 40;
  let rowHeight = 0;
  const rowLimit = 1720;

  systemOverviewCatalog.forEach((domain) => {
    const domainIsExpanded = expandedDomains.includes(domain.id);
    const extraRoutes = showEverything
      ? (routes ?? []).filter((route) => route.domain === domain.id && !domain.pages.some((page) => page.apis.includes(route.path)))
      : [];
    const pageLayouts = domain.pages.map((page) => {
      const topRowHeight = Math.max(getStackHeight(page.components.length), getStackHeight(page.apis.length));
      const bottomRowHeight = Math.max(getStackHeight(page.services.length), getStackHeight((page.externals ?? []).length));
      const totalHeight =
        PAGE_DETAIL_GAP +
        topRowHeight +
        (bottomRowHeight > 0 ? V_GAP + bottomRowHeight : 0);

      return {
        page,
        topRowHeight,
        bottomRowHeight,
        totalHeight,
      };
    });
    const tallestPageStack = Math.max(0, ...pageLayouts.map((layout) => layout.totalHeight));
    const extraRows = Math.ceil(extraRoutes.length / 2);
    const extraHeight = extraRows > 0 ? V_GAP + getStackHeight(extraRows) : 0;
    const clusterWidth = domainIsExpanded
      ? Math.max(300, pageLayouts.length * PAIR_W + Math.max(0, pageLayouts.length - 1) * PAGE_GAP)
      : 300;
    const clusterHeight = domainIsExpanded ? DOMAIN_OFFSET + tallestPageStack + extraHeight : DOMAIN_H;

    if (cursorX > 40 && cursorX + clusterWidth > rowLimit) {
      cursorY += rowHeight + CLUSTER_GAP;
      cursorX = 40;
      rowHeight = 0;
    }

    const clusterX = cursorX;
    const clusterY = cursorY;
    rowHeight = Math.max(rowHeight, clusterHeight);
    cursorX += clusterWidth + 56;

    const domainId = `domain:${domain.id}`;
    const domainPosition = savedPositions[domainId] ?? { x: clusterX, y: clusterY };
    const domainStats = snapshot?.domainStats?.[domain.id];

    nodes.push({
      id: domainId,
      type: 'overviewNode',
      position: domainPosition,
      data: {
        id: domainId,
        label: domain.label,
        kind: 'domain',
        domain: domain.id,
        description: domain.description,
        activeUsers: domainStats?.activeUsers ?? 0,
        requests: domainStats?.requests ?? 0,
        errors: domainStats?.errors ?? 0,
        avgDurationMs: domainStats?.avgDurationMs ?? 0,
      },
    });

    if (!domainIsExpanded) {
      return;
    }

    const childStartX = domainPosition.x;
    const childStartY = domainPosition.y + DOMAIN_OFFSET;

    pageLayouts.forEach(({ page, topRowHeight }, pageIndex) => {
      const pageGroupX = childStartX + pageIndex * (PAIR_W + PAGE_GAP);
      const pageId = `page:${page.id}`;
      const pagePosition = savedPositions[pageId] ?? {
        x: pageGroupX + Math.round((PAIR_W - PAGE_W) / 2),
        y: childStartY,
      };
      const pageMetrics = aggregateRouteMetrics(page.apis, snapshot, routes);
      const pageActiveUsers = countLiveUsersForRoute(page.route.replace(/:\w+/g, ''), snapshot?.liveUsers ?? []);

      nodes.push({
        id: pageId,
        type: 'overviewNode',
        position: pagePosition,
        data: {
          id: pageId,
          label: page.label,
          kind: 'page',
          domain: domain.id,
          description: page.route,
          routePath: page.route,
          activeUsers: pageActiveUsers,
          requests: pageMetrics.requests,
          errors: pageMetrics.errors,
          avgDurationMs: pageMetrics.avgDurationMs,
        },
      });

      edges.push({
        id: `${domainId}->${pageId}`,
        source: domainId,
        target: pageId,
        animated: pageActiveUsers > 0,
        style: { stroke: '#38bdf8', strokeWidth: 1.6 },
      });

      const firstRowY = pagePosition.y + PAGE_DETAIL_GAP;
      const secondRowY = firstRowY + (topRowHeight > 0 ? topRowHeight + V_GAP : 0);

      page.components.forEach((component, componentIndex) => {
        const componentId = `component:${page.id}:${component}`;
        const componentPosition = savedPositions[componentId] ?? {
          x: pageGroupX,
          y: firstRowY + componentIndex * STACK_STEP,
        };
        const activeUsers = (snapshot?.liveUsers ?? []).filter((user) => user.componentStack?.includes(component)).length;

        nodes.push({
          id: componentId,
          type: 'overviewNode',
          position: componentPosition,
          data: {
            id: componentId,
            label: component,
            kind: 'component',
            domain: domain.id,
            description: 'UI component',
            componentName: component,
            activeUsers,
            requests: pageMetrics.requests,
            errors: pageMetrics.errors,
            avgDurationMs: pageMetrics.avgDurationMs,
          },
        });

        edges.push({
          id: `${pageId}->${componentId}`,
          source: pageId,
          target: componentId,
          style: { stroke: '#94a3b8', strokeWidth: 1.1 },
        });
      });

      page.apis.forEach((apiPath, apiIndex) => {
        const apiId = `api:${page.id}:${apiPath}`;
        const apiPosition = savedPositions[apiId] ?? {
          x: pageGroupX + CHILD_W + COL_GAP,
          y: firstRowY + apiIndex * STACK_STEP,
        };
        const routeMetric = aggregateRouteMetrics([apiPath], snapshot, routes);

        nodes.push({
          id: apiId,
          type: 'overviewNode',
          position: apiPosition,
          data: {
            id: apiId,
            label: apiPath.replace('/api/', ''),
            kind: 'api',
            domain: domain.id,
            description: 'Backend route',
            apiPath,
            requests: routeMetric.requests,
            errors: routeMetric.errors,
            avgDurationMs: routeMetric.avgDurationMs,
          },
        });

        edges.push({
          id: `${pageId}->${apiId}`,
          source: pageId,
          target: apiId,
          animated: routeMetric.requests > 0,
          style: { stroke: '#10b981', strokeWidth: 1.4 },
        });
      });

      page.services.forEach((service, serviceIndex) => {
        const serviceId = `service:${page.id}:${service}`;
        const servicePosition = savedPositions[serviceId] ?? {
          x: pageGroupX,
          y: secondRowY + serviceIndex * STACK_STEP,
        };

        nodes.push({
          id: serviceId,
          type: 'overviewNode',
          position: servicePosition,
          data: {
            id: serviceId,
            label: service,
            kind: 'service',
            domain: domain.id,
            description: 'Controller / service',
            serviceName: service,
            requests: pageMetrics.requests,
            errors: pageMetrics.errors,
            avgDurationMs: pageMetrics.avgDurationMs,
          },
        });

        edges.push({
          id: `${pageId}->${serviceId}`,
          source: pageId,
          target: serviceId,
          style: { stroke: '#f59e0b', strokeWidth: 1.3 },
        });
      });

      (page.externals ?? []).forEach((external, externalIndex) => {
        const externalId = `external:${page.id}:${external}`;
        const externalPosition = savedPositions[externalId] ?? {
          x: pageGroupX + CHILD_W + COL_GAP,
          y: secondRowY + externalIndex * STACK_STEP,
        };

        nodes.push({
          id: externalId,
          type: 'overviewNode',
          position: externalPosition,
          data: {
            id: externalId,
            label: external,
            kind: 'external',
            domain: domain.id,
            description: 'External dependency',
            externalName: external,
            requests: pageMetrics.requests,
            errors: pageMetrics.errors,
            avgDurationMs: pageMetrics.avgDurationMs,
          },
        });

        edges.push({
          id: `${pageId}->${externalId}`,
          source: pageId,
          target: externalId,
          animated: pageMetrics.requests > 0,
          style: { stroke: '#d946ef', strokeWidth: 1.3 },
        });
      });
    });

    extraRoutes.forEach((route, routeIndex) => {
      const apiId = `api-extra:${domain.id}:${route.path}`;
      const extraColumn = routeIndex % 2;
      const extraRow = Math.floor(routeIndex / 2);
      const apiPosition = savedPositions[apiId] ?? {
        x: childStartX + extraColumn * (PAIR_W + PAGE_GAP),
        y: childStartY + tallestPageStack + V_GAP + extraRow * STACK_STEP,
      };
      const metric = route.metrics;

      nodes.push({
        id: apiId,
        type: 'overviewNode',
        position: apiPosition,
        data: {
          id: apiId,
          label: route.path.replace('/api/', ''),
          kind: 'api',
          domain: domain.id,
          description: route.controllerAction || 'Mapped backend route',
          apiPath: route.path,
          requests: metric?.requestCount ?? 0,
          errors: metric?.errorCount ?? 0,
          avgDurationMs: metric?.avgDurationMs ?? 0,
        },
      });

      edges.push({
        id: `${domainId}->${apiId}`,
        source: domainId,
        target: apiId,
        animated: (metric?.requestCount ?? 0) > 0,
        style: { stroke: '#22c55e', strokeDasharray: '6 4' },
      });
    });
  });

  return { nodes, edges };
};

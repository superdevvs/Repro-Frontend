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

const STORAGE_KEY = 'system-overview.flow.positions.v5';
const PAGE_NODE_WIDTH = 268;
const CHILD_NODE_WIDTH = 220;
const PAGE_GROUP_WIDTH = CHILD_NODE_WIDTH * 2 + 28;
const PAGE_COLUMN_GAP = 56;
const PAGE_DETAIL_GAP = 164;
const PAGE_SECTION_GAP = 38;
const STACK_STEP = 138;
const DOMAIN_ROW_GAP = 140;
const DOMAIN_COLUMN_GAP = 140;
const DOMAIN_COLUMNS = 2;

const getStackHeight = (count: number) => (count > 0 ? count * STACK_STEP : 0);

export const nodeTypes = {
  overviewNode: SystemOverviewNode,
} satisfies NodeTypes;

const loadSavedPositions = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, { x: number; y: number }>;
  } catch {
    return {};
  }
};

export const saveNodePositions = (nodes: FlowNode[]) => {
  try {
    const positions = nodes.reduce<Record<string, { x: number; y: number }>>((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore persistence failures.
  }
};

export const clearNodePositions = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
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
  const savedPositions = loadSavedPositions();
  const nodes: FlowNode[] = [];
  const edges: Edge[] = [];
  let currentX = 120;
  let currentY = 80;
  let currentColumn = 0;
  let currentRowHeight = 0;

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
        (bottomRowHeight > 0 ? PAGE_SECTION_GAP + bottomRowHeight : 0);

      return {
        page,
        topRowHeight,
        bottomRowHeight,
        totalHeight,
      };
    });
    const tallestPageStack = Math.max(0, ...pageLayouts.map((layout) => layout.totalHeight));
    const clusterWidth = domainIsExpanded
      ? Math.max(360, domain.pages.length * PAGE_GROUP_WIDTH + Math.max(0, domain.pages.length - 1) * PAGE_COLUMN_GAP)
      : 320;
    const clusterHeight = domainIsExpanded
      ? 260 + tallestPageStack + (extraRoutes.length > 0 ? 140 + Math.ceil(extraRoutes.length / 2) * 148 : 0)
      : 180;

    const clusterX = currentX;
    const clusterY = currentY;

    currentColumn += 1;
    currentRowHeight = Math.max(currentRowHeight, clusterHeight);

    if (currentColumn >= DOMAIN_COLUMNS) {
      currentY += currentRowHeight + DOMAIN_ROW_GAP;
      currentX = 120;
      currentColumn = 0;
      currentRowHeight = 0;
    } else {
      currentX += clusterWidth + DOMAIN_COLUMN_GAP;
    }

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
    const childStartY = domainPosition.y + 220;

    pageLayouts.forEach(({ page, topRowHeight }, pageIndex) => {
      const pageGroupX = childStartX + pageIndex * (PAGE_GROUP_WIDTH + PAGE_COLUMN_GAP);
      const pageId = `page:${page.id}`;
      const pagePosition = savedPositions[pageId] ?? {
        x: pageGroupX + Math.round((PAGE_GROUP_WIDTH - PAGE_NODE_WIDTH) / 2),
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
      const secondRowY = firstRowY + (topRowHeight > 0 ? topRowHeight + PAGE_SECTION_GAP : 0);

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
          x: pageGroupX + CHILD_NODE_WIDTH + 28,
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
          x: pageGroupX + CHILD_NODE_WIDTH + 28,
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
        x: childStartX + extraColumn * (PAGE_GROUP_WIDTH + PAGE_COLUMN_GAP),
        y: childStartY + tallestPageStack + 100 + extraRow * 148,
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

import { EmptyState } from '@/components/ui/empty-state';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useEffect, useMemo, useState } from 'react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock3,
  Maximize2,
  Minimize2,
  Network,
  Plug,
  Users,
  Workflow,
  ZoomIn,
} from 'lucide-react';
import { toast } from '@/lib/sonner-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { findCatalogPageByRoute, systemOverviewCatalog } from '@/features/system-overview/catalog';
import { getEchoClient } from '@/realtime/echoClient';
import {
  fetchSystemOverviewHistory,
  fetchSystemOverviewRoutes,
  fetchSystemOverviewSnapshot,
  fetchSystemOverviewTrace,
} from '@/services/systemOverviewService';
import { useTheme } from '@/hooks/useTheme';

import styles from './SystemOverviewTab.module.css';

import {
  buildFlow,
  clearNodePositions,
  ICONS,
  nodeTypes,
  saveNodePositions,
  type FlowNode,
} from './systemOverviewFlow';

const liveActionLabels: Record<string, string> = {
  component_mount: 'Page loaded',
  component_unmount: 'Leaving page',
  view: 'Viewing page',
  heartbeat: 'Active',
  route_enter: 'Viewing page',
};

const liveActionLabel = (action?: string | null) => liveActionLabels[action ?? ''] ?? action ?? 'Browsing';

export function SystemOverviewTab() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [expandedDomains, setExpandedDomains] = useState<string[]>([]);
  const [showEverything, setShowEverything] = useState(false);
  const [liveUsersCollapsed, setLiveUsersCollapsed] = useState(false);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [timeMode, setTimeMode] = useState<'live' | 'history'>('live');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const snapshotQuery = useQuery({
    queryKey: ['system-overview', 'snapshot'],
    queryFn: fetchSystemOverviewSnapshot,
    refetchInterval: 20000,
  });
  const historyQuery = useQuery({
    queryKey: ['system-overview', 'history'],
    queryFn: fetchSystemOverviewHistory,
    refetchInterval: 30000,
  });
  const routesQuery = useQuery({
    queryKey: ['system-overview', 'routes'],
    queryFn: fetchSystemOverviewRoutes,
    refetchInterval: 45000,
  });
  const traceQuery = useQuery({
    queryKey: ['system-overview', 'trace', selectedTraceId],
    queryFn: () => fetchSystemOverviewTrace(selectedTraceId as string),
    enabled: Boolean(selectedTraceId) && Boolean(snapshotQuery.data?.telemetryAvailable),
  });

  const snapshot = snapshotQuery.data?.data;
  const history = historyQuery.data?.data;
  const routes = routesQuery.data?.data;
  const telemetryAvailable =
    snapshotQuery.data?.telemetryAvailable !== false &&
    historyQuery.data?.telemetryAvailable !== false &&
    routesQuery.data?.telemetryAvailable !== false;

  const flow = useMemo(
    () => buildFlow(snapshot, routes, expandedDomains, showEverything),
    [expandedDomains, routes, showEverything, snapshot],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  const relatedTraces = useMemo(() => {
    if (!selectedNode?.data || !snapshot) return [];
    const nodeData = selectedNode.data;

    return snapshot.recentTraces.filter((trace) => {
      if (nodeData.kind === 'domain') return trace.domain === nodeData.domain;
      if (nodeData.kind === 'page') {
        const normalized = (nodeData.routePath || '').replace(/:\w+/g, '');
        return trace.currentRoute?.startsWith(normalized) || false;
      }
      if (nodeData.kind === 'api') return trace.path === nodeData.apiPath;
      if (nodeData.kind === 'component') return Boolean(trace.currentRoute && findCatalogPageByRoute(trace.currentRoute)?.components.includes(nodeData.componentName || ''));
      return trace.domain === nodeData.domain;
    });
  }, [selectedNode, snapshot]);

  const relatedErrors = useMemo(() => {
    if (!selectedNode?.data || !snapshot) return [];
    const nodeData = selectedNode.data;

    return snapshot.recentErrors.filter((error) => {
      if (nodeData.kind === 'domain') return nodeData.domain === 'System' || (error.routePath || '').toLowerCase().includes(nodeData.domain.toLowerCase());
      if (nodeData.kind === 'page') return (error.routePath || '').startsWith((nodeData.routePath || '').replace(/:\w+/g, ''));
      if (nodeData.kind === 'component') return error.componentName === nodeData.componentName;
      if (nodeData.kind === 'api') return error.routePath === nodeData.apiPath;
      return true;
    });
  }, [selectedNode, snapshot]);

  const topRoutes = snapshot?.routeMetrics.slice(0, 5) ?? [];
  const liveUsers = snapshot?.liveUsers ?? [];
  const domainSummaries = systemOverviewCatalog.map((domain) => ({
    ...domain,
    stats: snapshot?.domainStats?.[domain.id],
    isExpanded: expandedDomains.includes(domain.id),
  }));

  const isLoading = snapshotQuery.isLoading || historyQuery.isLoading || routesQuery.isLoading;
  usePageLoading(isLoading);
  const hasError = snapshotQuery.isError || historyQuery.isError || routesQuery.isError;

  useEffect(() => {
    setNodes((currentNodes) => {
      const positionLookup = new Map(currentNodes.map((node) => [node.id, node.position]));
      return flow.nodes.map((node) => {
        const preservedPosition = positionLookup.get(node.id);
        return preservedPosition ? { ...node, position: preservedPosition } : node;
      });
    });
    setEdges(flow.edges);
  }, [flow.edges, flow.nodes, setEdges, setNodes]);

  useEffect(() => {
    if (expandedDomains.length > 0 || !snapshot?.domainStats) {
      return;
    }

    const suggestedDomains = systemOverviewCatalog
      .filter((domain) => {
        const stats = snapshot.domainStats?.[domain.id];
        return (stats?.requests ?? 0) > 0 || (stats?.activeUsers ?? 0) > 0;
      })
      .slice(0, 3)
      .map((domain) => domain.id);

    setExpandedDomains(suggestedDomains.length > 0 ? suggestedDomains : systemOverviewCatalog.slice(0, 3).map((domain) => domain.id));
  }, [expandedDomains.length, snapshot]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    if (!flow.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
      setSelectedTraceId(null);
    }
  }, [flow.nodes, selectedNodeId]);

  useEffect(() => {
    let cancelled = false;
    let activeChannel: {
      listen: (event: string, callback: (payload: { kind: string; payload: Record<string, unknown> }) => void) => void;
      stopListening?: (event: string) => void;
      unsubscribe?: () => void;
    } | null = null;

    getEchoClient().then((echo) => {
      if (cancelled || !echo) return;

      const channel = echo.private('system-overview.superadmin');
      activeChannel = channel;
      channel.listen('.SystemOverviewActivity', (event: { kind: string; payload: Record<string, unknown> }) => {
        queryClient.invalidateQueries({ queryKey: ['system-overview'] });
        if (event.kind === 'activity') {
          const name = String(event.payload.userName || 'Someone');
          const route = String(event.payload.routePath || '');
          const action = String(event.payload.actionName || event.payload.type || 'updated');
          toast(`${name} ${action}${route ? ` on ${route}` : ''}`);
        }
      });
    });

    return () => {
      cancelled = true;
      activeChannel?.stopListening?.('.SystemOverviewActivity');
      activeChannel?.unsubscribe?.();
    };
  }, [queryClient]);

  const renderSystemMap = (expandedView = false) => (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', expandedView && 'h-full')}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">System map</div>
          <div className="text-xs text-muted-foreground">
            Drag nodes or the canvas, then use the inspector for details instead of scanning everything at once.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">{nodes.length} nodes</Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => setIsCanvasExpanded((current) => !current)}
          >
            {expandedView ? <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> : <Maximize2 className="mr-1.5 h-3.5 w-3.5" />}
            {expandedView ? 'Exit full view' : 'Full view'}
          </Button>
        </div>
      </div>
      <div className={cn(styles.canvas, 'w-full', expandedView ? 'min-h-0 flex-1' : 'h-[70vh] min-h-[28rem] max-h-[700px]')}>
        <ReactFlow
          className="system-overview-flow"
          colorMode={theme}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: expandedView ? 0.08 : 0.14, maxZoom: expandedView ? 1.2 : 0.98 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onNodeDragStop={(_, __, nextNodes) => saveNodePositions(nextNodes)}
          defaultEdgeOptions={{ animated: false }}
        >
          <Background gap={24} />
          <Controls position="top-left" showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Loading live topology, traces, and system metrics for superadmin view.</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-muted" />
            <div className="h-[520px] animate-pulse rounded-2xl bg-muted" />
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <InlineSpinner className="h-12 w-12" label="Loading system overview" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-950 dark:text-amber-50">
            <AlertTriangle className="h-5 w-5" />
            System overview is unavailable
          </CardTitle>
          <CardDescription className="text-amber-800 dark:text-amber-200">
            The overview endpoints did not respond correctly. Refresh the page or check the telemetry API and broadcast worker.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!telemetryAvailable) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>System Overview</CardTitle>
              <CardDescription>
                Telemetry is not initialized yet, so the observability workspace is in setup mode.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5">
            <div className="text-sm font-medium text-foreground">Telemetry not initialized</div>
            <div className="mt-2 text-sm text-muted-foreground">
              The app is healthy, but the system overview tables have not been migrated in this environment yet. The dashboard and normal pages continue to work while this feature stays paused.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="text-sm font-medium text-foreground">What to run</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Apply only the four `2026_03_28_000001` through `2026_03_28_000004` system overview migrations in the backend.
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="text-sm font-medium text-foreground">Current behavior</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Telemetry requests are now suppressed temporarily, and the rest of the app remains fully usable.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errorEvents = snapshot?.stats.errorCount24h ?? 0;
  const warningCount = snapshot?.stats.warningCount24h;
  const issueTypes = snapshot?.stats.uniqueIssueCount24h;
  const issueDetail = warningCount !== undefined
    ? `${(errorEvents - warningCount).toLocaleString()} error events · ${warningCount.toLocaleString()} warnings`
    : `${errorEvents.toLocaleString()} events`;
  const stats = [
    { label: 'Active Sessions', value: snapshot?.stats.activeSessions ?? 0, icon: Users, attention: false, detail: '' },
    { label: 'Requests / min', value: snapshot?.stats.requestsPerMinute ?? 0, icon: Activity, attention: false, detail: '' },
    {
      label: 'Issue types 24h',
      value: issueTypes ?? '—',
      icon: AlertTriangle,
      attention: (issueTypes ?? 0) > 0,
      detail: issueDetail,
    },
    { label: 'Slow Routes', value: snapshot?.stats.slowRouteCount ?? 0, icon: Clock3, attention: (snapshot?.stats.slowRouteCount ?? 0) > 0, detail: '' },
    { label: 'Integration Failures', value: snapshot?.stats.integrationFailures24h ?? 0, icon: Plug, attention: (snapshot?.stats.integrationFailures24h ?? 0) > 0, detail: '' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">System Overview</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            A focused observability workspace for route health, live user presence, blockers, and recent traces without the previous control overload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={timeMode} onValueChange={(value) => setTimeMode(value as 'live' | 'history')}>
            <TabsList>
              <TabsTrigger value="live">Live</TabsTrigger>
              <TabsTrigger value="history">Last 24h</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
            {snapshot?.stats.activeSessions ?? 0} live sessions
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setIsCanvasExpanded(true)}>
            <ZoomIn className="mr-1.5 h-3.5 w-3.5" />
            Canvas workspace
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-muted-foreground">{stat.label}</div>
              <stat.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div
              className={cn(
                'mt-2 text-2xl font-semibold tabular-nums tracking-tight',
                stat.attention ? 'text-amber-700 dark:text-amber-300' : 'text-foreground',
              )}
            >
              {stat.value}
            </div>
            {stat.detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.detail}<br />Includes repeated events</p>}
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[120px]">
                  <div className="text-sm font-semibold text-foreground">Map scope</div>
                  <div className="text-xs text-muted-foreground">Pick which domains expand on the canvas.</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-4 text-sm"
                  onClick={() =>
                    setExpandedDomains((current) =>
                      current.length === systemOverviewCatalog.length ? [] : systemOverviewCatalog.map((domain) => domain.id),
                    )
                  }
                >
                  <Workflow className="mr-2 h-3.5 w-3.5" />
                  {expandedDomains.length === systemOverviewCatalog.length ? 'Collapse all' : 'Expand all'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-4 text-sm"
                  onClick={() => {
                    clearNodePositions();
                    const nextFlow = buildFlow(snapshot, routes, expandedDomains, showEverything);
                    setNodes(nextFlow.nodes);
                    setEdges(nextFlow.edges);
                    setSelectedNodeId(null);
                    setSelectedTraceId(null);
                  }}
                >
                  Reset layout
                </Button>
                <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  <span id="overview-deep-links">Deep links</span>
                  <Switch checked={showEverything} onCheckedChange={setShowEverything} aria-labelledby="overview-deep-links" />
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {domainSummaries.map((domain) => {
                  const Icon = ICONS[domain.icon as keyof typeof ICONS] || Network;
                  const active = domain.isExpanded;
                  const errors = domain.stats?.errors ?? 0;
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      aria-pressed={active}
                      title={domain.description}
                      onClick={() =>
                        setExpandedDomains((current) =>
                          current.includes(domain.id)
                            ? current.filter((value) => value !== domain.id)
                            : [...current, domain.id],
                        )
                      }
                      className={cn(
                        'w-[16rem] shrink-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border bg-background text-foreground hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-medium">{domain.label}</div>
                            <Badge variant="outline" className="h-6 shrink-0 px-2 text-[11px]">
                              {domain.stats?.requests ?? 0} req
                            </Badge>
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{domain.description}</div>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{domain.stats?.activeUsers ?? 0} live users</span>
                            <span className={cn(errors > 0 && 'font-medium text-amber-700 dark:text-amber-300')}>{errors} errors</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            {renderSystemMap()}

            <div className="grid min-h-0 content-start gap-4">
              <Card className="min-h-0">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Live users</CardTitle>
                      {!liveUsersCollapsed && (
                        <CardDescription>See who is active now and which route or blocker needs attention.</CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-expanded={!liveUsersCollapsed}
                      aria-label={liveUsersCollapsed ? 'Expand live users' : 'Collapse live users'}
                      onClick={() => setLiveUsersCollapsed((current) => !current)}
                    >
                      {liveUsersCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                {!liveUsersCollapsed && (
                <CardContent className="space-y-3 pb-4">
                  <ScrollArea className="h-[360px] xl:h-[420px] pr-3">
                    <div className="space-y-3 pb-4">
                      {liveUsers.map((user) => (
                        <div key={user.sessionKey} className="rounded-xl border border-border bg-muted/30 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">{user.userName || 'Unknown user'}</div>
                              <div className="text-xs text-muted-foreground">{user.userRole || 'unknown role'}</div>
                            </div>
                            <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <div className="break-all">{user.currentRoute || 'No route captured yet'}</div>
                            <div>{liveActionLabel(user.currentAction)}</div>
                            {user.blockerMessage && <div className="text-amber-800 dark:text-amber-200">{user.blockerMessage}</div>}
                          </div>
                        </div>
                      ))}
                      {liveUsers.length === 0 && <EmptyState icon="activity" title={<>No live users detected in the last two minutes.</>} size="compact" />}
                    </div>
                  </ScrollArea>
                </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Inspector</CardTitle>
                  <CardDescription>Route chains, trace detail, blockers, and recent activity for the currently selected node.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedNode?.data ? (
                    <>
                      <div className="rounded-xl border border-border bg-muted/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{selectedNode.data.kind}</div>
                            <div className="mt-1 break-words text-lg font-semibold text-foreground">{selectedNode.data.label}</div>
                            <div className="mt-1 break-words text-sm text-muted-foreground">{selectedNode.data.description}</div>
                          </div>
                          <Badge className="shrink-0">{selectedNode.data.domain}</Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                          <div className="rounded-xl bg-background p-3">
                            <div className="text-xs text-muted-foreground">Users</div>
                            <div className="font-semibold tabular-nums">{selectedNode.data.activeUsers ?? 0}</div>
                          </div>
                          <div className="rounded-xl bg-background p-3">
                            <div className="text-xs text-muted-foreground">Requests</div>
                            <div className="font-semibold tabular-nums">{selectedNode.data.requests ?? 0}</div>
                          </div>
                          <div className="rounded-xl bg-background p-3">
                            <div className="text-xs text-muted-foreground">Errors</div>
                            <div className={cn('font-semibold tabular-nums', (selectedNode.data.errors ?? 0) > 0 && 'text-amber-700 dark:text-amber-300')}>{selectedNode.data.errors ?? 0}</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">Recent traces</div>
                        <div className="space-y-2">
                          {relatedTraces.slice(0, 5).map((trace) => (
                            <button
                              key={trace.traceId}
                              type="button"
                              onClick={() => setSelectedTraceId(trace.traceId)}
                              className={cn(
                                'w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                selectedTraceId === trace.traceId
                                  ? 'border-primary/50 bg-primary/10'
                                  : 'border-border hover:border-primary/40 hover:bg-primary/5',
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 break-all text-sm font-medium text-foreground">{trace.method} {trace.path}</div>
                                <Badge variant="outline" className="shrink-0">{trace.statusCode ?? 'n/a'}</Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{trace.durationMs}ms • {trace.occurredAt || 'recent'}</div>
                            </button>
                          ))}
                          {relatedTraces.length === 0 && <EmptyState icon="activity" title={<>No matching traces yet.</>} size="compact" />}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">Blockers & errors</div>
                        <div className="space-y-2">
                          {relatedErrors.slice(0, 4).map((error, index) => (
                            <div key={`${error.traceId || index}-${error.message}`} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                              <div className="flex items-start gap-2 text-sm font-medium text-amber-950 dark:text-amber-50">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span className="min-w-0 break-words">{error.message}</span>
                              </div>
                              <div className="mt-1 break-all text-xs text-amber-800 dark:text-amber-200">{error.routePath || error.componentName || error.errorClass}</div>
                            </div>
                          ))}
                          {relatedErrors.length === 0 && <EmptyState icon="clear" title={<>No blockers currently linked to this node.</>} size="compact" />}
                        </div>
                      </div>

                      {traceQuery.data && selectedTraceId && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">Trace detail</div>
                            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                              <div className="break-all font-medium text-foreground">{traceQuery.data.trace.method} {traceQuery.data.trace.path}</div>
                              <div className="mt-1 text-muted-foreground">{traceQuery.data.trace.controllerAction || 'Controller not resolved'}</div>
                              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                                <div>Status: {traceQuery.data.trace.statusCode ?? 'n/a'}</div>
                                <div>Duration: {traceQuery.data.trace.durationMs}ms</div>
                                <div>Request bytes: {traceQuery.data.trace.requestBytes ?? 0}</div>
                                <div>Response bytes: {traceQuery.data.trace.responseBytes ?? 0}</div>
                              </div>
                              <div className="mt-3 text-xs text-muted-foreground">
                                Payload preview: {traceQuery.data.trace.requestPayloadSummary?.preview || 'No payload'}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                      Select a node in the flowchart to inspect traces, payload summaries, blockers, and live user activity.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{timeMode === 'live' ? 'Busiest routes right now' : '24h timeline'}</CardTitle>
                <CardDescription>
                  {timeMode === 'live'
                    ? 'Top API paths by request volume with current latency and error pressure.'
                    : '15-minute buckets across the last 24 hours.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeMode === 'live' ? (
                  <div className="space-y-3">
                    {topRoutes.map((route) => (
                      <div key={route.path} className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 truncate font-medium text-foreground" title={route.path}>{route.path}</div>
                          <Badge variant="outline" className="shrink-0">{route.requestCount} req</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                          <div className={cn(route.errorCount > 0 && 'font-medium text-amber-700 dark:text-amber-300')}>Errors: {route.errorCount}</div>
                          <div className="tabular-nums">Avg: {route.avgDurationMs}ms</div>
                          <div className="tabular-nums">Max: {route.maxDurationMs}ms</div>
                        </div>
                      </div>
                    ))}
                    {topRoutes.length === 0 && <EmptyState icon="activity" title={<>No route traffic in this window.</>} size="compact" />}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(history?.timeline ?? []).slice(-8).map((point) => (
                      <div key={point.bucketStart} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                        <div className="tabular-nums text-muted-foreground">{new Date(point.bucketStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, point.requests * 6)}%` }}
                          />
                        </div>
                        <div className="text-right tabular-nums text-muted-foreground">{point.requests}</div>
                      </div>
                    ))}
                    {(history?.timeline ?? []).length === 0 && <EmptyState icon="activity" title={<>No timeline data for the last 24 hours.</>} size="compact" />}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Latest blockers</CardTitle>
                <CardDescription>Recent frontend and backend errors across the monitored system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.recentErrors ?? []).slice(0, 6).map((error) => (
                  <div key={`${error.traceId || error.message}-${error.occurredAt}`} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 break-words font-medium text-foreground">{error.message}</div>
                      <Badge variant="outline" className="shrink-0">{error.source}</Badge>
                    </div>
                    <div className="mt-1 break-all text-xs text-muted-foreground">{error.routePath || error.componentName || error.errorClass}</div>
                  </div>
                ))}
                {(snapshot?.recentErrors ?? []).length === 0 && <EmptyState icon="clear" title={<>No blockers recorded recently.</>} size="compact" />}
              </CardContent>
            </Card>
      </div>

      {isCanvasExpanded && (
        <div className="fixed inset-0 z-50 p-3 sm:p-4">
          <button
            type="button"
            aria-label="Exit full view"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setIsCanvasExpanded(false)}
          />
          <div className="relative flex h-full flex-col">
            {renderSystemMap(true)}
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemOverviewTab;

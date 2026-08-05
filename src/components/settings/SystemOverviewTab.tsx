import { useEffect, useMemo, useState } from 'react';
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
import { motion } from 'framer-motion';
import { toast } from '@/lib/sonner-toast';
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
import type {
  SystemHistory,
} from '@/types/systemOverview';
import styles from './SystemOverviewTab.module.css';

import {
  buildFlow,
  clearNodePositions,
  ICONS,
  nodeTypes,
  saveNodePositions,
  type FlowNode,
} from './systemOverviewFlow';

export function SystemOverviewTab() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const renderSystemMap = (heightClass: string, expandedView = false) => (
    <div className={`overflow-hidden rounded-3xl border shadow-sm ${isDark ? 'border-white/10 bg-slate-950' : 'border-slate-200/80 bg-white'}`}>
      <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? 'border-slate-800 text-slate-200' : 'border-slate-200 text-slate-700'}`}>
        <div>
          <div className="text-sm font-semibold">System map</div>
          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Drag nodes or the canvas, then use the inspector for details instead of scanning everything at once.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={isDark ? 'bg-sky-500/15 text-sky-100' : 'bg-sky-100 text-sky-700'}>
            {nodes.length} nodes
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => setIsCanvasExpanded((current) => !current)}
          >
            {expandedView ? <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> : <Maximize2 className="mr-1.5 h-3.5 w-3.5" />}
            {expandedView ? 'Exit full view' : 'Full view'}
          </Button>
        </div>
      </div>
      <div
        className={`${heightClass} w-full ${
          isDark ? styles.canvasDark : styles.canvasLight
        }`}
      >
        <ReactFlow
          className="system-overview-flow"
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
          <Background color={isDark ? '#1e293b' : '#cbd5e1'} gap={24} />
          <Controls position="top-left" showInteractive={false} style={{}} />
        </ReactFlow>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="border-slate-200/70">
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Loading live topology, traces, and system metrics for superadmin view.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-[520px] animate-pulse rounded-3xl bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-950">
            <AlertTriangle className="h-5 w-5" />
            System overview is unavailable
          </CardTitle>
          <CardDescription className="text-amber-900/80">
            The overview endpoints did not respond correctly. Refresh the page or check the telemetry API and broadcast worker.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!telemetryAvailable) {
    return (
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className={`border-b border-border/70 text-white ${styles.setupHeader}`}>
          <div className="flex items-center gap-3">
            <Network className="h-5 w-5 text-sky-300" />
            <div>
              <CardTitle>System Overview</CardTitle>
              <CardDescription className="text-slate-200">
                Telemetry is not initialized yet, so the observability workspace is in setup mode.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 p-5">
            <div className="text-sm font-medium text-slate-950">Telemetry not initialized</div>
            <div className="mt-2 text-sm text-slate-600">
              The app is healthy, but the system overview tables have not been migrated in this environment yet. The dashboard and normal pages continue to work while this feature stays paused.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">What to run</div>
              <div className="mt-2 text-sm text-slate-700">
                Apply only the four `2026_03_28_000001` through `2026_03_28_000004` system overview migrations in the backend.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Current behavior</div>
              <div className="mt-2 text-sm text-slate-700">
                Telemetry requests are now suppressed temporarily, and the rest of the app remains fully usable.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader
          className={`border-b border-border/70 ${
            isDark
              ? `${styles.headerDark} text-white`
              : `${styles.headerLight} text-slate-950`
          }`}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="space-y-2">
              <div className={`flex items-center gap-2 ${isDark ? 'text-sky-200' : 'text-sky-700'}`}>
                <Network className="h-4 w-4" />
                Superadmin Observability
              </div>
              <CardTitle className="text-2xl">System Overview</CardTitle>
              <CardDescription className={`max-w-2xl ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
                A focused observability workspace for route health, live user presence, blockers, and recent traces without the previous control overload.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end lg:self-start xl:flex-nowrap">
              <Tabs value={timeMode} onValueChange={(value) => setTimeMode(value as 'live' | 'history')}>
                <TabsList className={`h-12 ${isDark ? 'bg-white/10' : 'bg-slate-950/5'}`}>
                  <TabsTrigger value="live" className="px-4 text-sm whitespace-nowrap">
                    Live
                  </TabsTrigger>
                  <TabsTrigger value="history" className="px-4 text-sm whitespace-nowrap">
                    Last 24h
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                  isDark ? 'border-white/20 bg-white/5 text-white' : 'border-slate-300 bg-white/70 text-slate-700'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                {snapshot?.stats.activeSessions ?? 0} live sessions
              </div>
              <button
                type="button"
                onClick={() => setIsCanvasExpanded(true)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                  isDark ? 'border-white/20 bg-white/5 text-white' : 'border-slate-300 bg-white/70 text-slate-700'
                }`}
              >
                <ZoomIn className="h-3.5 w-3.5" />
                <span>Canvas workspace</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Active Sessions', value: snapshot?.stats.activeSessions ?? 0, icon: Users },
              { label: 'Requests / min', value: snapshot?.stats.requestsPerMinute ?? 0, icon: Activity },
              { label: 'Errors 24h', value: snapshot?.stats.errorCount24h ?? 0, icon: AlertTriangle },
              { label: 'Slow Routes', value: snapshot?.stats.slowRouteCount ?? 0, icon: Clock3 },
              { label: 'Integration Failures', value: snapshot?.stats.integrationFailures24h ?? 0, icon: Plug },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-3xl border p-4 shadow-sm ${
                  isDark ? 'border-white/10 bg-slate-950/50' : 'border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{stat.label}</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</div>
                  </div>
                  <stat.icon className="h-5 w-5 text-sky-600" />
                </div>
              </motion.div>
            ))}
          </div>

          <Card className={`rounded-3xl border shadow-sm ${isDark ? 'border-white/10 bg-slate-950/55' : 'border-slate-200/80 bg-white'}`}>
            <CardContent className="space-y-3 p-4">
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
                  <span>Deep links</span>
                  <Switch checked={showEverything} onCheckedChange={setShowEverything} />
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {domainSummaries.map((domain) => {
                  const Icon = ICONS[domain.icon as keyof typeof ICONS] || Network;
                  const active = domain.isExpanded;
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() =>
                        setExpandedDomains((current) =>
                          current.includes(domain.id)
                            ? current.filter((value) => value !== domain.id)
                            : [...current, domain.id],
                        )
                      }
                      className={`min-w-[220px] rounded-2xl border p-3 text-left transition-colors ${
                        active
                          ? 'border-sky-300 bg-sky-50 text-slate-950 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-50'
                          : 'border-border/70 bg-background hover:border-sky-200 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-sky-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{domain.label}</div>
                            <Badge variant="outline" className="h-7 px-2 text-[11px]">
                              {domain.stats?.requests ?? 0} req
                            </Badge>
                          </div>
                          <div className="mt-1 text-[13px] leading-6 text-muted-foreground">{domain.description}</div>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{domain.stats?.activeUsers ?? 0} live users</span>
                            <span>{domain.stats?.errors ?? 0} errors</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            {renderSystemMap('h-[700px]')}

            <div className="grid min-h-0 gap-4">
              <Card className="rounded-3xl border-border/70 shadow-sm min-h-0">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Live users</CardTitle>
                      {!liveUsersCollapsed && (
                        <CardDescription>See who is active now and which route or blocker needs attention.</CardDescription>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setLiveUsersCollapsed((current) => !current)}>
                      {liveUsersCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                {!liveUsersCollapsed && (
                <CardContent className="space-y-3 pb-4">
                  <ScrollArea className="h-[360px] xl:h-[420px] pr-3">
                    <div className="space-y-3 pb-4">
                      {liveUsers.map((user) => (
                        <div key={user.sessionKey} className="rounded-2xl border border-border/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-foreground">{user.userName || 'Unknown user'}</div>
                              <div className="text-xs text-muted-foreground">{user.userRole || 'unknown role'}</div>
                            </div>
                            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <div>{user.currentRoute || 'No route captured yet'}</div>
                            <div>{user.currentAction || 'Browsing'}</div>
                            {user.blockerMessage && <div className="text-amber-700">{user.blockerMessage}</div>}
                          </div>
                        </div>
                      ))}
                      {liveUsers.length === 0 && <div className="text-sm text-slate-500">No live users detected in the last two minutes.</div>}
                    </div>
                  </ScrollArea>
                </CardContent>
                )}
              </Card>

              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Inspector</CardTitle>
                  <CardDescription>Route chains, trace detail, blockers, and recent activity for the currently selected node.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedNode?.data ? (
                    <>
                      <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-slate-950/50' : 'border-slate-200/70 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{selectedNode.data.kind}</div>
                            <div className="mt-1 text-lg font-semibold text-foreground">{selectedNode.data.label}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{selectedNode.data.description}</div>
                          </div>
                          <Badge>{selectedNode.data.domain}</Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                          <div className={`rounded-2xl p-3 ${isDark ? 'bg-slate-900/80' : 'bg-white'}`}>
                            <div className="text-xs text-muted-foreground">Users</div>
                            <div className="font-semibold">{selectedNode.data.activeUsers ?? 0}</div>
                          </div>
                          <div className={`rounded-2xl p-3 ${isDark ? 'bg-slate-900/80' : 'bg-white'}`}>
                            <div className="text-xs text-muted-foreground">Requests</div>
                            <div className="font-semibold">{selectedNode.data.requests ?? 0}</div>
                          </div>
                          <div className={`rounded-2xl p-3 ${isDark ? 'bg-slate-900/80' : 'bg-white'}`}>
                            <div className="text-xs text-muted-foreground">Errors</div>
                            <div className="font-semibold">{selectedNode.data.errors ?? 0}</div>
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
                              className={`w-full rounded-2xl border p-3 text-left transition ${
                                isDark
                                  ? 'border-white/10 hover:border-sky-500/40 hover:bg-sky-500/10'
                                  : 'border-slate-200/70 hover:border-sky-300 hover:bg-sky-50/60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-foreground">{trace.method} {trace.path}</div>
                                <Badge variant="outline">{trace.statusCode ?? 'n/a'}</Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{trace.durationMs}ms • {trace.occurredAt || 'recent'}</div>
                            </button>
                          ))}
                          {relatedTraces.length === 0 && <div className="text-sm text-muted-foreground">No matching traces yet.</div>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">Blockers & errors</div>
                        <div className="space-y-2">
                          {relatedErrors.slice(0, 4).map((error, index) => (
                            <div key={`${error.traceId || index}-${error.message}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                                <AlertTriangle className="h-4 w-4" />
                                {error.message}
                              </div>
                              <div className="mt-1 text-xs text-amber-800/80">{error.routePath || error.componentName || error.errorClass}</div>
                            </div>
                          ))}
                          {relatedErrors.length === 0 && <div className="text-sm text-muted-foreground">No blockers currently linked to this node.</div>}
                        </div>
                      </div>

                      {traceQuery.data && selectedTraceId && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">Trace detail</div>
                            <div className={`rounded-2xl border p-4 text-sm ${isDark ? 'border-white/10 bg-slate-950/50' : 'border-slate-200/70 bg-slate-50'}`}>
                              <div className="font-medium text-foreground">{traceQuery.data.trace.method} {traceQuery.data.trace.path}</div>
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
                    <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      Select a node in the flowchart to inspect traces, payload summaries, blockers, and live user activity.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-3xl border-border/70 shadow-sm">
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
                      <div key={route.path} className="rounded-2xl border border-border/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-foreground">{route.path}</div>
                          <Badge variant="outline">{route.requestCount} req</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                          <div>Errors: {route.errorCount}</div>
                          <div>Avg: {route.avgDurationMs}ms</div>
                          <div>Max: {route.maxDurationMs}ms</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(history?.timeline ?? []).slice(-8).map((point) => (
                      <div key={point.bucketStart} className="grid grid-cols-[110px_1fr_56px] items-center gap-3 text-sm">
                        <div className="text-muted-foreground">{new Date(point.bucketStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className={`h-3 overflow-hidden rounded-full ${isDark ? 'bg-slate-900/80' : 'bg-slate-100'}`}>
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                            style={{ width: `${Math.min(100, point.requests * 6)}%` }}
                          />
                        </div>
                        <div className="text-right text-muted-foreground">{point.requests}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Latest blockers</CardTitle>
                <CardDescription>Recent frontend and backend errors across the monitored system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.recentErrors ?? []).slice(0, 6).map((error) => (
                  <div key={`${error.traceId || error.message}-${error.occurredAt}`} className="rounded-2xl border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{error.message}</div>
                      <Badge variant="outline">{error.source}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{error.routePath || error.componentName || error.errorClass}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {isCanvasExpanded && (
        <div className="fixed inset-4 z-50">
          <div className="absolute inset-0 rounded-[2rem] bg-slate-950/70 backdrop-blur-sm" onClick={() => setIsCanvasExpanded(false)} />
          <div className="relative flex h-full flex-col">
            {renderSystemMap('h-[calc(100vh-8rem)]', true)}
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemOverviewTab;

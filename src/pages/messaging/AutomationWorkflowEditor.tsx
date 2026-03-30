import { addEdge, type Connection, type EdgeChange, type NodeChange, type NodeTypes, type ReactFlowInstance, type Viewport, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AutomationWorkflowNode } from '@/components/messaging/automations/AutomationWorkflowNode';
import { type AutomationFlowNode } from '@/components/messaging/automations/automationWorkflowTypes';
import {
  createEmptyWorkflow,
  createNodeDefinition,
  ensureWorkflowMetadata,
  getNodePresentation,
  nodeTypesPalette,
  workflowToFlow,
  flowToWorkflow,
} from '@/components/messaging/automations/workflow-utils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  createAutomation,
  getAutomation,
  getEmailSettings,
  getTemplates,
  runAutomation,
  simulateAutomation,
  toggleAutomation,
  updateAutomation,
  validateAutomationWorkflow,
} from '@/services/messaging';
import type { AutomationRule, AutomationSimulationResult, WorkflowDefinition, WorkflowNode, WorkflowNodeType } from '@/types/messaging';
import { AutomationWorkflowCanvasPanel } from './automation-workflow-editor/AutomationWorkflowCanvasPanel';
import { AutomationWorkflowDiagnosticsPanel } from './automation-workflow-editor/AutomationWorkflowDiagnosticsPanel';
import { AutomationWorkflowEditorHeader } from './automation-workflow-editor/AutomationWorkflowEditorHeader';
import { AutomationWorkflowInspectorPanel } from './automation-workflow-editor/AutomationWorkflowInspectorPanel';
import { AutomationWorkflowSidebar } from './automation-workflow-editor/AutomationWorkflowSidebar';
import {
  LocationState,
  buildWorkflowSummary,
  createMetaFromAutomation,
  deriveWorkflowPayload,
  getMutationErrorMessage,
  getTriggerTypeForWorkflow,
  getWorkflowVariables,
} from './automation-workflow-editor/helpers';

const canvasNodeTypes: NodeTypes = {
  automationNode: AutomationWorkflowNode,
};

export default function AutomationWorkflowEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { automationId } = useParams();
  const state = (location.state ?? {}) as LocationState;
  const duplicateAutomation = state.duplicateAutomation;

  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 1024);
  const [meta, setMeta] = useState(() => createMetaFromAutomation(duplicateAutomation));
  const [workflowMeta, setWorkflowMeta] = useState<Record<string, unknown>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<AutomationRule['validation_state'] | null>(null);
  const [simulationResult, setSimulationResult] = useState<AutomationSimulationResult | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [flowViewport, setFlowViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [nodes, setNodes, onNodesChange] = useNodesState<AutomationFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const initializedFrom = useRef<string | null>(null);

  const automationQuery = useQuery({
    queryKey: ['automation', automationId],
    queryFn: () => getAutomation(Number(automationId)),
    enabled: Boolean(automationId),
  });

  const templatesQuery = useQuery({
    queryKey: ['automation-templates'],
    queryFn: () => getTemplates({ is_active: true }),
  });

  const emailSettingsQuery = useQuery({
    queryKey: ['automation-email-settings'],
    queryFn: getEmailSettings,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<AutomationRule>) => {
      if (automationId) {
        return updateAutomation(Number(automationId), payload);
      }

      return createAutomation(payload);
    },
    onSuccess: async (savedAutomation) => {
      toast.success(automationId ? 'Workflow updated successfully' : 'Workflow created successfully');
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
      await queryClient.invalidateQueries({ queryKey: ['automation', savedAutomation.id] });
      navigate(`/messaging/email/automations/${savedAutomation.id}`, { replace: true });
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, 'Failed to save workflow'));
    },
  });

  const validateMutation = useMutation({
    mutationFn: validateAutomationWorkflow,
    onSuccess: (result) => {
      setValidationState(result);
      syncCanvasWithValidation(result);
      toast.success(result.valid ? 'Workflow validated successfully' : 'Validation returned issues');
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, 'Failed to validate workflow'));
    },
  });

  const simulateMutation = useMutation({
    mutationFn: () => simulateAutomation(Number(automationId)),
    onSuccess: (result) => {
      setSimulationResult(result);
      toast.success('Simulation complete');
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, 'Failed to simulate automation'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAutomation,
    onSuccess: async (updatedAutomation) => {
      setMeta((current) => ({ ...current, is_active: updatedAutomation.is_active }));
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
      await queryClient.invalidateQueries({ queryKey: ['automation', updatedAutomation.id] });
      toast.success(updatedAutomation.is_active ? 'Automation enabled' : 'Automation disabled');
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, 'Failed to update automation status'));
    },
  });

  const runMutation = useMutation({
    mutationFn: runAutomation,
    onSuccess: async () => {
      toast.success('Automation run started');
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
      if (automationId) {
        await queryClient.invalidateQueries({ queryKey: ['automation', automationId] });
      }
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, 'Failed to run automation'));
    },
  });

  const currentAutomation = automationQuery.data ?? duplicateAutomation ?? null;
  const templates = templatesQuery.data ?? [];
  const emailTemplates = templates.filter((template) => template.channel === 'EMAIL');
  const smsTemplates = templates.filter((template) => template.channel === 'SMS');
  const emailChannels = emailSettingsQuery.data?.channels ?? [];
  const isReadOnlyMobile = isMobileViewport;
  const isStructureLocked = meta.is_system_locked;

  useEffect(() => {
    const handleResize = () => setIsMobileViewport(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => window.removeEventListener('beforeunload', beforeUnloadHandler);
  }, [isDirty]);

  useEffect(() => {
    const automation = automationQuery.data;
    if (automation && initializedFrom.current !== `existing-${automation.id}`) {
      const workflow = ensureWorkflowMetadata(automation.workflow_definition_json, automation.trigger_type);
      const flow = workflowToFlow(workflow, automation);
      setMeta(createMetaFromAutomation(automation));
      setWorkflowMeta((workflow.meta as Record<string, unknown>) ?? {});
      setFlowViewport(workflow.viewport ?? { x: 0, y: 0, zoom: 1 });
      setValidationState(automation.validation_state ?? null);
      setSimulationResult(null);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setSelectedNodeId(workflow.nodes[0]?.id ?? null);
      setIsDirty(false);
      initializedFrom.current = `existing-${automation.id}`;
    }
  }, [automationQuery.data, setEdges, setNodes]);

  useEffect(() => {
    if (!automationId && initializedFrom.current !== 'new') {
      const baseAutomation = duplicateAutomation ?? null;
      const duplicatedWorkflow = baseAutomation
        ? ensureWorkflowMetadata(baseAutomation.workflow_definition_json, baseAutomation.trigger_type)
        : createEmptyWorkflow();
      const flow = workflowToFlow(duplicatedWorkflow, baseAutomation ?? undefined);

      setMeta({
        ...createMetaFromAutomation(baseAutomation),
        name: baseAutomation ? `${baseAutomation.name} Copy` : '',
        scope: baseAutomation?.scope === 'SYSTEM' ? 'GLOBAL' : baseAutomation?.scope ?? 'GLOBAL',
        is_system_locked: false,
      });
      setWorkflowMeta((duplicatedWorkflow.meta as Record<string, unknown>) ?? {});
      setFlowViewport(duplicatedWorkflow.viewport ?? { x: 0, y: 0, zoom: 1 });
      setValidationState(baseAutomation?.validation_state ?? null);
      setSimulationResult(null);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setSelectedNodeId(duplicatedWorkflow.nodes[0]?.id ?? null);
      setIsDirty(false);
      initializedFrom.current = 'new';
    }
  }, [automationId, duplicateAutomation, setEdges, setNodes]);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedRawNode = selectedNode?.data.rawNode ?? null;

  const currentWorkflow = useMemo<WorkflowDefinition>(() => {
    const viewport = flowRef.current?.getViewport() ?? flowViewport;
    return flowToWorkflow(nodes, edges, {
      nodes: [],
      edges: [],
      viewport,
      meta: workflowMeta as WorkflowDefinition['meta'],
    });
  }, [edges, flowViewport, nodes, workflowMeta]);

  const summary = useMemo(() => buildWorkflowSummary(currentWorkflow), [currentWorkflow]);
  const triggerType = getTriggerTypeForWorkflow(currentWorkflow, automationQuery.data ?? null);
  const availableVariables = getWorkflowVariables(triggerType);

  function syncCanvasWithValidation(nextValidation: AutomationRule['validation_state'] | null) {
    const flow = workflowToFlow(currentWorkflow, {
      is_system_locked: meta.is_system_locked,
      validation_state: nextValidation ?? undefined,
    });
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }

  const updateNode = (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        const nextRawNode = updater(node.data.rawNode);
        const presentation = getNodePresentation(nextRawNode, {
          is_system_locked: meta.is_system_locked,
          validation_state: validationState ?? undefined,
        });

        return {
          ...node,
          data: {
            ...node.data,
            ...presentation,
            rawNode: nextRawNode,
            validationErrors: validationState?.node_errors?.[nextRawNode.id] ?? [],
          },
        };
      }),
    );
    setIsDirty(true);
  };

  const handleNodesChange = (changes: NodeChange<AutomationFlowNode>[]) => {
    onNodesChange(changes);
    const selectedChange = changes.find((change): change is Extract<NodeChange<AutomationFlowNode>, { type: 'select'; id: string }> => change.type === 'select' && 'id' in change && 'selected' in change && change.selected);
    if (selectedChange?.id) {
      setSelectedNodeId(selectedChange.id);
    }
    if (changes.some((change) => change.type !== 'select')) {
      setIsDirty(true);
    }
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    onEdgesChange(changes);
    if (changes.length > 0) {
      setIsDirty(true);
    }
  };

  const handleConnect = (connection: Connection) => {
    if (isReadOnlyMobile || isStructureLocked) return;
    setEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          label: connection.sourceHandle ? connection.sourceHandle.toUpperCase() : undefined,
          animated: Boolean(connection.sourceHandle),
          style: connection.sourceHandle ? { strokeDasharray: '5 5' } : undefined,
        },
        currentEdges,
      ),
    );
    setIsDirty(true);
  };

  const handleAddNode = (type: WorkflowNodeType) => {
    if (isReadOnlyMobile || isStructureLocked) return;

    const nextRawNode = createNodeDefinition(type, nodes.length + 1);
    const presentation = getNodePresentation(nextRawNode, { is_system_locked: meta.is_system_locked });
    const nextNode: AutomationFlowNode = {
      id: nextRawNode.id,
      type: 'automationNode',
      position: nextRawNode.position,
      data: {
        ...presentation,
        rawNode: nextRawNode,
        locked: meta.is_system_locked,
        validationErrors: [],
      },
    };

    setNodes((currentNodes) => [...currentNodes, nextNode]);

    if (selectedRawNode && selectedRawNode.type !== 'condition.if' && selectedRawNode.type !== 'end') {
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: `${selectedRawNode.id}_${nextRawNode.id}`,
          source: selectedRawNode.id,
          target: nextRawNode.id,
        },
      ]);
    }

    setSelectedNodeId(nextRawNode.id);
    setIsDirty(true);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedRawNode || isReadOnlyMobile || isStructureLocked) return;
    if (String(selectedRawNode.type).startsWith('trigger.')) {
      toast.error('The trigger node is required and cannot be deleted');
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedRawNode.id));
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== selectedRawNode.id && edge.target !== selectedRawNode.id));
    setSelectedNodeId(nodes.find((node) => node.id !== selectedRawNode.id)?.id ?? null);
    setIsDirty(true);
  };

  const handleValidate = async () => {
    const result = await validateMutation.mutateAsync(currentWorkflow);
    setValidationState(result);
    syncCanvasWithValidation(result);
    return result;
  };

  const handleSave = async () => {
    if (!meta.name.trim()) {
      toast.error('Automation name is required');
      return;
    }

    const result = await handleValidate();
    if (!result.valid) {
      toast.error('Resolve the validation issues before saving');
      return;
    }

    const workflowToPersist: WorkflowDefinition = {
      ...currentWorkflow,
      viewport: flowRef.current?.getViewport() ?? flowViewport,
      meta: workflowMeta as WorkflowDefinition['meta'],
    };

    const payload = deriveWorkflowPayload(meta, workflowToPersist, automationQuery.data ?? null);
    await saveMutation.mutateAsync(payload);
  };

  const handleDuplicate = () => {
    if (!currentAutomation) return;
    navigate('/messaging/email/automations/new', {
      state: {
        duplicateAutomation: {
          ...currentAutomation,
          scope: currentAutomation.scope === 'SYSTEM' ? 'GLOBAL' : currentAutomation.scope,
          is_system_locked: false,
        },
      },
    });
  };

  const handleSimulate = () => {
    if (!automationId) {
      toast.error('Save the automation before running a simulation');
      return;
    }
    if (isDirty) {
      toast.error('Save your workflow changes before simulating');
      return;
    }
    simulateMutation.mutate();
  };

  const handleToggle = () => {
    if (!automationId) {
      toast.error('Save the automation before toggling it');
      return;
    }
    toggleMutation.mutate(Number(automationId));
  };

  const handleRun = () => {
    if (!automationId) {
      toast.error('Save the automation before running it');
      return;
    }
    runMutation.mutate(Number(automationId));
  };

  if (automationQuery.isLoading) {
    return (
      <DashboardLayout>
        <EmailNavigation />
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-10">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading automation workflow...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (automationId && automationQuery.isError) {
    return (
      <DashboardLayout>
        <EmailNavigation />
        <div className="px-6 py-8">
          <Card className="p-8 text-center">
            <h1 className="text-xl font-semibold">Automation not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">The workflow you requested could not be loaded.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/messaging/email/automations')}>
              Back to Automations
            </Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <EmailNavigation />
      <div className="flex flex-col gap-4 px-2 pt-3 pb-4 sm:px-6 sm:pt-6">
        <AutomationWorkflowEditorHeader
          automationId={automationId}
          meta={meta}
          triggerType={triggerType}
          summary={summary}
          isReadOnlyMobile={isReadOnlyMobile}
          isDirty={isDirty}
          currentAutomation={currentAutomation}
          currentWorkflow={currentWorkflow}
          validationValid={Boolean(validationState?.valid)}
          validatePending={validateMutation.isPending}
          savePending={saveMutation.isPending}
          simulatePending={simulateMutation.isPending}
          togglePending={toggleMutation.isPending}
          runPending={runMutation.isPending}
          onBack={() => navigate('/messaging/email/automations')}
          onSave={handleSave}
          onValidate={handleValidate}
          onSimulate={handleSimulate}
          onDuplicate={handleDuplicate}
          onToggle={handleToggle}
          onRun={handleRun}
        />

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <AutomationWorkflowSidebar
            meta={meta}
            triggerType={triggerType}
            summary={summary}
            availableVariables={availableVariables}
            isReadOnlyMobile={isReadOnlyMobile}
            isStructureLocked={isStructureLocked}
            onMetaChange={(updater) => {
              setMeta((current) => updater(current));
              setIsDirty(true);
            }}
            onAddNode={handleAddNode}
            nodePalette={nodeTypesPalette}
          />

          <AutomationWorkflowCanvasPanel
            nodes={nodes}
            edges={edges}
            nodeTypes={canvasNodeTypes}
            isReadOnlyMobile={isReadOnlyMobile}
            isStructureLocked={isStructureLocked}
            isDirty={isDirty}
            validationValid={Boolean(validationState?.valid)}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
            onNodeClick={setSelectedNodeId}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onMoveEnd={setFlowViewport}
          />

          <AutomationWorkflowInspectorPanel
            selectedRawNode={selectedRawNode}
            currentAutomation={currentAutomation}
            availableVariables={availableVariables}
            isReadOnlyMobile={isReadOnlyMobile}
            isStructureLocked={isStructureLocked}
            isSystemLocked={meta.is_system_locked}
            emailTemplates={emailTemplates}
            smsTemplates={smsTemplates}
            emailChannels={emailChannels}
            recentRuns={automationQuery.data?.recent_runs}
            onDeleteSelectedNode={handleDeleteSelectedNode}
            updateNode={updateNode}
          />
        </div>

        <AutomationWorkflowDiagnosticsPanel validationState={validationState ?? null} simulationResult={simulationResult} />
      </div>
    </DashboardLayout>
  );
}

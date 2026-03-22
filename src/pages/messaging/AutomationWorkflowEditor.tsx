import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CopyPlus,
  GitBranch,
  Loader2,
  Play,
  Plus,
  Save,
  Shield,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { AutomationWorkflowNode } from '@/components/messaging/automations/AutomationWorkflowNode';
import {
  createEmptyWorkflow,
  createNodeDefinition,
  ensureWorkflowMetadata,
  getNodePresentation,
  nodeTypesPalette,
  triggerGroups,
  triggerLabels,
  workflowToFlow,
  flowToWorkflow,
} from '@/components/messaging/automations/workflow-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import type {
  AutomationRule,
  AutomationTriggerType,
  AutomationValidationState,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
} from '@/types/messaging';

const weekdayOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const ruleOperatorOptions = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Does not equal' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'exists', label: 'Exists' },
  { value: 'in', label: 'Is in list' },
];

const recipientRoleOptions = [
  { value: 'client', label: 'Client' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'admin', label: 'Admin team' },
  { value: 'rep', label: 'Sales rep' },
];

const contextRecipientOptions = [
  { value: 'client', label: 'Client from trigger context' },
  { value: 'photographer', label: 'Photographer from trigger context' },
  { value: 'rep', label: 'Rep from trigger context' },
];

const variableHints: Record<string, string[]> = {
  default: [
    '{{shoot_address}}',
    '{{shoot_datetime}}',
    '{{client.name}}',
    '{{photographer.name}}',
    '{{rep.name}}',
    '{{invoice.total}}',
  ],
  SHOOT_BOOKED: ['{{shoot_address}}', '{{shoot_datetime}}', '{{client.name}}', '{{services}}'],
  SHOOT_UPDATED: ['{{shoot_address}}', '{{shoot_datetime}}', '{{changes.summary}}', '{{client.name}}'],
  PAYMENT_FAILED: ['{{client.name}}', '{{invoice.total}}', '{{invoice.id}}'],
  WEEKLY_AUTOMATED_INVOICING: ['{{period_start}}', '{{period_end}}', '{{invoice_count}}'],
  WEEKLY_SALES_REPORT: ['{{period_start}}', '{{period_end}}', '{{sales_total}}'],
};

const scheduleTriggerTypes: AutomationTriggerType[] = ['WEEKLY_AUTOMATED_INVOICING', 'WEEKLY_SALES_REPORT'];

const canvasNodeTypes = {
  automationNode: AutomationWorkflowNode,
};

type AutomationEditorMeta = {
  name: string;
  description: string;
  scope: AutomationRule['scope'];
  is_active: boolean;
  editor_mode: 'visual' | 'simple';
  is_system_locked: boolean;
};

type LocationState = {
  duplicateAutomation?: AutomationRule;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not run yet';

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getTriggerNode = (workflow: WorkflowDefinition) =>
  workflow.nodes.find((node) => String(node.type).startsWith('trigger.'));

const getPrimaryActionNode = (workflow: WorkflowDefinition) =>
  workflow.nodes.find((node) => node.type === 'action.email' || node.type === 'action.sms');

const summarizeSchedule = (workflow: WorkflowDefinition, automation?: AutomationRule | null) => {
  const triggerNode = getTriggerNode(workflow);

  if (triggerNode?.type === 'trigger.schedule') {
    const schedule = triggerNode.config?.schedule ?? {};
    const dayOfWeek = weekdayOptions.find((option) => option.value === String(schedule.day_of_week ?? 1))?.label ?? 'Monday';
    return `${schedule.type || 'weekly'} on ${dayOfWeek} at ${schedule.time || '01:00'}`;
  }

  if (automation?.schedule_json?.offset) {
    return `Offset ${automation.schedule_json.offset}`;
  }

  return 'Event-driven';
};

const createMetaFromAutomation = (automation?: AutomationRule | null): AutomationEditorMeta => ({
  name: automation?.name ?? '',
  description: automation?.description ?? '',
  scope: automation?.scope ?? 'GLOBAL',
  is_active: automation?.is_active ?? true,
  editor_mode: (automation?.editor_mode as 'visual' | 'simple') ?? 'visual',
  is_system_locked: Boolean(automation?.is_system_locked),
});

const getWorkflowVariables = (triggerType?: string) => {
  return variableHints[triggerType || ''] ?? variableHints.default;
};

const deriveWorkflowPayload = (
  meta: AutomationEditorMeta,
  workflow: WorkflowDefinition,
  automation?: AutomationRule | null,
) => {
  const triggerNode = getTriggerNode(workflow);
  const primaryActionNode = getPrimaryActionNode(workflow);
  const firstConditionNode = workflow.nodes.find((node) => node.type === 'condition.if');
  const derivedTriggerType = (triggerNode?.config?.triggerType || automation?.trigger_type || 'SHOOT_BOOKED') as AutomationTriggerType;
  const recipientRoles = Array.isArray(primaryActionNode?.config?.recipientRoles)
    ? primaryActionNode?.config?.recipientRoles
    : Array.isArray(automation?.recipients_json)
      ? automation?.recipients_json
      : automation?.recipients_json?.roles ?? ['client'];

  const scheduleJson =
    triggerNode?.type === 'trigger.schedule'
      ? {
          ...(triggerNode.config?.schedule ?? {}),
          ...(workflow.meta?.system_command ? { command: workflow.meta.system_command as string } : {}),
        }
      : automation?.schedule_json ?? null;

  return {
    name: meta.name,
    description: meta.description,
    trigger_type: derivedTriggerType,
    editor_mode: meta.editor_mode,
    engine_version: 2,
    is_active: meta.is_active,
    scope: meta.scope,
    template_id: primaryActionNode?.config?.templateId ? Number(primaryActionNode.config.templateId) : automation?.template_id ?? null,
    channel_id: primaryActionNode?.config?.channelId ? Number(primaryActionNode.config.channelId) : automation?.channel_id ?? null,
    recipients_json: recipientRoles,
    condition_json: firstConditionNode?.config ?? automation?.condition_json ?? null,
    schedule_json: scheduleJson,
    workflow_definition_json: workflow,
    entry_trigger_json: {
      trigger_type: derivedTriggerType,
      node_id: triggerNode?.id ?? null,
      node_type: triggerNode?.type ?? null,
      config: triggerNode?.config ?? {},
    },
    is_system_locked: meta.is_system_locked,
  };
};

export default function AutomationWorkflowEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { automationId } = useParams();
  const state = (location.state ?? {}) as LocationState;
  const duplicateAutomation = state.duplicateAutomation;
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 1024);
  const [meta, setMeta] = useState<AutomationEditorMeta>(() => createMetaFromAutomation(duplicateAutomation));
  const [workflowMeta, setWorkflowMeta] = useState<Record<string, any>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<AutomationValidationState | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [flowViewport, setFlowViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
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
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to save workflow');
    },
  });

  const validateMutation = useMutation({
    mutationFn: validateAutomationWorkflow,
    onSuccess: (result) => {
      setValidationState(result);
      syncCanvasWithValidation(result);
      toast.success(result.valid ? 'Workflow validated successfully' : 'Validation returned issues');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to validate workflow');
    },
  });

  const simulateMutation = useMutation({
    mutationFn: () => simulateAutomation(Number(automationId)),
    onSuccess: (result) => {
      setSimulationResult(result);
      toast.success('Simulation complete');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to simulate automation');
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
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to update automation status');
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
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to run automation');
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
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

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
      setWorkflowMeta(workflow.meta ?? {});
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
      setWorkflowMeta(duplicatedWorkflow.meta ?? {});
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

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedRawNode = selectedNode?.data?.rawNode as WorkflowNode | undefined;

  const currentWorkflow = useMemo<WorkflowDefinition>(() => {
    const viewport = flowRef.current?.getViewport() ?? flowViewport;
    return flowToWorkflow(nodes, edges, {
      nodes: [],
      edges: [],
      viewport,
      meta: workflowMeta,
    });
  }, [edges, flowViewport, nodes, workflowMeta]);

  const summary = useMemo(() => {
    const nodeCounts = currentWorkflow.nodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    }, {});

    return {
      trigger: getTriggerNode(currentWorkflow),
      totalNodes: currentWorkflow.nodes.length,
      totalEdges: currentWorkflow.edges.length,
      actionCount: currentWorkflow.nodes.filter((node) => node.type.startsWith('action.')).length,
      waitCount: currentWorkflow.nodes.filter((node) => node.type.startsWith('wait.')).length,
      conditionCount: currentWorkflow.nodes.filter((node) => node.type === 'condition.if').length,
      nodeCounts,
    };
  }, [currentWorkflow]);

  function syncCanvasWithValidation(nextValidation: AutomationValidationState | null) {
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

        const nextRawNode = updater(node.data.rawNode as WorkflowNode);
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

  const handleNodesChange: OnNodesChange = (changes) => {
    onNodesChange(changes);

    const selectedChange = changes.find((change) => change.type === 'select' && 'selected' in change && change.selected);
    if (selectedChange?.id) {
      setSelectedNodeId(selectedChange.id);
    }

    if (changes.some((change) => change.type !== 'select')) {
      setIsDirty(true);
    }
  };

  const handleEdgesChange: OnEdgesChange = (changes) => {
    onEdgesChange(changes);
    if (changes.length > 0) {
      setIsDirty(true);
    }
  };

  const handleConnect = (connection: Connection) => {
    if (isReadOnlyMobile || isStructureLocked) {
      return;
    }

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
    if (isReadOnlyMobile || isStructureLocked) {
      return;
    }

    const nextRawNode = createNodeDefinition(type, nodes.length + 1);
    const presentation = getNodePresentation(nextRawNode, { is_system_locked: meta.is_system_locked });
    const nextNode: Node = {
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

    const selectedRaw = selectedNode?.data?.rawNode as WorkflowNode | undefined;
    if (selectedRaw && selectedRaw.type !== 'condition.if' && selectedRaw.type !== 'end') {
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: `${selectedRaw.id}_${nextRawNode.id}`,
          source: selectedRaw.id,
          target: nextRawNode.id,
        },
      ]);
    }

    setSelectedNodeId(nextRawNode.id);
    setIsDirty(true);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedRawNode || isReadOnlyMobile || isStructureLocked) {
      return;
    }

    if (String(selectedRawNode.type).startsWith('trigger.')) {
      toast.error('The trigger node is required and cannot be deleted');
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedRawNode.id));
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.source !== selectedRawNode.id && edge.target !== selectedRawNode.id),
    );
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

    const workflowToPersist = {
      ...currentWorkflow,
      viewport: flowRef.current?.getViewport() ?? flowViewport,
      meta: workflowMeta,
    };

    const payload = deriveWorkflowPayload(meta, workflowToPersist, automationQuery.data ?? null);
    await saveMutation.mutateAsync(payload);
  };

  const handleDuplicate = () => {
    if (!currentAutomation) {
      return;
    }

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

  const triggerType = (getTriggerNode(currentWorkflow)?.config?.triggerType || automationQuery.data?.trigger_type || 'SHOOT_BOOKED') as AutomationTriggerType;
  const availableVariables = getWorkflowVariables(triggerType);

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
            <p className="mt-2 text-sm text-muted-foreground">
              The workflow you requested could not be loaded.
            </p>
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
        <div className="flex flex-col gap-4 rounded-3xl border bg-card/70 p-4 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/messaging/email/automations')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Badge variant="outline">{automationId ? 'Existing workflow' : 'New workflow'}</Badge>
                {meta.is_system_locked && (
                  <Badge className="bg-amber-100 text-amber-800">
                    <Shield className="mr-1 h-3.5 w-3.5" />
                    System-locked structure
                  </Badge>
                )}
                {isReadOnlyMobile && (
                  <Badge className="bg-slate-100 text-slate-700">Mobile viewer mode</Badge>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {meta.name.trim() || (automationId ? 'Workflow Editor' : 'Create Workflow Automation')}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Build multi-step automations with a visual workflow, inspect weekly system flows, and validate behavior before it goes live.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Button onClick={handleSave} disabled={saveMutation.isPending || isReadOnlyMobile}>
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
              <Button variant="outline" onClick={handleValidate} disabled={validateMutation.isPending}>
                {validateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Validate
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!automationId) {
                    toast.error('Save the automation before running a simulation');
                    return;
                  }
                  if (isDirty) {
                    toast.error('Save your workflow changes before simulating');
                    return;
                  }
                  simulateMutation.mutate();
                }}
                disabled={!automationId || simulateMutation.isPending}
              >
                {simulateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Simulate
              </Button>
              <Button variant="outline" onClick={handleDuplicate} disabled={!currentAutomation}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!automationId) {
                    toast.error('Save the automation before toggling it');
                    return;
                  }
                  toggleMutation.mutate(Number(automationId));
                }}
                disabled={!automationId || toggleMutation.isPending}
              >
                <Workflow className="mr-2 h-4 w-4" />
                {meta.is_active ? 'Pause' : 'Activate'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!automationId) {
                    toast.error('Save the automation before running it');
                    return;
                  }
                  runMutation.mutate(Number(automationId));
                }}
                disabled={!automationId || meta.scope !== 'SYSTEM' || runMutation.isPending}
              >
                {runMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run now
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {meta.editor_mode === 'simple' ? 'Simple Build Summary' : 'Workflow Summary'}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border bg-background px-3 py-1 font-medium">
                {triggerLabels[triggerType] || triggerType}
              </span>
              {summary.conditionCount > 0 && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="rounded-full border bg-background px-3 py-1 font-medium">Condition</span>
                </>
              )}
              {summary.waitCount > 0 && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="rounded-full border bg-background px-3 py-1 font-medium">Wait</span>
                </>
              )}
              {summary.actionCount > 0 && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="rounded-full border bg-background px-3 py-1 font-medium">
                    {summary.actionCount === 1 ? 'Action' : `${summary.actionCount} Actions`}
                  </span>
                </>
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full border bg-background px-3 py-1 font-medium">End</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {meta.editor_mode === 'simple'
                ? 'This workflow started from the quick form. You can keep it simple or expand it here with extra conditions, waits, and branches.'
                : 'Use the canvas for advanced edits, node inspection, and execution validation.'}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Trigger</div>
              <div className="mt-2 text-lg font-semibold">
                {triggerLabels[triggerType] || triggerType}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {summarizeSchedule(currentWorkflow, automationQuery.data ?? null)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Workflow Graph</div>
              <div className="mt-2 text-lg font-semibold">{summary.totalNodes} nodes</div>
              <div className="mt-1 text-sm text-muted-foreground">{summary.totalEdges} connections</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Actions</div>
              <div className="mt-2 text-lg font-semibold">{summary.actionCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {summary.waitCount} waits, {summary.conditionCount} conditions
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status</div>
              <div className="mt-2 flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${meta.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <div className="text-lg font-semibold">{meta.is_active ? 'Active' : 'Inactive'}</div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {validationState?.valid ? 'Validation passed' : 'Review validation panel below'}
              </div>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Workflow Details</h2>
                  <p className="text-xs text-muted-foreground">Core metadata and trigger scope.</p>
                </div>
                <Switch
                  checked={meta.is_active}
                  onCheckedChange={(checked) => {
                    setMeta((current) => ({ ...current, is_active: checked }));
                    setIsDirty(true);
                  }}
                  disabled={isReadOnlyMobile}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={meta.name}
                    onChange={(event) => {
                      setMeta((current) => ({ ...current, name: event.target.value }));
                      setIsDirty(true);
                    }}
                    placeholder="Automation name"
                    disabled={isReadOnlyMobile}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={meta.description}
                    onChange={(event) => {
                      setMeta((current) => ({ ...current, description: event.target.value }));
                      setIsDirty(true);
                    }}
                    rows={4}
                    placeholder="Summarize what this workflow should do"
                    disabled={isReadOnlyMobile}
                  />
                </div>
                <div>
                  <Label>Ownership Scope</Label>
                  <Select
                    value={meta.scope}
                    onValueChange={(value) => {
                      setMeta((current) => ({ ...current, scope: value as AutomationRule['scope'] }));
                      setIsDirty(true);
                    }}
                    disabled={isReadOnlyMobile || meta.is_system_locked}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">Global</SelectItem>
                      <SelectItem value="ACCOUNT">Account</SelectItem>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="SYSTEM">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-dashed p-3 text-xs text-muted-foreground">
                  {meta.is_system_locked
                    ? 'This workflow is a required system automation. You can tune node details, but the core graph shape stays protected in v1.'
                    : 'Custom workflows can be expanded by adding nodes on the left, connecting branches in the canvas, and configuring the selected node on the right.'}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Node Palette</h2>
                  <p className="text-xs text-muted-foreground">Add new workflow steps.</p>
                </div>
                <GitBranch className="h-4 w-4 text-muted-foreground" />
              </div>
              {isReadOnlyMobile ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Mobile uses viewer mode for the workflow canvas. Open this page on desktop or tablet to edit the graph.
                </div>
              ) : (
                <div className="grid gap-2">
                  {nodeTypesPalette.map((paletteItem) => (
                    <Button
                      key={paletteItem.type}
                      variant="outline"
                      className="justify-start"
                      onClick={() => handleAddNode(paletteItem.type)}
                      disabled={isStructureLocked}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {paletteItem.label}
                    </Button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="font-semibold">Simple Summary</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A quick readout for teammates who prefer a linear overview.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Entry</div>
                  <div className="mt-1 font-medium">{triggerLabels[triggerType] || triggerType}</div>
                </div>
                <div className="rounded-2xl border p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Graph Mix</div>
                  <div className="mt-1 text-muted-foreground">
                    {summary.conditionCount} conditions, {summary.waitCount} waits, {summary.actionCount} actions.
                  </div>
                </div>
                <div className="rounded-2xl border p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Data Variables</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableVariables.slice(0, 4).map((variable) => (
                      <Badge key={variable} variant="secondary">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="min-h-[540px] overflow-hidden p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">Workflow Canvas</h2>
                <p className="text-xs text-muted-foreground">
                  Connect nodes to build the live automation path.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && <Badge className="bg-amber-100 text-amber-800">Unsaved changes</Badge>}
                {validationState?.valid && <Badge className="bg-emerald-100 text-emerald-800">Ready</Badge>}
              </div>
            </div>
            <div className="h-[540px] bg-slate-50/50">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={canvasNodeTypes}
                fitView
                nodesDraggable={!isReadOnlyMobile}
                nodesConnectable={!isReadOnlyMobile && !isStructureLocked}
                elementsSelectable
                onInit={(instance) => {
                  flowRef.current = instance;
                }}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onMoveEnd={(_, viewport) => setFlowViewport(viewport)}
                deleteKeyCode={isReadOnlyMobile || isStructureLocked ? [] : ['Backspace', 'Delete']}
              >
                <MiniMap zoomable pannable />
                <Controls />
                <Background gap={16} size={1} />
              </ReactFlow>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Node Inspector</h2>
                  <p className="text-xs text-muted-foreground">
                    Configure the selected node and review its validation state.
                  </p>
                </div>
                {selectedRawNode && !String(selectedRawNode.type).startsWith('trigger.') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSelectedNode}
                    disabled={isReadOnlyMobile || isStructureLocked}
                  >
                    Remove
                  </Button>
                )}
              </div>

              {!selectedRawNode ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Select a node from the canvas to configure it.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border p-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Selected</div>
                    <div className="mt-1 font-medium">{selectedRawNode.id}</div>
                    <div className="text-sm text-muted-foreground">
                      {getNodePresentation(selectedRawNode, currentAutomation ?? undefined).label}
                    </div>
                  </div>

                  {selectedRawNode.type === 'trigger.event' && (
                    <div className="space-y-4">
                      <div>
                        <Label>Trigger Event</Label>
                        <Select
                          value={selectedRawNode.config?.triggerType || 'SHOOT_BOOKED'}
                          onValueChange={(value) =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                triggerType: value,
                              },
                            }))
                          }
                          disabled={isReadOnlyMobile}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {triggerGroups.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel>{group.label}</SelectLabel>
                                {group.triggers.map((trigger) => (
                                  <SelectItem key={trigger} value={trigger}>
                                    {triggerLabels[trigger] || trigger}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedRawNode.type === 'trigger.schedule' && (
                    <div className="space-y-4">
                      <div>
                        <Label>Scheduled Trigger Type</Label>
                        <Select
                          value={selectedRawNode.config?.triggerType || 'WEEKLY_AUTOMATED_INVOICING'}
                          onValueChange={(value) =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                triggerType: value,
                              },
                            }))
                          }
                          disabled={isReadOnlyMobile || meta.is_system_locked}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {scheduleTriggerTypes.map((trigger) => (
                              <SelectItem key={trigger} value={trigger}>
                                {triggerLabels[trigger]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Day</Label>
                          <Select
                            value={String(selectedRawNode.config?.schedule?.day_of_week ?? 1)}
                            onValueChange={(value) =>
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  schedule: {
                                    ...(node.config?.schedule ?? {}),
                                    type: 'weekly',
                                    day_of_week: Number(value),
                                  },
                                },
                              }))
                            }
                            disabled={isReadOnlyMobile || meta.is_system_locked}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {weekdayOptions.map((day) => (
                                <SelectItem key={day.value} value={day.value}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Time</Label>
                          <Input
                            type="time"
                            value={selectedRawNode.config?.schedule?.time || '01:00'}
                            onChange={(event) =>
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  schedule: {
                                    ...(node.config?.schedule ?? {}),
                                    type: 'weekly',
                                    time: event.target.value,
                                  },
                                },
                              }))
                            }
                            disabled={isReadOnlyMobile || meta.is_system_locked}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRawNode.type === 'condition.if' && (
                    <div className="space-y-4">
                      <div>
                        <Label>Match Logic</Label>
                        <Select
                          value={selectedRawNode.config?.match || 'all'}
                          onValueChange={(value) =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                match: value,
                              },
                            }))
                          }
                          disabled={isReadOnlyMobile}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All rules must pass</SelectItem>
                            <SelectItem value="any">Any rule can pass</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        {(selectedRawNode.config?.rules ?? []).map((rule: any, index: number) => (
                          <div key={`${selectedRawNode.id}-rule-${index}`} className="rounded-2xl border p-3">
                            <div className="grid gap-3">
                              <div>
                                <Label>Context Field</Label>
                                <Input
                                  value={rule.field || ''}
                                  onChange={(event) => {
                                    const nextRules = [...(selectedRawNode.config?.rules ?? [])];
                                    nextRules[index] = { ...nextRules[index], field: event.target.value };
                                    updateNode(selectedRawNode.id, (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        rules: nextRules,
                                      },
                                    }));
                                  }}
                                  placeholder="status or client.name"
                                  disabled={isReadOnlyMobile}
                                />
                              </div>
                              <div>
                                <Label>Operator</Label>
                                <Select
                                  value={rule.operator || 'eq'}
                                  onValueChange={(value) => {
                                    const nextRules = [...(selectedRawNode.config?.rules ?? [])];
                                    nextRules[index] = { ...nextRules[index], operator: value };
                                    updateNode(selectedRawNode.id, (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        rules: nextRules,
                                      },
                                    }));
                                  }}
                                  disabled={isReadOnlyMobile}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ruleOperatorOptions.map((operator) => (
                                      <SelectItem key={operator.value} value={operator.value}>
                                        {operator.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Expected Value</Label>
                                <Input
                                  value={rule.value ?? ''}
                                  onChange={(event) => {
                                    const nextRules = [...(selectedRawNode.config?.rules ?? [])];
                                    nextRules[index] = { ...nextRules[index], value: event.target.value };
                                    updateNode(selectedRawNode.id, (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        rules: nextRules,
                                      },
                                    }));
                                  }}
                                  placeholder="scheduled"
                                  disabled={isReadOnlyMobile}
                                />
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const nextRules = [...(selectedRawNode.config?.rules ?? [])];
                                  nextRules.splice(index, 1);
                                  updateNode(selectedRawNode.id, (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      rules: nextRules,
                                    },
                                  }));
                                }}
                                disabled={isReadOnlyMobile}
                              >
                                Remove rule
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                rules: [
                                  ...(node.config?.rules ?? []),
                                  { field: '', operator: 'eq', value: '' },
                                ],
                              },
                            }))
                          }
                          disabled={isReadOnlyMobile}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Rule
                        </Button>
                        <div className="rounded-2xl border border-dashed p-3 text-xs text-muted-foreground">
                          Condition nodes need both a <strong>true</strong> and a <strong>false</strong> branch connected from the bottom handles.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRawNode.type === 'wait.duration' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          min="1"
                          value={selectedRawNode.config?.amount ?? 30}
                          onChange={(event) =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                amount: Number(event.target.value),
                              },
                            }))
                          }
                          disabled={isReadOnlyMobile}
                        />
                      </div>
                      <div>
                        <Label>Unit</Label>
                        <Select
                          value={selectedRawNode.config?.unit || 'minutes'}
                          onValueChange={(value) =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                unit: value,
                              },
                            }))
                          }
                          disabled={isReadOnlyMobile}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedRawNode.type === 'wait.datetime_offset' && (
                    <div className="space-y-4">
                      <div>
                        <Label>Reference Field</Label>
                        <Input
                          value={selectedRawNode.config?.referenceField || 'shoot_datetime'}
                          onChange={(event) =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                referenceField: event.target.value,
                              },
                            }))
                          }
                          placeholder="shoot_datetime"
                          disabled={isReadOnlyMobile}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <Label>Direction</Label>
                          <Select
                            value={selectedRawNode.config?.direction || 'before'}
                            onValueChange={(value) =>
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  direction: value,
                                },
                              }))
                            }
                            disabled={isReadOnlyMobile}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="before">Before</SelectItem>
                              <SelectItem value="after">After</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            min="1"
                            value={selectedRawNode.config?.amount ?? 24}
                            onChange={(event) =>
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  amount: Number(event.target.value),
                                },
                              }))
                            }
                            disabled={isReadOnlyMobile}
                          />
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Select
                            value={selectedRawNode.config?.unit || 'hours'}
                            onValueChange={(value) =>
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  unit: value,
                                },
                              }))
                            }
                            disabled={isReadOnlyMobile}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minutes">Minutes</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="days">Days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
 
                  {(selectedRawNode.type === 'action.email' || selectedRawNode.type === 'action.sms' || selectedRawNode.type === 'action.internal_notification') && (
                    <div className="space-y-4">
                      <div>
                        <Label>Recipient Source</Label>
                        <Select
                          value={selectedRawNode.config?.recipientMode || 'automation_default'}
                          onValueChange={(value) =>
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                recipientMode: value,
                              },
                            }))
                          }
                          disabled={isReadOnlyMobile}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="automation_default">Use automation default roles</SelectItem>
                            <SelectItem value="roles">Choose roles here</SelectItem>
                            <SelectItem value="context">Use a contact from workflow context</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedRawNode.config?.recipientMode === 'roles' && (
                        <div className="space-y-2">
                          <Label>Recipient Roles</Label>
                          {recipientRoleOptions.map((role) => (
                            <div key={`${selectedRawNode.id}-${role.value}`} className="flex items-center gap-2">
                              <Checkbox
                                checked={Array.isArray(selectedRawNode.config?.recipientRoles) && selectedRawNode.config.recipientRoles.includes(role.value)}
                                onCheckedChange={(checked) => {
                                  const nextRoles = new Set(selectedRawNode.config?.recipientRoles ?? []);
                                  if (checked) {
                                    nextRoles.add(role.value);
                                  } else {
                                    nextRoles.delete(role.value);
                                  }
                                  updateNode(selectedRawNode.id, (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      recipientRoles: Array.from(nextRoles),
                                    },
                                  }));
                                }}
                                disabled={isReadOnlyMobile}
                              />
                              <Label>{role.label}</Label>
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedRawNode.config?.recipientMode === 'context' && (
                        <div>
                          <Label>Context Contact</Label>
                          <Select
                            value={selectedRawNode.config?.contextKey || 'client'}
                            onValueChange={(value) =>
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  contextKey: value,
                                },
                              }))
                            }
                            disabled={isReadOnlyMobile}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {contextRecipientOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedRawNode.type === 'action.email' && (
                        <>
                          <div>
                            <Label>Email Template</Label>
                            <Select
                              value={selectedRawNode.config?.templateId ? String(selectedRawNode.config.templateId) : 'none'}
                              onValueChange={(value) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    templateId: value === 'none' ? null : Number(value),
                                  },
                                }))
                              }
                              disabled={isReadOnlyMobile}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Inline email only</SelectItem>
                                {emailTemplates.map((template) => (
                                  <SelectItem key={template.id} value={String(template.id)}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Email Channel</Label>
                            <Select
                              value={selectedRawNode.config?.channelId ? String(selectedRawNode.config.channelId) : 'default'}
                              onValueChange={(value) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    channelId: value === 'default' ? null : Number(value),
                                  },
                                }))
                              }
                              disabled={isReadOnlyMobile}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Use default channel</SelectItem>
                                {emailChannels.map((channel) => (
                                  <SelectItem key={channel.id} value={String(channel.id)}>
                                    {channel.display_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Subject</Label>
                            <Input
                              value={selectedRawNode.config?.subject || ''}
                              onChange={(event) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    subject: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Optional if template handles the subject"
                              disabled={isReadOnlyMobile}
                            />
                          </div>
                          <div>
                            <Label>HTML Body</Label>
                            <Textarea
                              value={selectedRawNode.config?.bodyHtml || ''}
                              onChange={(event) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    bodyHtml: event.target.value,
                                  },
                                }))
                              }
                              rows={5}
                              placeholder="<p>Hello {{client.name}}</p>"
                              disabled={isReadOnlyMobile}
                            />
                          </div>
                          <div>
                            <Label>Plain Text Body</Label>
                            <Textarea
                              value={selectedRawNode.config?.bodyText || ''}
                              onChange={(event) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    bodyText: event.target.value,
                                  },
                                }))
                              }
                              rows={4}
                              placeholder="Hello {{client.name}}"
                              disabled={isReadOnlyMobile}
                            />
                          </div>
                        </>
                      )}

                      {selectedRawNode.type === 'action.sms' && (
                        <>
                          <div>
                            <Label>SMS Template</Label>
                            <Select
                              value={selectedRawNode.config?.templateId ? String(selectedRawNode.config.templateId) : 'none'}
                              onValueChange={(value) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    templateId: value === 'none' ? null : Number(value),
                                  },
                                }))
                              }
                              disabled={isReadOnlyMobile}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Inline SMS only</SelectItem>
                                {smsTemplates.map((template) => (
                                  <SelectItem key={template.id} value={String(template.id)}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>SMS Body</Label>
                            <Textarea
                              value={selectedRawNode.config?.bodyText || ''}
                              onChange={(event) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    bodyText: event.target.value,
                                  },
                                }))
                              }
                              rows={4}
                              placeholder="Your shoot is tomorrow at {{shoot_datetime}}"
                              disabled={isReadOnlyMobile}
                            />
                          </div>
                        </>
                      )}

                      {selectedRawNode.type === 'action.internal_notification' && (
                        <>
                          <div>
                            <Label>Notification Title</Label>
                            <Input
                              value={selectedRawNode.config?.title || ''}
                              onChange={(event) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    title: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Review payment issue"
                              disabled={isReadOnlyMobile}
                            />
                          </div>
                          <div>
                            <Label>Message Body</Label>
                            <Textarea
                              value={selectedRawNode.config?.body || ''}
                              onChange={(event) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    body: event.target.value,
                                  },
                                }))
                              }
                              rows={4}
                              placeholder="Take action for {{shoot_address}}"
                              disabled={isReadOnlyMobile}
                            />
                          </div>
                          <div>
                            <Label>Destination Link</Label>
                            <Input
                              value={selectedRawNode.config?.destinationUrl || ''}
                              onChange={(event) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    destinationUrl: event.target.value,
                                  },
                                }))
                              }
                              placeholder="/shoot-history"
                              disabled={isReadOnlyMobile}
                            />
                          </div>
                          <div>
                            <Label>Priority</Label>
                            <Select
                              value={selectedRawNode.config?.priority || 'normal'}
                              onValueChange={(value) =>
                                updateNode(selectedRawNode.id, (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    priority: value,
                                  },
                                }))
                              }
                              disabled={isReadOnlyMobile}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {selectedRawNode.type === 'end' && (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      End nodes terminate a branch cleanly. Use them after optional paths or to satisfy a condition branch that should stop.
                    </div>
                  )}

                  <div className="rounded-2xl border p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Allowed Variables</div>
                    <div className="flex flex-wrap gap-2">
                      {availableVariables.map((variable) => (
                        <Badge key={`${selectedRawNode.id}-${variable}`} variant="secondary">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Recent Runs</h2>
                  <p className="text-xs text-muted-foreground">Execution health for this workflow.</p>
                </div>
                <Clock3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-3">
                {(automationQuery.data?.recent_runs ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                    No execution history yet.
                  </div>
                ) : (
                  (automationQuery.data?.recent_runs ?? []).slice(0, 5).map((run) => (
                    <div key={run.id} className="rounded-2xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">Run #{run.id}</div>
                        <Badge
                          className={
                            run.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : run.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : run.status === 'waiting'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                          }
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Started {formatDateTime(run.started_at)}
                      </div>
                      {run.error_message && (
                        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          {run.error_message}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        <Card className="p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {validationState?.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                <h2 className="font-semibold">Validation</h2>
              </div>
              {validationState ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Nodes</div>
                      <div className="mt-1 text-xl font-semibold">{validationState.summary.node_count}</div>
                    </div>
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Edges</div>
                      <div className="mt-1 text-xl font-semibold">{validationState.summary.edge_count}</div>
                    </div>
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Reachable Actions</div>
                      <div className="mt-1 text-xl font-semibold">{validationState.summary.reachable_action_count}</div>
                    </div>
                  </div>

                  {validationState.errors.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="mb-2 font-medium">Workflow issues</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {validationState.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Run validation to inspect graph health and node completeness.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Simulation Trace</h2>
              </div>
              {!simulationResult?.trace ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Save the workflow, then run a simulation to preview the path and recipients.
                </div>
              ) : (
                <div className="space-y-3">
                  {simulationResult.trace.map((entry: any, index: number) => (
                    <div key={`${entry.node_id}-${index}`} className="rounded-2xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{entry.node_type}</div>
                        <Badge variant="secondary">{entry.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">Node: {entry.node_id}</div>
                      {entry.branch && (
                        <div className="mt-2 text-xs text-muted-foreground">Branch: {entry.branch}</div>
                      )}
                      {entry.scheduled_for && (
                        <div className="mt-2 text-xs text-muted-foreground">Scheduled for: {formatDateTime(entry.scheduled_for)}</div>
                      )}
                      {Array.isArray(entry.preview_recipients) && entry.preview_recipients.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Recipients: {entry.preview_recipients.map((recipient: any) => recipient.email || recipient.phone).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

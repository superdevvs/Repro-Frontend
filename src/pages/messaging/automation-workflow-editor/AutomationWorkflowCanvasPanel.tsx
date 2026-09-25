import { Background, Controls, MiniMap, ReactFlow, type Connection, type Edge, type EdgeChange, type NodeChange, type NodeTypes, type ReactFlowInstance, type Viewport } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { AutomationFlowEdge, AutomationFlowNode } from '@/components/messaging/automations/automationWorkflowTypes';

interface AutomationWorkflowCanvasPanelProps {
  nodes: AutomationFlowNode[];
  edges: AutomationFlowEdge[];
  nodeTypes: NodeTypes;
  isReadOnlyMobile: boolean;
  isStructureLocked: boolean;
  isDirty: boolean;
  validationValid: boolean;
  onInit: (instance: ReactFlowInstance) => void;
  onNodeClick: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange<AutomationFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onMoveEnd: (viewport: Viewport) => void;
}

export function AutomationWorkflowCanvasPanel({
  nodes,
  edges,
  nodeTypes,
  isReadOnlyMobile,
  isStructureLocked,
  isDirty,
  validationValid,
  onInit,
  onNodeClick,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onMoveEnd,
}: AutomationWorkflowCanvasPanelProps) {
  return (
    <Card className="flex h-full min-h-[480px] flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-sm text-muted-foreground">
          {isReadOnlyMobile ? 'Viewing the path. Edit it on a larger screen.' : 'Select a step to change it.'}
        </p>
        <div className="flex items-center gap-2">
          {isDirty && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">Unsaved</Badge>}
          {validationValid && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">Ready</Badge>}
        </div>
      </div>
      <div className="automation-canvas min-h-[420px] flex-1 bg-background">
        <ReactFlow<AutomationFlowNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={!isReadOnlyMobile}
          nodesConnectable={!isReadOnlyMobile && !isStructureLocked}
          elementsSelectable
          onInit={onInit}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={(_, viewport) => onMoveEnd(viewport)}
          deleteKeyCode={isReadOnlyMobile || isStructureLocked ? [] : ['Backspace', 'Delete']}
        >
          <MiniMap zoomable pannable />
          <Controls />
          <Background gap={16} size={1} />
        </ReactFlow>
      </div>
    </Card>
  );
}

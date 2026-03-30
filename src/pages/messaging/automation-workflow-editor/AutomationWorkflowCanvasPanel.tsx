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
    <Card className="min-h-[540px] overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Workflow Canvas</h2>
          <p className="text-xs text-muted-foreground">Connect nodes to build the live automation path.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && <Badge className="bg-amber-100 text-amber-800">Unsaved changes</Badge>}
          {validationValid && <Badge className="bg-emerald-100 text-emerald-800">Ready</Badge>}
        </div>
      </div>
      <div className="h-[540px] bg-slate-50/50">
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

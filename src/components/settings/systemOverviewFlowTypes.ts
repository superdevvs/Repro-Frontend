import type { Node } from '@xyflow/react';

export type FlowNodeData = {
  id: string;
  label: string;
  kind: 'domain' | 'page' | 'component' | 'api' | 'service' | 'external';
  domain: string;
  description?: string;
  activeUsers?: number;
  requests?: number;
  errors?: number;
  avgDurationMs?: number;
  routePath?: string;
  componentName?: string;
  apiPath?: string;
  serviceName?: string;
  externalName?: string;
};

export type FlowNode = Node<FlowNodeData, 'overviewNode'>;


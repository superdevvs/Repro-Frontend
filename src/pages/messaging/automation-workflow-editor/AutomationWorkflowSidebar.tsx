import { GitBranch, Plus } from 'lucide-react';
import { triggerLabels } from '@/components/messaging/automations/workflow-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { WorkflowNodeType } from '@/types/messaging';
import type { AutomationEditorMeta, WorkflowSummary } from './helpers';

interface AutomationWorkflowSidebarProps {
  meta: AutomationEditorMeta;
  triggerType: string;
  summary: WorkflowSummary;
  availableVariables: string[];
  isReadOnlyMobile: boolean;
  isStructureLocked: boolean;
  onMetaChange: (updater: (current: AutomationEditorMeta) => AutomationEditorMeta) => void;
  onAddNode: (type: WorkflowNodeType) => void;
  nodePalette: Array<{ type: WorkflowNodeType; label: string }>;
}

export function AutomationWorkflowSidebar({
  meta,
  triggerType,
  summary,
  availableVariables,
  isReadOnlyMobile,
  isStructureLocked,
  onMetaChange,
  onAddNode,
  nodePalette,
}: AutomationWorkflowSidebarProps) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Workflow Details</h2>
            <p className="text-xs text-muted-foreground">Core metadata and trigger scope.</p>
          </div>
          <Switch
            checked={meta.is_active}
            onCheckedChange={(checked) => onMetaChange((current) => ({ ...current, is_active: checked }))}
            disabled={isReadOnlyMobile}
          />
        </div>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={meta.name}
              onChange={(event) => onMetaChange((current) => ({ ...current, name: event.target.value }))}
              placeholder="Automation name"
              disabled={isReadOnlyMobile}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={meta.description}
              onChange={(event) => onMetaChange((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              placeholder="Summarize what this workflow should do"
              disabled={isReadOnlyMobile}
            />
          </div>
          <div>
            <Label>Ownership Scope</Label>
            <Select
              value={meta.scope}
              onValueChange={(value) => onMetaChange((current) => ({ ...current, scope: value as AutomationEditorMeta['scope'] }))}
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
            {nodePalette.map((paletteItem) => (
              <Button
                key={paletteItem.type}
                variant="outline"
                className="justify-start"
                onClick={() => onAddNode(paletteItem.type)}
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
        <p className="mt-1 text-xs text-muted-foreground">A quick readout for teammates who prefer a linear overview.</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-2xl border p-3">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Entry</div>
            <div className="mt-1 font-medium">{triggerLabels[triggerType] || triggerType}</div>
          </div>
          <div className="rounded-2xl border p-3">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Graph Mix</div>
            <div className="mt-1 text-muted-foreground">{summary.conditionCount} conditions, {summary.waitCount} waits, {summary.actionCount} actions.</div>
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
  );
}

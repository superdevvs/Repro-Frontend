import { triggerLabels } from '@/components/messaging/automations/workflow-utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AutomationEditorMeta } from './helpers';

interface AutomationWorkflowSidebarProps {
  meta: AutomationEditorMeta;
  triggerType: string;
  availableVariables: string[];
  isReadOnlyMobile: boolean;
  onMetaChange: (updater: (current: AutomationEditorMeta) => AutomationEditorMeta) => void;
}

export function AutomationWorkflowSidebar({
  meta,
  triggerType,
  availableVariables,
  isReadOnlyMobile,
  onMetaChange,
}: AutomationWorkflowSidebarProps) {
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Workflow details</h2>
        <Switch
          checked={meta.is_active}
          onCheckedChange={(checked) => onMetaChange((current) => ({ ...current, is_active: checked }))}
          disabled={isReadOnlyMobile}
          aria-label={meta.is_active ? 'Pause automation' : 'Activate automation'}
        />
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="workflow-name">Name</Label>
          <Input
            id="workflow-name"
            value={meta.name}
            onChange={(event) => onMetaChange((current) => ({ ...current, name: event.target.value }))}
            placeholder="Automation name"
            disabled={isReadOnlyMobile}
          />
        </div>
        <div>
          <Label htmlFor="workflow-description">Description</Label>
          <Textarea
            id="workflow-description"
            value={meta.description}
            onChange={(event) => onMetaChange((current) => ({ ...current, description: event.target.value }))}
            rows={2}
            placeholder="What this workflow does"
            disabled={isReadOnlyMobile}
          />
        </div>
        <div>
          <Label>Scope</Label>
          <Select
            value={meta.scope}
            onValueChange={(value) => onMetaChange((current) => ({ ...current, scope: value as AutomationEditorMeta['scope'] }))}
            disabled={isReadOnlyMobile || meta.is_system_locked}
          >
            <SelectTrigger aria-label="Scope">
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
        <p className="text-xs text-muted-foreground">
          {meta.is_system_locked
            ? 'Required system automation. You can edit the message. Adding or removing steps stays off.'
            : `Starts when ${triggerLabels[triggerType] || triggerType}. Add steps from the bar under the graph.`}
        </p>
      </div>
      <div className="mt-auto pt-4">
        <h2 className="text-sm font-semibold">Values you can insert</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableVariables.length === 0 ? (
            <p className="text-xs text-muted-foreground">This trigger has no insert values yet.</p>
          ) : (
            availableVariables.map((variable) => (
              <Badge key={variable} variant="secondary">
                {`{{${variable}}}`}
              </Badge>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

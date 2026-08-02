import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateProject } from '@/hooks/useStudio';
import { cn } from '@/lib/utils';
import type {
  CreateProjectResult,
  StudioShootRef,
  Template,
  WorkflowId,
} from '@/services/studioService';

import { STUDIO_WORKFLOW_DESTINATIONS } from './destinations';
import { SectionError } from './feedback/StudioFeedback';
import { SourcePicker, type StudioSourceSelection } from './SourcePicker';
import { useOptionalStudioShell } from './StudioShell';
import {
  DEFAULT_WORKFLOW_UNAVAILABLE_REASON,
  resolveWorkflowAvailability,
  type WorkflowAvailabilityMap,
} from './workflowGalleryLogic';

export function launcherWorkflowIds(): WorkflowId[] {
  return STUDIO_WORKFLOW_DESTINATIONS.map((entry) => entry.workflowId as WorkflowId);
}

export interface ProjectLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWorkflowId?: WorkflowId | null;
  availability?: WorkflowAvailabilityMap;
  canLaunch?: boolean;
  template?: Template | null;
  initialShoot?: StudioShootRef | null;
  onCreated?: (result: CreateProjectResult) => void;
}

function mutationMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'The project could not be created.';
  const candidate = error as {
    response?: { data?: { message?: string; request_id?: string } };
    message?: string;
  };
  const message = candidate.response?.data?.message || candidate.message;
  const requestId = candidate.response?.data?.request_id;
  return [message, requestId ? `Request ${requestId}` : ''].filter(Boolean).join(' · ');
}

export function ProjectLauncher({
  open,
  onOpenChange,
  initialWorkflowId = null,
  availability,
  canLaunch = true,
  template = null,
  initialShoot = null,
  onCreated,
}: ProjectLauncherProps) {
  const shell = useOptionalStudioShell();
  const create = useCreateProject();
  const [workflowId, setWorkflowId] = useState<WorkflowId | null>(initialWorkflowId);
  const [source, setSource] = useState<StudioSourceSelection | null>(null);

  useEffect(() => {
    if (open) {
      setWorkflowId(initialWorkflowId);
      setSource(
        initialShoot
          ? { sourceType: 'shoot', shoot: initialShoot, fileIds: [] }
          : null,
      );
      create.reset();
    }
    // The mutation instance is intentionally excluded; resetting on every render
    // would erase a server error the user needs to recover from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShoot, initialWorkflowId, open]);

  const selected = useMemo(
    () => STUDIO_WORKFLOW_DESTINATIONS.find((entry) => entry.workflowId === workflowId),
    [workflowId],
  );

  const submit = async () => {
    if (!workflowId || !source) return;
    const result = await create.submit({
      submissionId: `launcher:${workflowId}`,
      input:
        source.sourceType === 'shoot'
          ? {
              workflowId,
              sourceType: 'shoot',
              shootId: source.shoot?.id,
              fileIds: source.fileIds,
              address: source.shoot?.address ?? undefined,
              templateId: template?.id ?? null,
              workflowConfig: template?.config,
            }
          : {
              workflowId,
              sourceType: 'upload',
              mediaRefs: (source.uploads ?? []).map((upload) => upload.mediaRef),
              templateId: template?.id ?? null,
              workflowConfig: template?.config,
            },
    });
    if (!result) return;
    onCreated?.(result);
    shell?.openDeepLink(result.deepLink);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            New AI Project
          </DialogTitle>
          <DialogDescription>
            {selected
              ? `Choose source media for ${selected.label}.`
              : 'Choose one of the six Studio workflows.'}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STUDIO_WORKFLOW_DESTINATIONS.map((entry) => {
              const id = entry.workflowId as WorkflowId;
              const state = resolveWorkflowAvailability(id, {
                availability,
                canLaunch,
                fallbackReason: DEFAULT_WORKFLOW_UNAVAILABLE_REASON,
              });
              const Icon = entry.icon;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!state.available}
                  aria-disabled={!state.available}
                  aria-label={`Start ${entry.label}`}
                  className={cn(
                    'rounded-xl border border-border p-4 text-left transition-colors',
                    state.available
                      ? 'hover:border-primary/60 hover:bg-primary/10'
                      : 'cursor-not-allowed opacity-60',
                  )}
                  onClick={() => state.available && setWorkflowId(id)}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{entry.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.mediaType === 'video' ? 'Video' : 'Photo'}
                      </span>
                    </span>
                  </span>
                  {!state.available ? (
                    <span className="mt-3 block text-xs text-destructive">{state.reason}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setWorkflowId(null)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Choose another workflow
            </Button>
            <SourcePicker workflowId={workflowId!} value={source} onChange={setSource} />
            {create.isError ? (
              <SectionError
                title="Project creation failed"
                message={mutationMessage(create.error)}
                onRetry={() => void submit()}
              />
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!source || create.isPending}
                onClick={() => void submit()}
              >
                {create.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
                )}
                Create project
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProjectLauncher;

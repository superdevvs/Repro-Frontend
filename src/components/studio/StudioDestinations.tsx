import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Braces, FolderOpen, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  STUDIO_QUERY_KEYS,
  useStudioBrand,
  useStudioProject,
  useStudioProjects,
  useStudioTemplates,
} from '@/hooks/useStudio';
import { resolveStudioAssetPath } from '@/lib/studioAssets';
import { cn } from '@/lib/utils';
import {
  studioService,
  type Template,
  type TemplateInput,
  type WorkflowId,
} from '@/services/studioService';

import { DEFAULT_STUDIO_DESTINATION, isStudioWorkflowId } from './destinations';
import {
  MutationSuccess,
  SectionError,
  SectionSkeleton,
  StatusBadge,
} from './feedback/StudioFeedback';
import { LiveQueue } from './LiveQueue';
import { MetricsStrip } from './MetricsStrip';
import { ProjectLauncher } from './ProjectLauncher';
import { StudioLanding } from './StudioLanding';
import { useStudioShell } from './StudioShell';
import type { RouteToCapability } from './types';

export function ProjectsDestination() {
  const shell = useStudioShell();
  const projects = useStudioProjects();
  const selectedId = shell.record?.recordType === 'project' ? shell.record.recordId : null;
  const detail = useStudioProject(selectedId);

  return (
    <section className="space-y-5" aria-labelledby="projects-destination-heading">
      <div>
        <h1 id="projects-destination-heading" className="text-xl font-semibold">Projects</h1>
        <p className="text-sm text-muted-foreground">Authorized Studio projects, ordered by latest activity.</p>
      </div>
      {projects.isLoading ? (
        <SectionSkeleton label="Loading Studio projects" rows={4} />
      ) : projects.isError ? (
        <SectionError title="Projects are unavailable" onRetry={() => projects.refetch()} />
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {(projects.data ?? []).map((project) => {
              const thumbnail = resolveStudioAssetPath(project.thumbnailRef);
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50',
                      selectedId === project.id && 'bg-primary/10',
                    )}
                    onClick={() => shell.openDeepLink(project.deepLink)}
                  >
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {thumbnail ? <img src={thumbnail} alt={`${project.name} thumbnail`} className="h-full w-full object-cover" /> : <FolderOpen className="m-auto mt-4 h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <StatusBadge status={project.latestStatus} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{project.latestWorkflow} · {project.mediaCount} media</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <aside className="rounded-xl border border-border bg-card p-5">
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">Select a project to inspect its media and jobs.</p>
            ) : detail.isLoading ? (
              <SectionSkeleton label="Loading project detail" rows={2} />
            ) : detail.isError || !detail.data ? (
              <SectionError title="Project detail is unavailable" onRetry={() => detail.refetch()} />
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="font-semibold">{detail.data.name}</h2>
                  <p className="text-sm text-muted-foreground">{detail.data.address ?? 'Uploaded media project'}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Workflow</dt><dd>{detail.data.latestWorkflow}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Media</dt><dd>{detail.data.mediaCount}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Version</dt><dd>{detail.data.version}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Status</dt><dd>{detail.data.latestStatus}</dd></div>
                </dl>
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</h3>
                  {detail.data.jobs.map((job) => (
                    <div key={`${job.jobType}-${job.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                      <span className="text-sm">{job.workflowTitle}</span>
                      <StatusBadge status={job.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function TemplateEditor({
  template,
  onCancel,
}: {
  template: Template | null;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name ?? '');
  const [workflowId, setWorkflowId] = useState<WorkflowId>(
    isStudioWorkflowId(template?.workflowId) ? template.workflowId : 'photo-enhancement',
  );
  const [config, setConfig] = useState(JSON.stringify(template?.config ?? {}, null, 2));
  const [validation, setValidation] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (input: TemplateInput) => studioService.saveTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.templates() });
      onCancel();
    },
  });
  const submit = () => {
    try {
      const parsed = JSON.parse(config);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
      setValidation(null);
      save.mutate({
        ...(template ? { id: template.id, version: template.version } : {}),
        name: name.trim(),
        workflowId,
        config: parsed,
      });
    } catch {
      setValidation('Configuration must be a valid JSON object.');
    }
  };
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" aria-label="Template name" />
      <select value={workflowId} onChange={(event) => setWorkflowId(event.target.value as WorkflowId)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" aria-label="Template workflow">
        {['photo-enhancement','twilight','video-cleanup','listing-video','reel-generator','batch-ai-jobs'].map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
      <Textarea value={config} onChange={(event) => setConfig(event.target.value)} rows={7} aria-label="Template configuration JSON" />
      {validation ? <p className="text-xs text-destructive">{validation}</p> : null}
      {save.isError ? <SectionError title="Template could not be saved" /> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={!name.trim() || save.isPending} onClick={submit}>
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save template
        </Button>
      </div>
    </div>
  );
}

export function TemplatesDestination({ canLaunch = true }: { canLaunch?: boolean }) {
  const queryClient = useQueryClient();
  const templates = useStudioTemplates();
  const [editing, setEditing] = useState<Template | 'new' | null>(null);
  const [launcherTemplate, setLauncherTemplate] = useState<Template | null>(null);
  const remove = useMutation({
    mutationFn: (template: Template) => studioService.deleteTemplate(template.id, template.version),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.templates() }),
  });
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div><h1 className="text-xl font-semibold">Templates</h1><p className="text-sm text-muted-foreground">Reusable, server-backed workflow settings.</p></div>
        <Button type="button" onClick={() => setEditing('new')}><Plus className="mr-1.5 h-4 w-4" />New template</Button>
      </div>
      {editing ? <TemplateEditor template={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} /> : null}
      {templates.isLoading ? <SectionSkeleton label="Loading templates" /> : templates.isError ? <SectionError title="Templates are unavailable" onRetry={() => templates.refetch()} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(templates.data ?? []).map((template) => (
            <article key={template.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-medium">{template.name}</h2><p className="text-xs text-muted-foreground">{template.workflowId} · v{template.version}</p></div><Braces className="h-4 w-4 text-muted-foreground" /></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => setLauncherTemplate(template)}>Use template</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(template)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
                <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(template)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {remove.isError ? <SectionError title="Template could not be deleted" /> : null}
      <ProjectLauncher
        open={Boolean(launcherTemplate)}
        onOpenChange={(open) => !open && setLauncherTemplate(null)}
        initialWorkflowId={isStudioWorkflowId(launcherTemplate?.workflowId) ? launcherTemplate.workflowId : null}
        template={launcherTemplate}
        canLaunch={canLaunch}
      />
    </section>
  );
}

export function BrandDestination() {
  const queryClient = useQueryClient();
  const brand = useStudioBrand();
  const [settings, setSettings] = useState('{}');
  const [validation, setValidation] = useState<string | null>(null);
  useEffect(() => {
    if (brand.data) setSettings(JSON.stringify(brand.data.settings, null, 2));
  }, [brand.data]);
  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => studioService.saveBrand({ settings: payload, version: brand.data?.version ?? 0 }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.brand() }),
  });
  const submit = () => {
    try {
      const parsed = JSON.parse(settings);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
      setValidation(null);
      save.mutate(parsed);
    } catch {
      setValidation('Brand settings must be a valid JSON object.');
    }
  };
  return (
    <section className="space-y-5">
      <div><h1 className="text-xl font-semibold">Brand</h1><p className="text-sm text-muted-foreground">Latest committed team brand state.</p></div>
      {brand.isLoading ? <SectionSkeleton label="Loading brand settings" rows={2} /> : brand.isError ? <SectionError title="Brand settings are unavailable" onRetry={() => brand.refetch()} /> : (
        <div className="max-w-3xl rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-medium">Brand configuration</p><span className="text-xs text-muted-foreground">Version {brand.data?.version ?? 0}</span></div>
          <Textarea value={settings} onChange={(event) => setSettings(event.target.value)} rows={14} className="font-mono text-xs" aria-label="Brand settings JSON" />
          {validation ? <p className="mt-2 text-xs text-destructive">{validation}</p> : null}
          {save.isError ? <SectionError className="mt-3" title="Brand settings could not be saved" /> : null}
          {save.isSuccess ? <MutationSuccess className="mt-3" message="Brand settings saved." /> : null}
          <div className="mt-4 flex justify-end"><Button type="button" disabled={save.isPending} onClick={submit}><Save className="mr-1.5 h-4 w-4" />Save brand</Button></div>
        </div>
      )}
    </section>
  );
}

export function StudioDestinationContent({
  routeToCapability,
  canUseAutoenhance,
  onUpgrade,
}: {
  routeToCapability: RouteToCapability;
  canUseAutoenhance: boolean;
  onUpgrade?: () => void;
}) {
  const shell = useStudioShell();
  if (shell.deepLinkStatus === 'error') {
    return <SectionError title="This Studio link could not be opened" message={shell.deepLinkError?.message} onRetry={shell.retryDeepLink} />;
  }
  if (shell.deepLinkStatus === 'resolving') return <SectionSkeleton label="Opening Studio link" rows={2} />;
  switch (shell.destination) {
    case 'projects': return <ProjectsDestination />;
    case 'queue': return <LiveQueue />;
    case 'metrics': return <MetricsStrip />;
    case 'templates': return <TemplatesDestination canLaunch={canUseAutoenhance} />;
    case 'brand': return <BrandDestination />;
    case DEFAULT_STUDIO_DESTINATION:
    default:
      return <StudioLanding routeToCapability={routeToCapability} canUseAutoenhance={canUseAutoenhance} onUpgrade={onUpgrade} />;
  }
}

export default StudioDestinationContent;


import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { inclusionCapabilities, INCLUSION_PRESETS, UPLOAD_LABELS, type ServiceInclusion, type UploadIntakeType } from './serviceInclusions';

interface Props {
  value?: ServiceInclusion[] | null;
  onChange: (value: ServiceInclusion[]) => void;
  currentIntake?: string;
}

export function ServiceInclusionsEditor({ value, onChange, currentIntake }: Props) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const section = useRef<HTMLElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const components = value ?? [];
  const intake = value == null ? (currentIntake ?? 'none') : inclusionCapabilities(components).upload_intake_type;
  const label = UPLOAD_LABELS[intake as UploadIntakeType] ?? UPLOAD_LABELS.none;
  const update = (index: number, change: Partial<ServiceInclusion>) => onChange(components.map((c, i) => i === index ? { ...c, ...change } : c));
  const add = (component: ServiceInclusion) => {
    pendingFocus.current = components.length;
    onChange([...components, { ...component }]);
    setAdding(false);
  };

  useEffect(() => {
    if (pendingFocus.current !== null) {
      section.current?.querySelector<HTMLInputElement>(`[data-service-name="${pendingFocus.current}"]`)?.focus();
      pendingFocus.current = null;
    }
  }, [components.length]);

  return <section ref={section} className="min-w-0 space-y-3 rounded-lg border p-3" aria-label="What's included?">
    <div>
      <h3 className="text-sm font-medium">What's included?</h3>
      <p className="text-xs text-muted-foreground">Add each part of this service or package, then choose what the photographer can upload.</p>
    </div>
    {components.map((component, index) => {
      const photo = ['photo', 'photo_video'].includes(component.upload_intake_type);
      const video = ['video', 'photo_video'].includes(component.upload_intake_type);
      const setUploads = (nextPhoto: boolean, nextVideo: boolean) => update(index, {
        upload_intake_type: nextPhoto ? (nextVideo ? 'photo_video' : 'photo') : (nextVideo ? 'video' : 'none'),
        uses_hdr_brackets: nextPhoto && component.uses_hdr_brackets,
      });

      return <div key={index} className="min-w-0 space-y-3 rounded-md bg-muted/40 p-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`${id}-name-${index}`} className="text-xs">Service {index + 1}</Label>
            <Input id={`${id}-name-${index}`} data-service-name={index} value={component.name} maxLength={120} placeholder="e.g., Interior photos"
              onChange={event => update(index, { name: event.target.value })} />
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0" aria-label={`Remove service ${index + 1}`}
            onClick={() => onChange(components.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
        </div>
        <fieldset className="min-w-0 space-y-1">
          <legend className="text-xs font-medium">Photographer can upload</legend>
          <div className="grid grid-cols-2 gap-2">
            <Label htmlFor={`${id}-photos-${index}`} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm">
              <Checkbox id={`${id}-photos-${index}`} checked={photo} onCheckedChange={checked => setUploads(checked === true, video)} />Photos
            </Label>
            <Label htmlFor={`${id}-videos-${index}`} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm">
              <Checkbox id={`${id}-videos-${index}`} checked={video} onCheckedChange={checked => setUploads(photo, checked === true)} />Videos
            </Label>
          </div>
          {!photo && !video && <p className="text-xs text-muted-foreground">No photo or video files needed for this service.</p>}
        </fieldset>
        {photo && <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-2 text-left text-xs text-muted-foreground">
            Photo options<ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pb-1">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <Label htmlFor={`${id}-hdr-${index}`} className="text-sm">Combine shots (HDR)</Label>
              <Switch id={`${id}-hdr-${index}`} aria-describedby={`${id}-hdr-help-${index}`} checked={component.uses_hdr_brackets}
                onCheckedChange={checked => update(index, { uses_hdr_brackets: checked })} />
            </div>
            <p id={`${id}-hdr-help-${index}`} className="text-xs text-muted-foreground">Use this when the photographer takes several shots of the same scene at different brightness levels to make one finished photo.</p>
          </CollapsibleContent>
        </Collapsible>}
      </div>;
    })}
    <Collapsible open={adding} onOpenChange={setAdding}>
      <CollapsibleTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={components.length >= 20}>
          <Plus className="mr-1 h-4 w-4" />Add a service
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Choose a common service. Its photo and video options are set for you.</p>
          <div className="grid gap-2 sm:grid-cols-2" aria-label="Common services">
            {INCLUSION_PRESETS.map(preset => <Button key={preset.name} type="button" variant="outline" size="sm"
              className="h-auto min-h-11 justify-start whitespace-normal px-3 py-2 text-left text-xs"
              disabled={components.length >= 20 || components.some(c => c.name.trim().toLowerCase() === preset.name.toLowerCase())}
              onClick={() => add(preset)}>{preset.name}</Button>)}
          </div>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={components.length >= 20}
            onClick={() => add({ name: '', upload_intake_type: 'none', uses_hdr_brackets: false })}>Add a custom service</Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
    <div className="rounded-md bg-primary/5 p-3 text-sm" role="status" aria-label="Upload summary">
      <p>Photographer uploads: <span className="font-medium">{label}</span></p>
      {value == null && <p className="mt-1 text-xs text-muted-foreground">Using the current settings. Add the included services to change them.</p>}
    </div>
    <p className="text-xs text-muted-foreground">Tour links and floor plans are added separately on the shoot page.</p>
  </section>;
}

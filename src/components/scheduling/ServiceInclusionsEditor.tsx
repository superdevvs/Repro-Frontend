import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inclusionCapabilities, INCLUSION_PRESETS, UPLOAD_LABELS, type ServiceInclusion, type UploadIntakeType } from './serviceInclusions';

interface Props {
  value?: ServiceInclusion[] | null;
  onChange: (value: ServiceInclusion[]) => void;
  currentIntake?: string;
}

export function ServiceInclusionsEditor({ value, onChange, currentIntake }: Props) {
  const id = useId();
  const components = value ?? [];
  const intake = value == null ? (currentIntake ?? 'none') : inclusionCapabilities(components).upload_intake_type;
  const label = UPLOAD_LABELS[intake as UploadIntakeType] ?? UPLOAD_LABELS.none;
  const update = (index: number, change: Partial<ServiceInclusion>) => onChange(components.map((c, i) => i === index ? { ...c, ...change } : c));

  return <section className="space-y-3 rounded-lg border p-3" aria-label="Included services and upload permissions">
    <div>
      <h3 className="text-sm font-medium">Included services & uploads</h3>
      <p className="text-xs text-muted-foreground">List what this service or package includes. Photo and video selections enable the matching shoot uploads.</p>
    </div>
    <div className="flex flex-wrap gap-1.5" aria-label="Common inclusions">
      {INCLUSION_PRESETS.map(preset => <Button key={preset.name} type="button" variant="outline" size="sm" className="h-auto whitespace-normal px-2 py-1 text-xs"
        disabled={components.length >= 20 || components.some(c => c.name.trim().toLowerCase() === preset.name.toLowerCase())}
        onClick={() => onChange([...components, { ...preset }])}>+ {preset.name}</Button>)}
    </div>
    {components.map((component, index) => <div key={index} className="space-y-2 rounded-md bg-muted/40 p-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${id}-name-${index}`} className="text-xs">Inclusion {index + 1}</Label>
          <Input id={`${id}-name-${index}`} value={component.name} maxLength={120} placeholder="e.g., Basic Social Video"
            onChange={event => update(index, { name: event.target.value })} />
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label={`Remove inclusion ${index + 1}`}
          onClick={() => onChange(components.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-upload-${index}`} className="text-xs">Camera uploads</Label>
        <Select value={component.upload_intake_type} onValueChange={(next: UploadIntakeType) => update(index, {
          upload_intake_type: next, uses_hdr_brackets: ['photo', 'photo_video'].includes(next) && component.uses_hdr_brackets,
        })}>
          <SelectTrigger id={`${id}-upload-${index}`}><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(UPLOAD_LABELS).map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {['photo', 'photo_video'].includes(component.upload_intake_type) && <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-hdr-${index}`} className="text-xs">HDR brackets for inclusion {index + 1}</Label>
        <Switch id={`${id}-hdr-${index}`} checked={component.uses_hdr_brackets} onCheckedChange={checked => update(index, { uses_hdr_brackets: checked })} />
      </div>}
    </div>)}
    <Button type="button" size="sm" variant="outline" disabled={components.length >= 20}
      onClick={() => onChange([...components, { name: '', upload_intake_type: 'none', uses_hdr_brackets: false }])}>
      <Plus className="mr-1 h-4 w-4" />Add inclusion
    </Button>
    <p className="text-sm font-medium" role="status" aria-label="Enabled uploads">{label}{value == null ? ' · inclusions not marked yet' : ''}</p>
    <p className="text-xs text-muted-foreground">Tour links, floor plans and digital edits use their existing tools. These settings control file types; assigned staff access stays the same.</p>
  </section>;
}

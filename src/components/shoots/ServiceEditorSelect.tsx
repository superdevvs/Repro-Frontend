import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ShootAssignee } from '@/services/shootAssignees';
import { editorsForServiceLane } from './serviceEditorEligibility';

type Props = {
  serviceName: string; value?: string; editors: ShootAssignee[]; onChange: (id: string) => void;
  loading?: boolean; error?: string;
  lane?: 'photo' | 'video';
};

export function ServiceEditorSelect({ serviceName, value, editors, onChange, loading, error, lane = 'photo' }: Props) {
  const eligibleEditors = editorsForServiceLane(editors, lane);
  const selectedEditor = editors.find(editor => editor.id === value);
  return <div className="min-w-0 space-y-1">
    <Select value={value || 'none'} onValueChange={id => onChange(id === 'none' ? '' : id)}>
      <SelectTrigger aria-label={`Editor for ${serviceName}`} className="h-8 min-w-0 text-xs">
        <SelectValue placeholder="Select editor" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No editor assigned</SelectItem>
        {value && !eligibleEditors.some(editor => editor.id === value) && <SelectItem value={value} disabled>{selectedEditor?.name || `Editor #${value}`} · review assignment</SelectItem>}
        {eligibleEditors.map(editor => <SelectItem key={editor.id} value={editor.id}>{editor.name}</SelectItem>)}
      </SelectContent>
    </Select>
    <p className="text-[10px] text-muted-foreground">{error || (loading ? 'Loading editors…' : `${lane === 'video' ? 'Video' : 'Photo'} editor · No photographer required`)}</p>
  </div>;
}

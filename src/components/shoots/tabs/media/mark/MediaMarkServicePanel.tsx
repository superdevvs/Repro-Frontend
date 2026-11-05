import { CalendarDays, Check, CornerDownRight, Layers3, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { AssignmentPreview } from '@/services/mediaMarkService';
import { assignmentBlocker } from '@/services/mediaMarkService';
import { getShootSchedule } from '@/utils/shootSchedule';
import { parseLocalYmd } from '@/utils/shootLocalDate';

export function MediaMarkServicePanel({ discovery, targetId, onChange, preview, previewing, count, historical, onHistorical, reason, onReason, historicalConfirmed, onHistoricalConfirm }: {
  discovery: AssignmentPreview | null; targetId: string; onChange: (id: string) => void;
  preview: AssignmentPreview | null; previewing: boolean; count: number;
  historical: boolean; onHistorical: (value: boolean) => void; reason: string; onReason: (value: string) => void;
  historicalConfirmed: boolean; onHistoricalConfirm: (value: boolean) => void;
}) {
  const [unit, setUnit] = useState('all');
  const targets = discovery?.targets ?? [];
  const origins = [...(discovery?.files ?? []).reduce((groups, file) => { const key = file.shoot_service_id == null ? 'unassigned' : String(file.shoot_service_id); groups.set(key, (groups.get(key) ?? 0) + 1); return groups; }, new Map<string, number>())];
  const units = [...new Map(targets.map(target => [String(target.unit_id ?? 'property'), target.unit_label || (target.unit_id ? `Unit ${target.unit_id}` : 'Property')])).entries()];
  return <div className="space-y-4">
    <div className="mark-panel-heading"><span className="mark-eyebrow">Connect files to work</span><h3>Assign the booked service</h3><p>Move {count} selected file{count === 1 ? '' : 's'} to the correct service. Original files and delivery history are preserved.</p></div>
    {origins.length > 0 && <div className="rounded-xl border border-border bg-muted/25 px-3 py-2.5"><p className="text-[10px] font-medium text-muted-foreground">Current assignment</p>{origins.map(([id, total]) => { const current = targets.find(target => String(target.id) === id); return <p key={id} className="mt-1 text-[11px] leading-relaxed"><strong className="font-medium">{total} file{total === 1 ? '' : 's'}</strong> · {id === 'unassigned' ? 'Unassigned' : current ? `${current.name}${current.unit_label ? ` · ${current.unit_label}` : ''}` : `Service #${id}`}</p>; })}</div>}
    {targets.some(target => target.historical) && <label className="mark-confirm"><input type="checkbox" checked={historical} onChange={event => onHistorical(event.target.checked)} /><span>Review original delivered services. Historical changes require a reason and a fresh receipt check.</span></label>}
    {units.length > 1 && <label className="mark-field">Unit<select value={unit} onChange={event => setUnit(event.target.value)}><option value="all">All units</option>{units.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
    <div className="space-y-2" role="radiogroup" aria-label="Booked service">
      {targets.filter(target => unit === 'all' || String(target.unit_id ?? 'property') === unit).map(target => {
        const disabled = target.assignable === false;
        const person = target.assignee_name || target.photographer?.name || target.editor?.name;
        const date = getShootSchedule({ scheduled_at: target.scheduled_at, timezone: target.timezone }).date;
        return <button key={target.id} type="button" role="radio" aria-label={`${target.name} ${target.unit_label || (target.unit_id ? `Unit ${target.unit_id}` : 'Property')}`} aria-checked={targetId === String(target.id)} disabled={disabled} className={`mark-option mark-service-option ${targetId === String(target.id) ? 'is-selected' : ''}`} onClick={() => onChange(String(target.id))}>
          <span className="mark-option-icon"><Layers3 /></span><span className="min-w-0 flex-1"><strong>{target.name}</strong><small>{target.unit_label || (target.unit_id ? `Unit ${target.unit_id}` : 'Property')} · Service #{target.id}</small>
            <span className="mark-service-meta">{person && <span><UserRound />{person}</span>}{date && <span><CalendarDays />{parseLocalYmd(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}</span>
            {target.accepted_types?.length ? <small>Accepts {target.accepted_types.join(', ')}</small> : null}
            {disabled && <small>{target.reason || 'This service is not available for assignment.'}</small>}
          </span><span className="mark-radio" />
        </button>;
      })}
    </div>
    {!targets.length && <p className="mark-notice">No compatible booked services are available. Review this shoot’s service plan.</p>}
    {targetId && <label className="mark-field">Reason for assignment{discovery?.files.some(file => file.shoot_service_id != null) ? ' (required)' : ' (optional)'}<textarea rows={2} maxLength={1000} value={reason} onChange={event => onReason(event.target.value)} placeholder="Explain the correction so the team can follow the history…" /></label>}
    {preview?.requires_historical_confirmation && <label className="mark-confirm"><input type="checkbox" checked={historicalConfirmed} onChange={event => onHistoricalConfirm(event.target.checked)} /><span>I confirm moving these {count} files from their delivered assignment to <strong>{targets.find(target => String(target.id) === targetId)?.name}</strong>. The reviewed delivery history will be checked again when I save.</span></label>}
    {targetId && <div className={`mark-assignment-preview ${preview?.can_apply ? 'is-ready' : ''}`} aria-live="polite"><CornerDownRight /><div><strong>{previewing ? 'Checking the selected files…' : preview?.can_apply ? 'Assignment ready' : 'Review compatibility'}</strong><p>{preview?.can_apply ? `${count} selected file${count === 1 ? '' : 's'} → ${targets.find(target => String(target.id) === targetId)?.name || 'the booked service'}` : 'Every selected file must be compatible with the target service.'}</p>{preview?.blockers?.map((blocker, index) => <p key={index}>{assignmentBlocker(blocker)}</p>)}</div>{preview?.can_apply && <Check />}</div>}
  </div>;
}

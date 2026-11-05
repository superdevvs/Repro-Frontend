import { AlertCircle, Check, CheckCircle2, ExternalLink, FileCheck2, FileText, Image, Link2, Video } from 'lucide-react';
import type { DeliveryMode, DeliveryPlan } from '@/services/mediaMarkService';
import { deliveryComponentSelectable } from '@/services/mediaMarkService';

const modes: Array<{ id: DeliveryMode; title: string; description: string; icon: typeof Image }> = [
  { id: 'media', title: 'Ready content', description: 'Release reviewed files', icon: FileCheck2 },
  { id: 'external', title: 'External delivery', description: 'Review provider output', icon: Link2 },
  { id: 'manual_no_content', title: 'Without content', description: 'Record a staff exception', icon: FileText },
];
const kindIcons = { photo: Image, video: Video, floorplan: FileText, tour: Link2, external: Link2, legacy: FileCheck2 };
export function MediaMarkDeliveryPanel({ plan, mode, onModeChange, selected, onSelect, reason, onReasonChange, confirmed, onConfirm }: {
  plan: DeliveryPlan; mode: DeliveryMode; onModeChange: (value: DeliveryMode) => void; selected: string[];
  onSelect: (id: string) => void; reason: string; onReasonChange: (value: string) => void; confirmed: boolean; onConfirm: (value: boolean) => void;
}) {
  const selectedComponents = plan.components.filter(component => selected.includes(component.id));
  return <div className="space-y-5">
    <div className="mark-panel-heading"><span className="mark-eyebrow">Review the remaining work</span><h3>Deliver exactly what’s ready</h3><p>{plan.summary || 'Each booked component is checked separately. Other unfinished work stays in progress.'}</p></div>
    <div className="mark-delivery-modes" role="radiogroup" aria-label="Delivery method">{modes.filter(item => item.id === 'manual_no_content' ? plan.capabilities.can_manual_no_content : plan.capabilities.can_finalize).map(item => <button key={item.id} type="button" role="radio" aria-checked={mode === item.id} className={`mark-mode ${mode === item.id ? 'is-selected' : ''}`} onClick={() => onModeChange(item.id)}><item.icon /><strong>{item.title}</strong><small>{item.description}</small></button>)}</div>
    <div className="mark-component-list">{plan.components.map(component => {
      const Icon = kindIcons[component.kind] ?? FileCheck2;
      const enabled = deliveryComponentSelectable(component, mode);
      return <div key={component.id} className={`mark-component ${selected.includes(component.id) ? 'is-selected' : ''}`}>
        <label><input type="checkbox" checked={selected.includes(component.id)} disabled={!enabled} onChange={() => onSelect(component.id)} aria-label={`${component.label} — ${component.service_name || `Service ${component.shoot_service_id}`}`} /><span className="mark-component-icon"><Icon /></span><span className="min-w-0 flex-1"><strong>{component.label}</strong><small>{component.service_name || `Service #${component.shoot_service_id}`}{component.unit_id ? ` · Unit ${component.unit_id}` : ''}</small></span><span className={`mark-status mark-status-${component.status}`}>{component.status === 'delivered' && <Check />} {component.status}</span></label>
        <div className="mark-component-detail"><span>{component.output_count ?? component.file_ids.length} {component.kind === 'video' ? 'video' : component.kind === 'photo' ? 'photo' : 'output'}{(component.output_count ?? component.file_ids.length) === 1 ? '' : 's'}</span>{component.reason && !component.resolved && <p><AlertCircle />{component.reason}</p>}
          {component.external_url && <a href={component.external_url} target="_blank" rel="noopener noreferrer">Review provider delivery <ExternalLink /></a>}
        </div>
      </div>;
    })}</div>
    {!plan.components.length && <div className="mark-empty"><CheckCircle2 /><h3>No outstanding delivery work</h3><p>There are no required components available for this shoot.</p></div>}
    {mode === 'external' && <div className="mark-manual"><p className="mark-notice">Open and review each selected provider destination before finalizing. A tour link does not automatically complete promised floorplans.</p><label className="mark-confirm"><input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} /><span>I reviewed the provider output for the selected components and confirm it is ready for delivery.</span></label></div>}
    {mode === 'manual_no_content' && <div className="mark-manual"><label className="mark-field">Reason for completion<textarea value={reason} onChange={event => onReasonChange(event.target.value)} rows={3} maxLength={2000} placeholder="Explain why this work is being completed without content…" /></label><label className="mark-confirm"><input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} /><span>I confirm completion without content for <strong>{selectedComponents.length ? selectedComponents.map(component => component.label).join(', ') : 'the selected components'}</strong>. Other unfinished work will remain pending.</span></label></div>}
  </div>;
}

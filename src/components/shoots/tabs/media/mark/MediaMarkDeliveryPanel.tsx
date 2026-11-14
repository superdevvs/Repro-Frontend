import { ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { DeliveryPlan } from '@/services/mediaMarkService';
import { automaticDeliveryMethod, deliveryServiceGroups } from './simpleDeliverySelection';

export function MediaMarkDeliveryPanel({ plan, withoutContent, onWithoutContentChange, selected, onSelect, reason, onReasonChange, disabled = false }: {
  plan: DeliveryPlan; withoutContent: boolean; onWithoutContentChange: (value: boolean) => void;
  selected: string[]; onSelect: (ids: string[], checked: boolean) => void;
  reason: string; onReasonChange: (value: string) => void; disabled?: boolean;
}) {
  const groups = deliveryServiceGroups(plan);
  const missing = plan.components.filter(component => selected.includes(component.id)
    && automaticDeliveryMethod(component, withoutContent) === 'defer');
  return <div className="simple-finalise">
    <div className="simple-finalise-columns"><span>Services</span><span>Status</span></div>
    <ul aria-label="Booked services" className="simple-finalise-services">
      {groups.map(group => {
        const eligible = group.components.filter(component => automaticDeliveryMethod(component, withoutContent)
          && plan.capabilities.can_finalize);
        const checked = eligible.length > 0 && eligible.every(component => selected.includes(component.id));
        const mixed = !checked && eligible.some(component => selected.includes(component.id));
        const statuses = group.components.map(component => component.status);
        const status = statuses.every(value => value === 'cancelled') ? 'cancelled'
          : group.components.every(component => component.resolved) ? 'delivered'
            : statuses.includes('ready') ? 'ready' : 'pending';
        return <li key={group.id} className="simple-finalise-service">
          <label className="simple-finalise-service-heading">
            <input type="checkbox" aria-label={`Select ${group.name}${group.unitId ? ` · Unit ${group.unitId}` : ''}`}
              ref={input => { if (input) input.indeterminate = mixed; }} checked={checked}
              disabled={disabled || eligible.length === 0} onChange={event => onSelect(eligible.map(component => component.id), event.target.checked)} />
            <span className="min-w-0 flex-1"><strong>{group.name}</strong>{group.unitId && <small>Unit {group.unitId}</small>}</span>
            <span className={`mark-status mark-status-${status}`}>{status}</span>
          </label>
          {group.components.map(component => {
            const method = automaticDeliveryMethod(component, withoutContent);
            return <div key={component.id} className="simple-finalise-component">
              {group.components.length > 1 && <label><input type="checkbox" aria-label={`Select ${component.label} — ${group.name}`}
                checked={selected.includes(component.id)} disabled={disabled || !method || !eligible.includes(component)}
                onChange={event => onSelect([component.id], event.target.checked)} /><span>{component.label}</span></label>}
              <span>{component.resolved ? (component.status === 'cancelled' ? 'Cancelled' : 'Delivered')
                : component.status !== 'ready' && (component.deferred || method === 'defer' && selected.includes(component.id)) ? 'Pending — deliver when ready'
                  : component.status === 'ready' ? component.file_ids.length ? `${component.output_count ?? component.file_ids.length} ${component.kind === 'photo' ? 'photos' : 'files'} ready` : 'Provider output ready'
                    : component.reason || 'Still being prepared'}</span>
              {component.external_url && /^https?:\/\//i.test(component.external_url) && !component.resolved
                && <a href={component.external_url} target="_blank" rel="noopener noreferrer">Review <ExternalLink className="h-3 w-3" /></a>}
            </div>;
          })}
        </li>;
      })}
    </ul>
    {!groups.length && <p className="mark-notice">No outstanding delivery work.</p>}
    {plan.capabilities.can_finalize && plan.components.some(component => component.status === 'pending' && !component.deferred && component.methods.includes('defer')) && <div className="simple-finalise-toggle">
      <div><label htmlFor="finalise-without-content">Finalise without waiting</label><p>Release ready content. Missing work stays pending.</p></div>
      <Switch id="finalise-without-content" checked={withoutContent} disabled={disabled} onCheckedChange={onWithoutContentChange} />
    </div>}
    {missing.length > 0 && <label className="mark-field">Reason for proceeding
      <textarea value={reason} disabled={disabled} onChange={event => onReasonChange(event.target.value)} rows={2} maxLength={2000}
        placeholder="Why are you finalising before this content is ready?" />
      <span className="text-xs text-muted-foreground">{missing.map(component => component.label).join(', ')} will stay pending. Provider content will update here when it is ready.</span>
    </label>}
    {plan.components.some(component => selected.includes(component.id) && automaticDeliveryMethod(component, withoutContent) === 'external')
      && <p className="mt-3 text-xs text-muted-foreground">Finalise confirms the selected provider output has been reviewed and is ready for delivery.</p>}
  </div>;
}

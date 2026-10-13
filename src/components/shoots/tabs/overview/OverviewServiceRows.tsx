import { format, parse } from 'date-fns';
import { useAuth } from '@/components/auth/AuthProvider';
import { useShootFiles } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';
import { getShootSchedule } from '@/utils/shootSchedule';
import { to12Hour } from '@/utils/availabilityUtils';
import { getShootMediaRequirements } from '../media/shootMediaRequirements';
import { canSeeServiceImageCounts, countServicePhotos } from './serviceImageCounts';
import { deriveRowStatuses, STATUS_DOT_CLASS } from './overviewServiceStatus';
import './OverviewServiceRows.css';

interface Props {
  shoot: ShootData;
  serviceItems: NormalizedShootServiceItem[];
  role?: string;
  isClient: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isAdmin?: boolean;
  formatServiceLabel: (service: unknown) => string;
  getReadonlyServiceDisplayPrice: (service: unknown) => string;
}

function ServiceSchedule({ item, timezone }: { item: NormalizedShootServiceItem; timezone?: string | null }) {
  const schedule = getShootSchedule({ scheduled_at: item.scheduledAt, timezone });
  const date = schedule.date ? parse(schedule.date, 'yyyy-MM-dd', new Date()) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const full = valid ? format(date, 'MMM d, yyyy') : 'Date unassigned';
  const short = valid ? format(date, date.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yy') : 'Date unassigned';
  const time = to12Hour(schedule.time ?? '') || 'Time unassigned';
  const compactTime = time.replace(':00', '');
  return <span className="service-row-schedule" title={`${full} · ${time}`} aria-label={`${full} · ${time}`}>
    <span className="service-row-schedule-full" aria-hidden="true">{full} · {time}</span>
    <span className="service-row-schedule-short" aria-hidden="true">{short} · {compactTime}</span>
  </span>;
}

export function OverviewServiceRows(props: Props) {
  const { user } = useAuth();
  const role = props.role ?? user?.role;
  const showCounts = canSeeServiceImageCounts(role, props.isClient);
  // Read the already server-scoped booking contract, independently of upload permissions.
  const requirements = getShootMediaRequirements(props.shoot, []);
  const hasPhotos = requirements.services.length > 0;
  const raw = useShootFiles(props.shoot.id, 'raw', { enabled: showCounts && hasPhotos });
  const edited = useShootFiles(props.shoot.id, 'edited', { enabled: showCounts && hasPhotos && !props.isPhotographer });
  const statuses = deriveRowStatuses(props.serviceItems);
  return <section className="overview-service-rows" aria-label="Booked services">
    <h3 className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Services</h3>
    {props.serviceItems.map(item => {
      const id = String(item.shootServiceId ?? '');
      const target = requirements.services.find(service => service.id === id);
      const linked = (props.shoot.reshootServiceLinks ?? props.shoot.reshoot_service_links ?? []).find(link =>
        String(link.reshootShootServiceId ?? link.reshoot_shoot_service_id ?? '') === id);
      const responsibility = item.source.reshootResponsibility ?? item.source.reshoot_responsibility ?? linked?.responsibility;
      const from = item.source.sourceServiceName ?? item.source.source_service_name
        ?? linked?.sourceService?.name ?? linked?.source_service?.name ?? linked?.sourceServiceName ?? linked?.source_service_name;
      const status = statuses.get(item.id) ?? 'unfinished';
      return <div key={item.id} className="overview-service-row" data-testid={`service-summary-${item.id}`}>
        <span data-testid="status-dot" data-status={status} aria-hidden="true" className={`service-row-status ${STATUS_DOT_CLASS[status]}`} />
        <div className="service-row-top">
          <div className="service-row-heading">
            <span className="service-row-name">{props.formatServiceLabel(item.source) || item.name}</span>
            <ServiceSchedule item={item} timezone={props.shoot.timezone} />
          </div>
          <span className="service-row-price" aria-label={`${props.isPhotographer || props.isEditor ? 'Pay' : 'Price'} ${props.getReadonlyServiceDisplayPrice(item.source)}`}>{props.getReadonlyServiceDisplayPrice(item.source)}</span>
        </div>
        <div className="service-row-bottom">
          <span className="service-row-person">{!props.isPhotographer && !props.isEditor ? item.photographerName || 'Unassigned' : null}</span>
          {showCounts && target && <div className="service-row-counts" aria-label="Image counts">
            <span><span className="service-count-label"><span className="service-count-required-full">Required</span><span className="service-count-required-short" aria-hidden="true">Req</span></span><strong>{target.finalCount ?? '—'}</strong></span>
            <span><span className="service-count-label">Raw</span><strong>{raw.data ? countServicePhotos(raw.data, id) : '—'}<span className="service-count-denominator">/{target.required ?? '—'}</span></strong></span>
            {!props.isPhotographer && <span><span className="service-count-label">Edited</span><strong>{edited.data ? countServicePhotos(edited.data, id) : '—'}<span className="service-count-denominator">/{target.finalCount ?? '—'}</span></strong></span>}
          </div>}
        </div>
        {props.isAdmin && responsibility && <p className="service-row-note text-amber-700 dark:text-amber-300">Reshoot responsibility: {String(responsibility).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}</p>}
        {from && <p className="service-row-note text-muted-foreground">From: {String(from)}</p>}
      </div>;
    })}
  </section>;
}

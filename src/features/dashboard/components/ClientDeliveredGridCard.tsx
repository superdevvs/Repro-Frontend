import { format } from 'date-fns';
import { Download, Ghost } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DeliverySpotlight } from '@/components/dashboard/v2/DeliverySpotlight';
import { useShootCardPhoto } from '@/hooks/useShootCardPhoto';
import { cn } from '@/lib/utils';
import { shootDataToSummary, type ClientShootRecord } from '@/utils/dashboardDerivedUtils';
import { getDashboardShootDisplayDate } from '@/utils/dashboardShootSchedule';
import { getClientDeliveredMedia } from '../utils';
import { ClientPaymentPill } from './ClientPaymentPill';

export const ClientDeliveredGridCard = ({ record, onSelect, onDownload }: {
  record: ClientShootRecord;
  onSelect: (record: ClientShootRecord) => void;
  onDownload: (record: ClientShootRecord) => void;
}) => {
  const summary = shootDataToSummary(record.data);
  const media = getClientDeliveredMedia(record.data);
  const { image, onImageError } = useShootCardPhoto(media.photos);
  const scheduledDate = getDashboardShootDisplayDate(summary);
  const dateLabel = scheduledDate ? format(scheduledDate, 'd MMM yyyy') : 'No date';

  return (
    <div
      data-shoot-id={record.data.id}
      className={cn('group relative rounded-xl overflow-hidden cursor-pointer border border-border hover:border-primary/40 transition-all hover:shadow-lg', !image && 'h-56')}
      onClick={() => onSelect(record)}
    >
      {image ? <>
        <img src={image} alt={summary.addressLine} className="w-full aspect-[4/3] object-cover transition-transform group-hover:scale-105" onError={onImageError} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </> : <DeliverySpotlight services={summary.services} />}
      {image && media.count > 0 && (
        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
          {media.count} photo{media.count !== 1 ? 's' : ''}
        </div>
      )}
      <button
        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(event) => { event.stopPropagation(); onDownload(record); }}
        title="Download"
      ><Download className="h-4 w-4" /></button>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="text-white font-semibold text-sm truncate">{summary.addressLine}</h3>
        <p className="text-white/70 text-[11px] mt-0.5">{dateLabel}</p>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="flex items-center gap-1.5">
            <Badge className="bg-green-500/30 text-green-300 border-green-500/40 text-[9px] h-4 px-1.5">
              <span className="w-1 h-1 rounded-full bg-green-400 mr-1" />DELIVERED
            </Badge>
            {record.data.isGhostVisibleForUser && <Badge className="bg-slate-900/55 text-slate-100 border-white/15 text-[9px] h-4 px-1.5">
              <Ghost className="mr-1 h-2.5 w-2.5" />GHOST
            </Badge>}
          </div>
          <ClientPaymentPill status={summary.paymentStatus ?? 'unpaid'} overlay />
        </div>
      </div>
    </div>
  );
};

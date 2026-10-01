import { ArrowRight, Images } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ClientDeliveryNotification } from '../hooks/useClientDeliveryNotifications';

interface ClientDeliveryBannerProps {
  latest: ClientDeliveryNotification;
  unseenCount: number;
  onOpen: () => void | Promise<void>;
}

export const ClientDeliveryBanner = ({
  latest,
  unseenCount,
  onOpen,
}: ClientDeliveryBannerProps) => (
  <section aria-label="New deliveries" className="!h-auto w-full self-start rounded-2xl border border-emerald-300/60 bg-gradient-to-br from-emerald-500/15 via-background to-emerald-400/5 px-3 py-2 text-foreground shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:max-w-[34rem]">
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 rounded-lg border border-current/15 bg-background/70 p-1.5 text-emerald-600 dark:text-emerald-400">
        <Images className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">
          {unseenCount} new {unseenCount === 1 ? 'delivery' : 'deliveries'}
        </p>
        <p title={latest.address} className="truncate text-[11px] leading-4 text-muted-foreground">
          Latest: {latest.address}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-7 shrink-0 rounded-full px-2.5 text-xs font-semibold"
        onClick={() => void onOpen()}
      >
        View delivery
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  </section>
);

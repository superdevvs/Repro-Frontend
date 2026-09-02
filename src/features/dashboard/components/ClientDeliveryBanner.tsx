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
  <section className="h-full w-full rounded-2xl border border-emerald-300/60 bg-gradient-to-br from-emerald-500/15 via-background to-emerald-400/5 px-3.5 py-3 text-foreground shadow-[0_12px_35px_rgba(15,23,42,0.07)] backdrop-blur-sm sm:max-w-[34rem]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 rounded-xl border border-current/15 bg-background/70 p-2 text-emerald-600 dark:text-emerald-400">
          <Images className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold tracking-tight">
            {unseenCount} new {unseenCount === 1 ? 'delivery' : 'deliveries'}
          </p>
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            Latest: {latest.address}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full px-3 text-xs font-semibold"
          onClick={() => void onOpen()}
        >
          View delivery
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </section>
);

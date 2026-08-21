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
  <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
        <Images className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {unseenCount} new {unseenCount === 1 ? 'delivery' : 'deliveries'}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          Latest: {latest.address}
        </p>
      </div>
    </div>
    <Button
      type="button"
      size="sm"
      className="gap-2"
      onClick={() => void onOpen()}
    >
      View delivery
      <ArrowRight className="h-4 w-4" />
    </Button>
  </div>
);

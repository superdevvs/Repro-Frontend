import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TravelNotifications } from '@/features/travel/TravelNotifications';
import { CompReshootCompensationSection } from '@/features/complimentary-reshoots/CompReshootCompensationSection';
import type { CompReshootBookingController } from '@/features/complimentary-reshoots/useCompReshootBooking';
import type { ServicePackage } from '@/pages/bookShootModel';

export function BookingReviewControls({ bypassPayment, setBypassPayment, sendNotification, setSendNotification, notificationControls, onBack,
  compReshoot, selectedServices, nominalServiceTotal, photographer, servicePhotographers, photographers }: {
  bypassPayment: boolean; setBypassPayment: (value: boolean) => void;
  sendNotification: boolean; setSendNotification: (value: boolean) => void;
  notificationControls?: React.ComponentProps<typeof TravelNotifications>; onBack: () => void;
  compReshoot?: CompReshootBookingController; selectedServices: ServicePackage[]; nominalServiceTotal: number;
  photographer: string; servicePhotographers: Record<string, string>; photographers: Array<{ id: string; name: string }>;
}) {
  const { user, isImpersonating } = useAuth();
  const staff = user?.role !== 'client' && !isImpersonating;
  return <div className="space-y-3">
    {compReshoot?.enabled && <CompReshootCompensationSection controller={compReshoot} selectedServices={selectedServices}
      nominalServiceTotal={nominalServiceTotal} photographerId={photographer} servicePhotographers={servicePhotographers} photographers={photographers} />}
    {staff && <section aria-label="Payment and notifications" className="rounded-xl border border-border p-3 space-y-3">
      {!compReshoot?.enabled && <div className="flex items-center justify-between gap-3">
        <div><Label htmlFor="bypass-payment">Bypass Payment</Label><p className="text-xs text-muted-foreground">Client will be invoiced later</p></div>
        <Switch id="bypass-payment" checked={bypassPayment} onCheckedChange={setBypassPayment} />
      </div>}
      {notificationControls ? <TravelNotifications {...notificationControls} /> : <div className="flex items-center justify-between gap-3">
        <Label htmlFor="send-notification">Notify client and photographer</Label><Switch id="send-notification" checked={sendNotification} onCheckedChange={setSendNotification} />
      </div>}
    </section>}
    {!staff && <p className="text-sm text-muted-foreground">Our team will review your requested schedule before confirming the shoot.</p>}
    <Button type="button" variant="outline" className="h-11 w-full" onClick={onBack}>Back</Button>
  </div>;
}

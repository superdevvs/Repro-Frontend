import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HoldNotificationFields } from '@/components/shoots/details/HoldNotificationFields';
import { useHoldNotifications } from '@/components/shoots/details/useHoldNotifications';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { HoldRequest, HoldRequestsState } from '@/features/dashboard/hooks/useHoldRequests';

export function HoldRequestsPanel({ requests }: { requests: HoldRequestsState }) {
  const [approval, setApproval] = useState<HoldRequest | null>(null);
  const notifications = useHoldNotifications(approval?.notificationShoot ?? null, Boolean(approval));
  if (requests.loading) return <p role="status" className="p-3 text-sm text-muted-foreground">Loading hold requests...</p>;
  if (requests.error) return (
    <div role="alert" className="space-y-2 p-3 text-sm">
      <p>{requests.error}</p><Button variant="outline" size="sm" onClick={requests.refresh}>Retry</Button>
    </div>
  );
  if (!requests.shoots.length) return <EmptyState icon="clear" title="No pending hold requests." size="compact" />;

  return <><div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
    {requests.shoots.map((shoot) => (
      <div key={shoot.id} className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <p className="break-words text-xs font-medium">{shoot.address}</p>
        {shoot.clientName && <p className="text-xs text-muted-foreground">{shoot.clientName}</p>}
        {shoot.reason && <p className="break-words whitespace-pre-wrap text-xs text-muted-foreground">{shoot.reason}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={requests.actioning !== null} onClick={() => setApproval(shoot)}>Approve hold</Button>
          <Button size="sm" variant="outline" disabled={requests.actioning !== null} onClick={() => requests.decide(shoot.id, 'reject')}>Reject hold</Button>
        </div>
      </div>
    ))}
  </div>
    <Dialog open={Boolean(approval)} onOpenChange={(open) => { if (!open && requests.actioning === null) setApproval(null); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>Approve hold</DialogTitle><DialogDescription>{approval?.address}</DialogDescription></DialogHeader>
        {approval?.reason && <p className="text-sm">Reason: {approval.reason}</p>}
        <HoldNotificationFields options={notifications} disabled={requests.actioning !== null} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={requests.actioning !== null} onClick={() => setApproval(null)}>Close</Button>
          <Button disabled={requests.actioning !== null} onClick={() => {
            if (approval) requests.decide(approval.id, 'approve', notifications.payload, () => setApproval(null));
          }}>Confirm hold</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

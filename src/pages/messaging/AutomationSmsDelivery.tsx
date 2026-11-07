import type { AutomationRun } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';
import { smsNeedsAttention } from './automationHealth';

export function AutomationSmsDelivery({ run }: { run: AutomationRun }) {
  const { role } = useAuth();
  const delivery = run.sms_delivery;
  if (role !== 'superadmin' || !delivery) return null;
  const label = {
    failed: 'SMS delivery failed',
    blocked: 'SMS blocked',
    pending: 'SMS delivery pending confirmation',
    unknown: 'SMS delivery outcome unavailable',
    delivered: 'SMS delivered',
  }[delivery.status];

  return (
    <div className={`mt-1 text-xs ${smsNeedsAttention(run) ? 'text-amber-800 dark:text-amber-400' : 'text-muted-foreground'}`}>
      <p>{label} · {delivery.delivered}/{delivery.total} delivered</p>
      {delivery.failed > 0 && <p>{delivery.failed} failed{delivery.pending > 0 ? ` · ${delivery.pending} awaiting confirmation` : ''}</p>}
      {delivery.errors.map((error) => <p className="mt-1 break-words" key={error}>{error}</p>)}
    </div>
  );
}

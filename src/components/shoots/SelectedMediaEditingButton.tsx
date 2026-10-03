import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { sendShootToEditing } from '@/services/shootEditingDispatch';
import { triggerShootDetailRefresh } from '@/realtime/realtimeRefreshBus';

export function SelectedMediaEditingButton({ shootId, ids }: { shootId?: string | number; ids: Set<string> }) {
  const { role } = useAuth(); const { toast } = useToast();
  if (!shootId || !ids.size || !['admin', 'superadmin', 'editing_manager'].includes(role ?? '')) return null;
  return <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => {
    void sendShootToEditing(shootId, [...ids].map(Number)).then(sent => { if (sent) triggerShootDetailRefresh(String(shootId)); })
      .catch(error => toast({ title: 'Editing request could not open', description: error.message, variant: 'destructive' }));
  }}>Send to editing ({ids.size})</Button>;
}

import type { PickerCheckStatus } from './usePhotographerPickerAvailability';
import { Button } from '@/components/ui/button';

export function PhotographerPickerCheck({ status, error, retry, directory = false }: { status: PickerCheckStatus; error?: string; retry: () => void; directory?: boolean }) {
  if (status === 'ready') return null;
  return <div role={status === 'error' ? 'alert' : 'status'} className="flex shrink-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
    <span>{status === 'error' ? error || 'Unable to check availability.' : status === 'loading' ? directory ? 'Loading photographers...' : 'Checking availability. You can browse photographers now.' : 'Choose a date to check availability.'}</span>
    {status === 'error' && <Button type="button" size="sm" variant="outline" onClick={retry}>{directory ? 'Retry photographers' : 'Retry availability'}</Button>}
  </div>;
}

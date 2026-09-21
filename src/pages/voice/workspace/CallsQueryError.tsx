import { Button } from '@/components/ui/button';

export function CallsQueryError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="calls-panel space-y-3 p-5">
    <p className="text-sm text-[var(--calls-danger)]">{message}</p>
    <Button type="button" variant="outline" className="calls-secondary h-11" onClick={retry}>Try again</Button>
  </div>;
}

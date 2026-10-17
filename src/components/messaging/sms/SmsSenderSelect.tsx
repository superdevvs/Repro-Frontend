import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SmsNumberConfig } from '@/types/messaging';

type SmsSenderSelectProps = {
  numbers: SmsNumberConfig[];
  value?: number;
  onChange: (id: number) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  id?: string;
  className?: string;
  compact?: boolean;
};

export function SmsSenderSelect({ numbers, value, onChange, disabled, loading, error, onRetry, id, className, compact }: SmsSenderSelectProps) {
  const { role } = useAuth();
  const generatedId = useId();
  if (role !== 'superadmin') return null;

  const senderId = id ?? generatedId;
  const configured = numbers.filter(number => Number.isInteger(number.id) && Number(number.id) > 0 && number.phone_number.trim());
  const selected = configured.find(number => number.id === value);
  const placeholder = loading ? 'Loading sender numbers…' : error ? 'Sender numbers unavailable' : configured.length ? 'Choose a sender number' : 'No configured sender numbers';

  return <div className={cn(compact ? 'grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5' : 'space-y-1.5', className)}>
    <div className="flex items-center gap-2">
      <Label htmlFor={senderId} className={compact ? 'text-xs text-muted-foreground' : undefined}>From</Label>
      {!compact && selected?.is_default && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Default</Badge>}
    </div>
    <div className="relative">
      <select
        id={senderId}
        aria-label="SMS sender number"
        value={selected?.id ?? ''}
        disabled={disabled || loading || error || configured.length === 0}
        className={cn('h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50', compact && 'border-transparent bg-muted/40 hover:bg-muted/60 focus:border-input')}
        onChange={event => {
          const next = configured.find(number => number.id === Number(event.target.value));
          if (next?.id) onChange(next.id);
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {configured.map(number => <option key={number.id} value={number.id}>
          {number.label ? `${number.label} · ` : ''}{number.phone_number}{number.is_default ? ' · Default' : ''}
        </option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    </div>
    {error && <div role="alert" className={cn('flex items-center gap-2 text-xs text-destructive', compact && 'col-start-2')}>
      <span>Sender numbers could not be loaded.</span>
      {onRetry && <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>Retry</Button>}
    </div>}
  </div>;
}

import { useQuery } from '@tanstack/react-query';
import { getSmsSettings } from '@/services/messaging';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AutomationSmsSenderField({ value, onChange, disabled = false }: {
  value?: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  const settings = useQuery({ queryKey: ['automation-sms-settings'], queryFn: getSmsSettings });
  const numbers = (settings.data?.numbers ?? []).filter((number) => typeof number.id === 'number');
  return (
    <div>
      <Label htmlFor="automation-sms-number">SMS sending number</Label>
      <Select value={value ? String(value) : 'default'} onValueChange={(next) => onChange(next === 'default' ? null : Number(next))} disabled={disabled}>
        <SelectTrigger id="automation-sms-number"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Use default SMS number</SelectItem>
          {numbers.map((number) => <SelectItem key={number.id} value={String(number.id)}>{number.phone_number}</SelectItem>)}
          {value && !numbers.some((number) => number.id === value) && <SelectItem value={String(value)}>Saved number #{value}</SelectItem>}
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-muted-foreground">{settings.isError ? 'Sending numbers could not be loaded. The saved choice is preserved.' : 'Uses a number from SMS settings.'}</p>
    </div>
  );
}

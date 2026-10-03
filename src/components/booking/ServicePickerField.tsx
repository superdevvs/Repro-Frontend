import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceSelectionDialog, type ServiceSelectionOption } from './ServiceSelectionDialog';

type Props = {
  id?: string; label?: string; value: string; options: ServiceSelectionOption[];
  onValueChange: (value: string) => void; effectiveSqft?: number | null; hidePrices?: boolean;
};

/** Single-service entry points use the same catalog without changing their payload. */
export function ServicePickerField({ id, label = 'Choose a service', value, options, onValueChange, effectiveSqft, hidePrices }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.id === value);
  return <>
    <Button id={id} type="button" variant="outline" aria-label={label} aria-haspopup="dialog"
      className="h-auto min-h-10 w-full justify-between gap-3 text-left font-normal" onClick={() => setOpen(true)}>
      <span className="min-w-0 whitespace-normal break-words">{selected?.name || label}</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
    </Button>
    <ServiceSelectionDialog open={open} onOpenChange={setOpen} services={options}
      selectedServices={selected ? [selected] : []} selectionMode="single"
      onSelectedServicesChange={next => { if (next[0]) onValueChange(next[0].id); }}
      effectiveSqft={effectiveSqft} hidePrices={hidePrices} title={label}
      description="Choose one service, then finish selecting." />
  </>;
}

import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type InvoiceStatus = 'all' | 'pending' | 'paid' | 'overdue';

interface InvoiceStatusTabsProps {
  value: InvoiceStatus;
  onValueChange: (value: InvoiceStatus) => void;
  className?: string;
}

const statuses: Array<{ value: InvoiceStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

export function InvoiceStatusTabs({ value, onValueChange, className }: InvoiceStatusTabsProps) {
  const root = useRef<HTMLDivElement>(null);
  const selectedTrigger = useRef<HTMLButtonElement>(null);
  const modality = useRef<'mouse' | 'touch' | 'keyboard'>('keyboard');
  const pointerInside = useRef(false);
  const holdForFocus = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [firstStatus, setFirstStatus] = useState(value);

  const expand = () => {
    // Keep the initial target in place, then retain that order while expanded.
    if (!expanded) setFirstStatus(value);
    setExpanded(true);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      modality.current = event.pointerType === 'touch' ? 'touch' : 'mouse';
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        pointerInside.current = false;
        holdForFocus.current = false;
        setExpanded(false);
      }
    };
    const handleKeyDown = () => { modality.current = 'keyboard'; };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  const orderedStatuses = expanded
    ? [statuses.find((status) => status.value === firstStatus)!, ...statuses.filter((status) => status.value !== firstStatus)]
    : statuses.filter((status) => status.value === value);

  return (
    <Tabs
      ref={root}
      value={value}
      onValueChange={(next) => onValueChange(next as InvoiceStatus)}
      activationMode="manual"
      className={cn('w-fit overflow-x-auto p-1 -m-1', className)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return;
        pointerInside.current = true;
        expand();
      }}
      onPointerLeave={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        pointerInside.current = false;
        if (!holdForFocus.current) setExpanded(false);
      }}
      onPointerDownCapture={(event) => {
        modality.current = event.pointerType === 'touch' ? 'touch' : 'mouse';
        holdForFocus.current = modality.current === 'touch';
        if (holdForFocus.current) expand();
      }}
      onFocusCapture={() => {
        holdForFocus.current = modality.current !== 'mouse';
        if (holdForFocus.current) expand();
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        holdForFocus.current = false;
        if (!pointerInside.current) setExpanded(false);
      }}
      onKeyDownCapture={(event) => {
        holdForFocus.current = true;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          selectedTrigger.current?.focus();
          setExpanded(false);
        } else {
          expand();
        }
      }}
    >
      <TabsList aria-label="Invoice status" className="inline-flex min-w-max">
        {orderedStatuses.map((status) => (
          <TabsTrigger
            key={status.value}
            ref={status.value === value ? selectedTrigger : undefined}
            value={status.value}
            className="py-1 text-sm"
            aria-expanded={status.value === value ? expanded : undefined}
            onClick={expand}
          >
            {status.label}
            {!expanded && <ChevronRight className="ml-1 h-3.5 w-3.5 opacity-60" aria-hidden="true" />}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ServicePickerIcon } from './ServicePickerIcon';
import { serviceCategoryIcon } from './serviceCategoryIcon';
import type { ReactNode } from 'react';

type Props = {
  name: string; description?: string | null; category: string; price: ReactNode;
  priceContext?: string | null; selected: boolean; quantity: number; multiple: boolean;
  onToggle: () => void; onQuantity: (delta: -1 | 1) => void;
};

export function ServicePickerCard({ name, description, category, price, priceContext, selected, quantity, multiple, onToggle, onQuantity }: Props) {
  return (
    <div data-testid="service-picker-card" className={cn('service-picker-card', selected && 'is-selected')} onClick={onToggle}>
      <div className="flex items-center gap-3">
        <span className="text-[var(--picker-accent)]"><ServicePickerIcon name={serviceCategoryIcon(category)} /></span>
        <span className="min-w-0 flex-1 text-xs text-[var(--picker-muted)]">{category}</span>
        <Checkbox aria-label={`Select ${name}`} checked={selected} className="service-picker-check h-6 w-6 rounded-md"
          onClick={event => event.stopPropagation()} onCheckedChange={onToggle}>
          <ServicePickerIcon name="check" />
        </Checkbox>
      </div>
      <div className="min-w-0 space-y-2">
        <p className="break-words text-base font-semibold leading-snug sm:text-lg">{name}</p>
        {description && <p className="break-words text-xs leading-relaxed text-[var(--picker-muted)]">{description}</p>}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[22px] font-semibold leading-snug tabular-nums">{price}</span>
        {multiple ? (
          <div role="group" aria-label={`Quantity for ${name}`} className="inline-flex items-center rounded-lg border border-[var(--picker-border)] bg-[var(--picker-surface)]"
            onClick={event => event.stopPropagation()}>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Decrease ${name} quantity`} disabled={quantity <= 1} onClick={() => onQuantity(-1)}><Minus className="h-3.5 w-3.5" /></Button>
            <output aria-label={`${name} quantity`} aria-live="polite" className="min-w-7 text-center text-sm font-medium tabular-nums">{quantity}</output>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-[var(--picker-accent)]" aria-label={`Increase ${name} quantity`} onClick={() => onQuantity(1)}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        ) : selected && <span className="text-xs font-medium text-[var(--picker-accent)]">Selected</span>}
      </div>
      {priceContext && <p className="text-xs text-[var(--picker-muted)]">{priceContext}</p>}
    </div>
  );
}

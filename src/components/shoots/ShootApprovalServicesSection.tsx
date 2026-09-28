import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import type { ApprovalService } from './shootApprovalServices';

export function ShootApprovalServicesSection({ services, quantities, onQuantityChange, disabled }: {
  services: Array<ApprovalService | string>; quantities: Record<string, number>;
  onQuantityChange: (id: string, quantity: number) => void; disabled: boolean;
}) {
  return <section className="space-y-2" aria-label="Requested services">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Services</p>
    {services.map((service, index) => {
      if (typeof service === 'string') return <p key={`${service}-${index}`} className="text-xs">{service}</p>;
      const id = String(service.id);
      const quantity = normalizeBookingQuantity(quantities[id] ?? service.quantity);
      return <div key={id} className="space-y-2 rounded-lg border bg-background/50 p-2.5">
        <div className="flex items-start justify-between gap-2 text-xs"><span className="min-w-0 font-medium">{service.name}{quantity > 1 ? ` × ${quantity}` : ''}</span><strong className="shrink-0 tabular-nums">${(service.price * quantity).toFixed(2)}</strong></div>
        {service.allow_multiple && <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">${service.price.toFixed(2)} each</span><div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={disabled || quantity <= 1} aria-label={`Decrease ${service.name} quantity`} onClick={() => onQuantityChange(id, quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
          <output aria-label={`${service.name} quantity`} aria-live="polite" className="min-w-6 text-center text-sm tabular-nums">{quantity}</output>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={disabled} aria-label={`Increase ${service.name} quantity`} onClick={() => onQuantityChange(id, quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
        </div></div>}
      </div>;
    })}
  </section>;
}

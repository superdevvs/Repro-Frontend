import { DollarSign, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import type { ServicePackage } from '@/pages/bookShootModel';
import type { CompensationMode } from './model';
import type { CompReshootBookingController } from './useCompReshootBooking';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const MODE_OPTIONS: Array<{ value: CompensationMode; label: string; hint: string }> = [
  { value: 'none', label: 'None', hint: '$0 payout' },
  { value: 'standard', label: 'Standard', hint: 'Normal rate' },
  { value: 'custom', label: 'Custom', hint: 'Set amount' },
];

function ModeRadioGroup({
  id,
  value,
  onValueChange,
  suggested,
  disabledOptions = [],
}: {
  id: string;
  value: CompensationMode | null;
  onValueChange: (value: CompensationMode) => void;
  suggested?: CompensationMode | null;
  disabledOptions?: CompensationMode[];
}) {
  return (
    <RadioGroup
      value={value ?? ''}
      onValueChange={(next) => onValueChange(next as CompensationMode)}
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      aria-label={id}
    >
      {MODE_OPTIONS.map((option) => {
        const optionId = `${id}-${option.value}`;
        const disabled = disabledOptions.includes(option.value);
        return (
          <div key={option.value} className="relative">
            <RadioGroupItem value={option.value} id={optionId} disabled={disabled} className="peer sr-only" />
            <Label
              htmlFor={optionId}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm transition-colors hover:border-primary/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-45 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
            >
              <span>
                <span className="font-medium text-foreground">{option.label}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">{option.hint}</span>
              </span>
              {suggested === option.value && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Suggested</Badge>
              )}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

type CompReshootCompensationSectionProps = {
  controller: CompReshootBookingController;
  selectedServices: ServicePackage[];
  nominalServiceTotal: number;
  photographerId: string;
  servicePhotographers: Record<string, string>;
  photographers: Array<{ id: string; name: string }>;
};

export function CompReshootCompensationSection({
  controller,
  selectedServices,
  nominalServiceTotal,
  photographerId,
  servicePhotographers,
  photographers,
}: CompReshootCompensationSectionProps) {
  if (!controller.enabled) return null;

  const resolvePhotographerName = (serviceId: string) => {
    const assignedId = servicePhotographers[serviceId] || photographerId;
    return photographers.find((person) => String(person.id) === String(assignedId))?.name || 'To be assigned';
  };
  const hasRep = Boolean(controller.template?.rep?.id);
  const editorEstimateKnown = controller.editorCompensationEstimate !== null;
  const knownCompensationTotal = controller.photographerCompensationTotal
    + controller.repCompensationTotal;

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60" aria-labelledby="compensation-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="compensation-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <DollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
            Staff compensation
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">The client total stays $0. Choose how the return visit pays each team.</p>
        </div>
        <Badge variant="secondary">Complimentary</Badge>
      </div>

      <div className="mt-4 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium text-foreground">Photographer</h4>
              <p className="text-xs text-muted-foreground">Applies to all selected services unless Custom is chosen.</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">{money.format(controller.photographerCompensationTotal)}</span>
          </div>
          <ModeRadioGroup
            id="photographer-compensation"
            value={controller.photographerMode}
            onValueChange={controller.setPhotographerMode}
            suggested={controller.suggestedPolicy?.photographerMode}
          />

          {!controller.photographerAssignmentsAreComplete && (
            <div role="alert" className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              Assign a photographer on Schedule for: {controller.unassignedCompensatedServices.map((service) => service.name).join(', ')}. Positive compensation cannot be booked without a recipient.
            </div>
          )}

          {controller.photographerMode === 'custom' && (
            <div className="divide-y divide-border/70 rounded-lg border border-border/70" aria-label="Per-service photographer compensation">
              {selectedServices.map((service) => {
                const row = controller.serviceCompensations[service.id] ?? { mode: 'standard' as const, customAmount: '' };
                return (
                  <div key={service.id} className="grid gap-2 p-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(13rem,1.2fr)_8rem] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground" title={service.name}>{service.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{resolvePhotographerName(service.id)} · Standard {money.format(controller.getStandardPay(service))}</p>
                    </div>
                    <RadioGroup
                      value={row.mode}
                      onValueChange={(value) => controller.setServiceCompensationMode(service.id, value as CompensationMode)}
                      className="flex flex-wrap gap-x-3 gap-y-2"
                      aria-label={`${service.name} photographer compensation`}
                    >
                      {MODE_OPTIONS.map((option) => {
                        const optionId = `photographer-${service.id}-${option.value}`;
                        return (
                          <div key={option.value} className="flex items-center gap-1.5">
                            <RadioGroupItem id={optionId} value={option.value} />
                            <Label htmlFor={optionId} className="text-xs font-medium">{option.label}</Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                    {row.mode === 'custom' ? (
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          className="h-9 pl-6 text-right"
                          value={row.customAmount}
                          onChange={(event) => controller.setServiceCustomAmount(service.id, event.target.value)}
                          aria-label={`${service.name} custom photographer amount`}
                        />
                      </div>
                    ) : (
                      <span className="text-right text-sm font-medium tabular-nums text-foreground">
                        {money.format(controller.getServiceCompensation(service).amount)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium text-foreground">Sales rep</h4>
              <p className="text-xs text-muted-foreground">
                {hasRep
                  ? `${controller.template?.rep?.name || 'Assigned rep'} · Standard estimate ${money.format(controller.repStandardCompensation)}`
                  : 'No sales rep is assigned to the source shoot. Choose None.'}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">{money.format(controller.repCompensationTotal)}</span>
          </div>
          <ModeRadioGroup
            id="sales-rep-compensation"
            value={controller.repMode}
            onValueChange={controller.setRepMode}
            suggested={controller.suggestedPolicy?.suggestedRepMode}
            disabledOptions={hasRep ? [] : ['standard', 'custom']}
          />
          {controller.repMode === 'custom' && (
            <div className="ml-auto flex max-w-xs items-center gap-2">
              <Label htmlFor="rep-custom-amount" className="shrink-0 text-xs text-muted-foreground">Exact payout</Label>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="rep-custom-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  className="h-9 pl-6 text-right"
                  value={controller.repCustomAmount}
                  onChange={(event) => controller.setRepCustomAmount(event.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Editor compensation stays in the normal editing workflow. Company cost remains an estimate until the editor payout is recorded.</p>
          </div>
          <dl className="w-full space-y-2 text-sm">
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Nominal service value</dt>
              <dd className="tabular-nums">{money.format(nominalServiceTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Client pays</dt>
              <dd className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">$0.00</dd>
            </div>
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Photographer compensation</dt>
              <dd className="tabular-nums">{money.format(controller.photographerCompensationTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Rep compensation</dt>
              <dd className="tabular-nums">{money.format(controller.repCompensationTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Expected editor cost</dt>
              <dd className="text-right tabular-nums">
                {editorEstimateKnown
                  ? money.format(controller.editorCompensationEstimate ?? 0)
                  : 'Normal · calculated when assigned'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold text-foreground">
              <dt>Estimated company comp cost</dt>
              <dd className="text-right tabular-nums">
                {editorEstimateKnown
                  ? money.format(controller.staffCompensationTotal)
                  : `${money.format(knownCompensationTotal)} + editor`}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

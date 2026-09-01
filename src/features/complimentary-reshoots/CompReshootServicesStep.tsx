import * as React from 'react';
import { ArrowLeft, ArrowRight, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServiceSelectionDialog } from '@/components/booking/ServiceSelectionDialog';
import type { ServicePackage } from '@/pages/bookShootModel';
import { CompReshootServiceMapping } from './CompReshootServiceMapping';
import type { CompReshootBookingController } from './useCompReshootBooking';

type CompReshootServicesStepProps = {
  controller: CompReshootBookingController;
  services: ServicePackage[];
  selectedServices: ServicePackage[];
  servicesLoading: boolean;
  sqft: number | null;
  onSelectedServicesChange: (services: ServicePackage[]) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function CompReshootServicesStep({
  controller,
  services,
  selectedServices,
  servicesLoading,
  sqft,
  onSelectedServicesChange,
  onBack,
  onContinue,
}: CompReshootServicesStepProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/40" aria-labelledby="comp-services-heading">
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 id="comp-services-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Services needing correction
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose the work for this return visit, then link each item to the original service.</p>
        </div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setPickerOpen(true)}>
          {selectedServices.length ? 'Edit services' : 'Select services'}
        </Button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {selectedServices.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Selected return-visit services">
            {selectedServices.map((service) => (
              <Badge key={service.id} variant="secondary" className="max-w-full gap-2 py-1.5 pl-3 pr-2 text-sm">
                <span className="truncate">{service.name}</span>
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Client $0</span>
                <button
                  type="button"
                  onClick={() => onSelectedServicesChange(selectedServices.filter((item) => item.id !== service.id))}
                  className="rounded px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${service.name}`}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No correction services selected yet.</p>
        )}

        <CompReshootServiceMapping controller={controller} selectedServices={selectedServices} />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/70 px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={!selectedServices.length || !controller.mappingIsComplete}
        >
          Continue to schedule
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <ServiceSelectionDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        services={services}
        selectedServices={selectedServices}
        onSelectedServicesChange={(next) => onSelectedServicesChange(next as ServicePackage[])}
        servicesLoading={servicesLoading}
        effectiveSqft={sqft}
        title="Services needing correction"
        description="Select only the work required for this complimentary return visit. Catalog prices are retained as internal nominal value; the client total remains $0."
      />
    </section>
  );
}

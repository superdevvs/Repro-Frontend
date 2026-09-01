import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ServicePackage } from '@/pages/bookShootModel';
import { COMP_RESHOOT_RESPONSIBILITY_OPTIONS, type CompReshootResponsibility } from './model';
import type { CompReshootBookingController } from './useCompReshootBooking';

type CompReshootServiceMappingProps = {
  controller: CompReshootBookingController;
  selectedServices: ServicePackage[];
};

export function CompReshootServiceMapping({
  controller,
  selectedServices,
}: CompReshootServiceMappingProps) {
  if (!controller.enabled || selectedServices.length === 0) return null;

  return (
    <div className="border-t border-border/70 pt-3" aria-labelledby="affected-source-services-title">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="affected-source-services-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Affected source services
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">Link each return-visit service to the item that needs correction.</p>
        </div>
        <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200">Client $0</Badge>
      </div>
      <div className="divide-y divide-border/70 rounded-lg border border-border/70 bg-background/70">
        {selectedServices.map((service) => {
          const mapping = controller.serviceMappings[service.id];
          const sourceItemsUsedElsewhere = new Set(
            selectedServices
              .filter((selectedService) => selectedService.id !== service.id)
              .map((selectedService) => controller.serviceMappings[selectedService.id]?.sourceShootServiceId)
              .filter((value): value is string => Boolean(value)),
          );
          return (
            <div key={service.id} className="grid gap-3 p-3 md:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.25fr)_minmax(10rem,0.9fr)] md:items-end">
              <div className="min-w-0">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reshoot service</span>
                <span className="mt-1 block truncate text-sm font-medium text-foreground" title={service.name}>{service.name}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`source-service-${service.id}`} className="text-xs text-muted-foreground">Affected source item</Label>
                <Select
                  value={mapping?.sourceShootServiceId || undefined}
                  onValueChange={(value) => controller.updateServiceMapping(service.id, { sourceShootServiceId: value })}
                >
                  <SelectTrigger id={`source-service-${service.id}`} className="h-9 text-sm">
                    <SelectValue placeholder="Select source item" />
                  </SelectTrigger>
                  <SelectContent>
                    {(controller.template?.sourceServices ?? []).map((source) => (
                      <SelectItem
                        key={source.shootServiceId}
                        value={source.shootServiceId}
                        disabled={sourceItemsUsedElsewhere.has(source.shootServiceId)}
                      >
                        {source.name}{source.photographerName ? ` — ${source.photographerName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mapping?.responsibility === 'photographer' && controller.getMappedSourceService(service.id)?.photographerName && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    Source photographer: {controller.getMappedSourceService(service.id)?.photographerName}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`responsibility-${service.id}`} className="text-xs text-muted-foreground">Responsibility</Label>
                <Select
                  value={mapping?.responsibility || undefined}
                  onValueChange={(value) => controller.updateServiceMapping(service.id, {
                    responsibility: value as CompReshootResponsibility,
                  })}
                >
                  <SelectTrigger id={`responsibility-${service.id}`} className="h-9 text-sm">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMP_RESHOOT_RESPONSIBILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
      {!controller.mappingIsComplete && (
        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300" role="status">
          Complete the source item and responsibility for every selected service. Each source item can only be linked once.
        </p>
      )}
    </div>
  );
}

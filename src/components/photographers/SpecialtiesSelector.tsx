
import React from 'react';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { useServices, Service } from '@/hooks/useServices';
import { Loader2 } from 'lucide-react';

// Schema now uses service IDs (strings) instead of names
export const photographerFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  location: z.string().min(2, { message: 'Location is required' }),
  specialties: z.string().array().min(1, { message: 'Select at least one service capability' }),
  status: z.enum(['available', 'busy', 'offline']),
  avatar: z.string().optional(),
});

export type PhotographerFormValues = z.infer<typeof photographerFormSchema>;

interface SpecialtiesSelectorProps {
  form: UseFormReturn<PhotographerFormValues>;
  selectedSpecialties: string[]; // Now stores service IDs
  onSpecialtyChange: (serviceId: string) => void;
}

export function SpecialtiesSelector({ 
  form, 
  selectedSpecialties, 
  onSpecialtyChange 
}: SpecialtiesSelectorProps) {
  const { data: services, isLoading } = useServices();

  // Get active services with their IDs
  const serviceOptions = React.useMemo(() => {
    if (!services || services.length === 0) return [];
    return services.filter((s) => s.active !== false);
  }, [services]);

  // Group services by category
  const groupedServices = React.useMemo(() => {
    if (!serviceOptions.length) return [];
    const groups: Record<string, typeof serviceOptions> = {};
    for (const s of serviceOptions) {
      const cat = s.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
  }, [serviceOptions]);

  return (
    <FormField
      control={form.control}
      name="specialties"
      render={() => (
        <FormItem>
          <FormLabel>Service Capabilities</FormLabel>
          <p className="text-xs text-muted-foreground mb-2">
            Select services this photographer can perform
          </p>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading services...</span>
            </div>
          ) : serviceOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No services configured. Add services in Scheduling Settings.
            </p>
          ) : (
            <div className="space-y-3 mt-2">
              {groupedServices.map(([category, services]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{category}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((service) => (
                      <Button
                        type="button"
                        key={service.id}
                        variant={selectedSpecialties.includes(service.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSpecialtyChange(service.id)}
                        title={service.description || service.name}
                      >
                        {service.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Helper to get service names from IDs for display purposes
 */
export function useServiceNames(serviceIds: string[]): { names: string[]; isLoading: boolean } {
  const { data: services, isLoading } = useServices();
  
  const names = React.useMemo(() => {
    if (!services || serviceIds.length === 0) return [];
    return serviceIds
      .map(id => services.find(s => s.id === id)?.name)
      .filter((name): name is string => !!name);
  }, [services, serviceIds]);

  return { names, isLoading };
}

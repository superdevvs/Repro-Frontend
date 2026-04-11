import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { DollarSign, Plus, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { useEditorRates } from '@/hooks/useEditorRates';
import {
  type EditorServiceRate,
  normalizeEditorServiceName,
} from '@/utils/editorRates';

interface EditorRateSettingsProps {
  className?: string;
}

export function EditorRateSettings({ className }: EditorRateSettingsProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    data: services = [],
    isLoading: servicesLoading,
    isError: servicesError,
  } = useServices({ scope: 'public' });
  const activeServices = useMemo(
    () =>
      services
        .filter((service) => service.active !== false)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [services],
  );
  const {
    rates: savedRates,
    isLoading,
    isError: isRatesError,
    error: ratesError,
    isSaving,
    saveRates,
  } = useEditorRates(user?.id, {
    enabled: Boolean(user?.id),
    services: activeServices,
  });
  const [rates, setRates] = useState<EditorServiceRate[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  const remainingServices = useMemo(() => {
    const selectedKeys = new Set(
      rates.map((rate) => rate.serviceId || normalizeEditorServiceName(rate.serviceName)),
    );

    return activeServices.filter((service) => {
      const key = service.id || normalizeEditorServiceName(service.name);
      return !selectedKeys.has(key);
    });
  }, [activeServices, rates]);

  const hasChanges = useMemo(
    () => JSON.stringify(rates) !== JSON.stringify(savedRates),
    [rates, savedRates],
  );

  useEffect(() => {
    if (!hasLocalEdits || !hasChanges) {
      setRates(savedRates);
    }

    if (hasLocalEdits && !hasChanges) {
      setHasLocalEdits(false);
    }
  }, [hasChanges, hasLocalEdits, savedRates]);

  useEffect(() => {
    if (!selectedServiceId && remainingServices.length > 0) {
      setSelectedServiceId(remainingServices[0].id);
      return;
    }

    if (
      selectedServiceId &&
      !remainingServices.some((service) => String(service.id) === String(selectedServiceId))
    ) {
      setSelectedServiceId(remainingServices[0]?.id || '');
    }
  }, [remainingServices, selectedServiceId]);

  const handleRateChange = (serviceKey: string, value: string) => {
    const rateValue = Number.parseFloat(value);
    setHasLocalEdits(true);
    setRates((currentRates) =>
      currentRates.map((rate) => {
        const key = rate.serviceId || normalizeEditorServiceName(rate.serviceName);
        if (key !== serviceKey) return rate;
        return {
          ...rate,
          rate: Number.isFinite(rateValue) ? rateValue : 0,
        };
      }),
    );
  };

  const handleAddService = () => {
    if (!selectedServiceId) return;

    const service = activeServices.find(
      (item) => String(item.id) === String(selectedServiceId),
    );
    if (!service) return;

    setHasLocalEdits(true);
    setRates((currentRates) => [
      ...currentRates,
      {
        serviceId: service.id,
        serviceName: service.name,
        rate: 0,
      },
    ]);
  };

  const handleRemoveService = (serviceKey: string) => {
    setHasLocalEdits(true);
    setRates((currentRates) =>
      currentRates.filter((rate) => {
        const key = rate.serviceId || normalizeEditorServiceName(rate.serviceName);
        return key !== serviceKey;
      }),
    );
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User information not available.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const nextSavedRates = await saveRates(rates);
      setRates(nextSavedRates.service_rates);
      setHasLocalEdits(false);

      toast({
        title: 'Rates Saved',
        description: 'Your editing rates have been updated successfully.',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error saving rates:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast({
          title: 'Connection Error',
          description:
            'Unable to connect to the server. Please check your internet connection and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to save rates. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading && rates.length === 0) {
    return (
      <Card className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
        <CardHeader className="flex-shrink-0">
          <CardTitle>Editing Rates</CardTitle>
          <CardDescription>Choose services and set the editor rate for each one.</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <div className="text-center py-4 text-muted-foreground">Loading rates...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Editing Rates
        </CardTitle>
        <CardDescription>
          Choose services and set a rate for each one. Remove any row you do not need.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {isRatesError && (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {ratesError instanceof Error
                ? ratesError.message
                : 'Saved editor rates are temporarily unavailable.'}
            </div>
          )}

          {servicesError && (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Service options are temporarily unavailable. Existing rates can still be viewed and saved.
            </div>
          )}

          <div className="rounded-lg border border-dashed p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="editing-rate-service">Add Service</Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger id="editing-rate-service">
                    <SelectValue
                      placeholder={servicesLoading ? 'Loading services...' : 'Select a service'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {remainingServices.length > 0 ? (
                      remainingServices.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-services" disabled>
                        No more services to add
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={handleAddService}
                disabled={
                  servicesLoading ||
                  servicesError ||
                  !selectedServiceId ||
                  remainingServices.length === 0
                }
                className="sm:min-w-[140px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          </div>

          {rates.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Add a service to start setting editing rates.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-4">
                {rates.map((rate) => {
                  const serviceKey =
                    rate.serviceId || normalizeEditorServiceName(rate.serviceName);

                  return (
                    <div key={serviceKey} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`rate-${serviceKey}`}>
                            {rate.serviceName} Rate ($ per item)
                          </Label>
                          <Input
                            id={`rate-${serviceKey}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={rate.rate}
                            onChange={(event) => handleRateChange(serviceKey, event.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRemoveService(serviceKey)}
                          className="sm:min-w-[120px]"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="mt-4 w-full flex-shrink-0"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Rates'}
        </Button>
      </CardContent>
    </Card>
  );
}

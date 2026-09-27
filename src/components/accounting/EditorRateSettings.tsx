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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { Plus, Save, Trash2 } from 'lucide-react';
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
  const [editing, setEditing] = useState(false);
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
      setEditing(false);

      toast({
        title: 'Rates Saved',
        description: 'Your editing rates have been updated successfully.',
        variant: 'default',
      });
    } catch (error: unknown) {
      console.error('Error saving rates:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast({
          title: 'Connection Error',
          description:
            'Unable to connect to the server. Please check your internet connection and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to save rates. Please try again.',
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

  const closeEditor = () => { if (isSaving) return; setRates(savedRates); setHasLocalEdits(false); setEditing(false); };
  return <>
    <Card className={cn('flex min-h-0 flex-col overflow-hidden border-border/70', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 sm:p-5"><CardTitle className="text-base">My service rates</CardTitle><Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit rates</Button></CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5">
        {isRatesError && <p className="mb-3 text-xs text-destructive">Saved rates are temporarily unavailable.</p>}
        <div className="max-h-64 divide-y overflow-y-auto overscroll-contain [scrollbar-gutter:stable]" tabIndex={0} aria-label="Saved editing service rates">
          {savedRates.map((rate) => <div key={rate.serviceId || rate.serviceName} className="flex items-center justify-between gap-3 py-3 text-xs"><span>{rate.serviceName}</span><strong className="shrink-0 tabular-nums">${Number(rate.rate || 0).toFixed(2)} / item</strong></div>)}
          {!savedRates.length && <p className="py-6 text-sm text-muted-foreground">No service rates configured yet.</p>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Saved earnings keep their recorded rates. Current rates only estimate work without a saved payout.</p>
      </CardContent>
    </Card>
    <Dialog open={editing} onOpenChange={(open) => { if (!open) closeEditor(); else setEditing(true); }}>
      <DialogContent className="flex max-h-[85dvh] max-w-xl flex-col overflow-hidden">
        <DialogHeader><DialogTitle>Edit service rates</DialogTitle><DialogDescription>Choose your services and rate per item. Save to apply your changes.</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
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

          <div className="rounded-lg border p-3">
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
                className="sm:min-w-[100px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add service
              </Button>
            </div>
          </div>

          {rates.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Add a service to start setting editing rates.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-2">
                {rates.map((rate) => {
                  const serviceKey =
                    rate.serviceId || normalizeEditorServiceName(rate.serviceName);

                  return (
                    <div key={serviceKey} className="rounded-lg border p-3">
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
                          className="sm:min-w-[95px]"
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

        <div className="sticky bottom-0 mt-4 flex gap-2 border-t bg-background pt-3">
        <Button variant="outline" onClick={() => { setRates(savedRates); setHasLocalEdits(false); setEditing(false); }} disabled={isSaving}>Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="flex-1"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Rates'}
        </Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  </>;
}

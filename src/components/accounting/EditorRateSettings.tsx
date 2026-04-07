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
import { API_BASE_URL } from '@/config/env';
import { DollarSign, Plus, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import {
  type EditorServiceRate,
  getEditorRatePayload,
  getEditorServiceRates,
  normalizeEditorServiceName,
} from '@/utils/editorRates';

interface EditorRateSettingsProps {
  className?: string;
}

export function EditorRateSettings({ className }: EditorRateSettingsProps = {}) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const [rates, setRates] = useState<EditorServiceRate[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeServices = useMemo(
    () =>
      services
        .filter((service) => service.active !== false)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [services],
  );

  const remainingServices = useMemo(() => {
    const selectedKeys = new Set(
      rates.map((rate) => rate.serviceId || normalizeEditorServiceName(rate.serviceName)),
    );

    return activeServices.filter((service) => {
      const key = service.id || normalizeEditorServiceName(service.name);
      return !selectedKeys.has(key);
    });
  }, [activeServices, rates]);

  useEffect(() => {
    const loadRates = async () => {
      if (!user?.id || servicesLoading) return;

      setIsLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        const url = `${API_BASE_URL}/api/editors/${user.id}/rates`;

        if (import.meta.env.DEV) {
          console.log('Loading rates from:', url);
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.data) {
            const updatedMetadata = {
              ...(user.metadata || {}),
              ...data.data,
            };
            setRates(getEditorServiceRates(updatedMetadata, activeServices));
            if (user) {
              setUser({ ...user, metadata: updatedMetadata });
            }
            return;
          }
        } else if (response.status !== 404) {
          throw new Error('Failed to load rates');
        }

        setRates(getEditorServiceRates(user.metadata || {}, activeServices));
      } catch (error) {
        console.error('Error loading rates:', error);
        setRates(getEditorServiceRates(user?.metadata || {}, activeServices));
      } finally {
        setIsLoading(false);
      }
    };

    loadRates();
  }, [activeServices, servicesLoading, setUser, user?.id]);

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

    setIsSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = `${API_BASE_URL}/api/editors/${user.id}/rates`;
      const payload = getEditorRatePayload(rates);

      if (import.meta.env.DEV) {
        console.log('Saving rates to:', url);
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            'This feature is not yet available. The API endpoint has not been implemented on the server.',
          );
        }

        const errorMessage =
          responseData?.message ||
          responseData?.error ||
          (response.status === 401
            ? 'You are not authorized to perform this action.'
            : response.status === 500
              ? 'Server error. Please try again later.'
              : 'Failed to save rates. Please try again.');
        throw new Error(errorMessage);
      }

      const updatedMetadata = {
        ...(user.metadata || {}),
        ...(responseData?.data || payload),
      };
      const updatedRates = getEditorServiceRates(updatedMetadata, activeServices);
      setRates(updatedRates);
      if (user) {
        setUser({ ...user, metadata: updatedMetadata });
      }

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
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || servicesLoading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader>
          <CardTitle>Editing Rates</CardTitle>
          <CardDescription>Choose services and set the editor rate for each one.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="text-center py-4 text-muted-foreground">Loading rates...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Editing Rates
        </CardTitle>
        <CardDescription>
          Choose services from the admin service list and set a rate for each one. Remove any row you do not need.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4">
          <div className="rounded-lg border border-dashed p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="editing-rate-service">Add Service</Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger id="editing-rate-service">
                    <SelectValue placeholder="Select a service" />
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
                disabled={!selectedServiceId || remainingServices.length === 0}
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
          )}
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="mt-4 w-full">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Rates'}
        </Button>
      </CardContent>
    </Card>
  );
}

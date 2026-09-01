import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useToast } from '@/hooks/use-toast';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServices } from '@/hooks/useServices';
import { getCategorySpecialtyId } from '@/utils/photographerSpecialties';
import {
  notificationsSchema,
  specialtiesSchema,
  type NotificationsFormValues,
  type SpecialtiesFormValues,
} from '@/pages/photographerAccountSchemas';

const PROPERTY_TYPES = [
  'Single Family',
  'Multi-Family',
  'Condo/Townhouse',
  'Apartment',
  'Vacant Land',
  'Office',
  'Retail',
  'Industrial',
] as const;

const readStringList = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []
);

const readStoredBoolean = (value: unknown, fallback: boolean) => (
  typeof value === 'boolean' ? value : fallback
);

const readMetadata = (metadata: unknown) => (
  metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {}
);

const readPreferences = (metadata: Record<string, unknown>) => (
  metadata.preferences && typeof metadata.preferences === 'object'
    ? metadata.preferences as Record<string, unknown>
    : {}
);

export function PhotographerSpecialtiesForm() {
  const { user } = useAuth();
  const { saveProfile } = useSelfProfileSave();
  const { toast } = useToast();
  const metadata = readMetadata(user?.metadata);
  const { data: categoriesData, isLoading: categoriesLoading, isError: categoriesError } = useServiceCategories();
  const { data: servicesData, isLoading: servicesLoading, isError: servicesError } = useServices({ scope: 'public' });
  const specialtyOptions = useMemo(() => {
    const groups = new Map<string, { id: string; label: string }>();
    if (Array.isArray(categoriesData)) {
      categoriesData.forEach((record: unknown) => {
        if (!record || typeof record !== 'object') return;
        const category = record as Record<string, unknown>;
        const id = category.id == null ? '' : String(category.id);
        const label = typeof category.name === 'string' ? category.name.trim() : '';
        if (id && label) groups.set(getCategorySpecialtyId({ id, name: label }), { id: getCategorySpecialtyId({ id, name: label }), label });
      });
    }
    (servicesData ?? []).filter((service) => service.active !== false).forEach((service) => {
      const label = service.category || 'Other';
      const id = getCategorySpecialtyId({ id: service.category_id, name: label });
      if (!groups.has(id)) groups.set(id, { id, label });
    });
    return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [categoriesData, servicesData]);
  const form = useForm<SpecialtiesFormValues>({
    resolver: zodResolver(specialtiesSchema),
    defaultValues: {
      specialties: readStringList(metadata.specialties),
      property_types: readStringList(metadata.property_types),
    },
  });

  useEffect(() => {
    const nextMetadata = readMetadata(user?.metadata);
    const storedSpecialties = readStringList(nextMetadata.specialties);
    const normalizedSpecialties = storedSpecialties.map((value) => {
      if (value.startsWith('category:') || value.startsWith('category-name:')) return value;
      const matchingCategory = specialtyOptions.find((option) => option.label.toLowerCase() === value.toLowerCase());
      if (matchingCategory) return matchingCategory.id;
      const matchingService = (servicesData ?? []).find((service) => String(service.id) === value);
      return matchingService
        ? getCategorySpecialtyId({ id: matchingService.category_id, name: matchingService.category })
        : value;
    });
    form.reset({
      specialties: Array.from(new Set(normalizedSpecialties)),
      property_types: readStringList(nextMetadata.property_types),
    });
  }, [form, servicesData, specialtyOptions, user?.metadata]);

  const handleSubmit = async (data: SpecialtiesFormValues) => {
    try {
      const result = await saveProfile({
        specialties: data.specialties,
        property_types: data.property_types,
      });
      if (!result.reauthRequired) {
        toast({
          title: 'Specialties updated',
          description: result.message || 'Your photography specialties have been saved.',
        });
      }
    } catch (error) {
      toast({
        title: 'Unable to save specialties',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const updateSelection = (field: 'specialties' | 'property_types', value: string, checked: boolean) => {
    const currentValues = form.getValues(field);
    form.setValue(
      field,
      checked ? [...currentValues, value] : currentValues.filter((entry) => entry !== value),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Photography Services</CardTitle>
            <CardDescription>Select all the services you provide as a photographer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(categoriesLoading || servicesLoading) && (
                <p className="col-span-full text-sm text-muted-foreground">Loading available service categories…</p>
              )}
              {(categoriesError || servicesError) && (
                <p className="col-span-full text-sm text-destructive">Service categories could not be loaded. Your saved selections have not been changed.</p>
              )}
              {!categoriesLoading && !servicesLoading && !categoriesError && !servicesError && specialtyOptions.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">No active service categories are available.</p>
              )}
              {specialtyOptions.map((specialty) => (
                <div key={specialty.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`specialty-${specialty.id}`}
                    value={specialty.id}
                    checked={form.watch('specialties').includes(specialty.id)}
                    onChange={(event) => updateSelection('specialties', specialty.id, event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor={`specialty-${specialty.id}`} className="text-sm">{specialty.label}</label>
                </div>
              ))}
            </div>
            {form.formState.errors.specialties?.message && (
              <p className="mt-3 text-sm font-medium text-destructive">
                {form.formState.errors.specialties.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Property Experience</CardTitle>
            <CardDescription>Keep a saved record of the property types you have experience photographing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROPERTY_TYPES.map((propertyType) => (
                <div key={propertyType} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`property-${propertyType}`}
                    value={propertyType}
                    checked={form.watch('property_types').includes(propertyType)}
                    onChange={(event) => updateSelection('property_types', propertyType, event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor={`property-${propertyType}`} className="text-sm">{propertyType}</label>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving...' : 'Save Specialties'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

export function PhotographerNotificationPreferencesForm() {
  const { user } = useAuth();
  const { saveProfile } = useSelfProfileSave();
  const { toast } = useToast();
  const preferences = readPreferences(readMetadata(user?.metadata));
  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      email_notifications: readStoredBoolean(preferences.notificationEmail, true),
    },
  });

  useEffect(() => {
    const nextPreferences = readPreferences(readMetadata(user?.metadata));
    form.reset({
      email_notifications: readStoredBoolean(nextPreferences.notificationEmail, true),
    });
  }, [form, user?.metadata]);

  const handleSubmit = async (data: NotificationsFormValues) => {
    try {
      const result = await saveProfile({
        preferences: {
          notificationEmail: data.email_notifications,
        },
      });
      if (!result.reauthRequired) {
        toast({
          title: 'Preferences updated',
          description: result.message || 'Your notification preferences have been saved.',
        });
      }
    } catch (error) {
      toast({
        title: 'Unable to save preferences',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Choose whether internal dashboard messages also reach your email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Email me when I receive a new internal dashboard message</p>
              </div>
              <Switch
                id="emailNotifications"
                checked={form.watch('email_notifications')}
                onCheckedChange={(checked) => form.setValue('email_notifications', checked, { shouldDirty: true })}
                disabled={form.formState.isSubmitting}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving...' : 'Save Notifications'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

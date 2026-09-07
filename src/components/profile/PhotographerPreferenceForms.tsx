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
  type NotificationsFormValues,
} from '@/pages/photographerAccountSchemas';

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
  const assignedSpecialties = Array.from(new Set(readStringList(metadata.specialties).map((value) => {
    const category = specialtyOptions.find((option) => option.id === value || option.label.toLowerCase() === value.toLowerCase());
    if (category) return category.label;
    const service = (servicesData ?? []).find((entry) => String(entry.id) === value);
    return service?.category || value;
  })));
  const propertyTypes = readStringList(metadata.property_types);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Service Capabilities</CardTitle>
          <CardDescription>Managed by your admin. Contact an administrator to request a change to your assigned specialties.</CardDescription>
        </CardHeader>
        <CardContent>
          {(categoriesLoading || servicesLoading) && <p className="text-sm text-muted-foreground">Loading service names...</p>}
          {(categoriesError || servicesError) && <p className="text-sm text-muted-foreground">Service names could not be loaded. Your saved assignments are shown below.</p>}
          {assignedSpecialties.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Assigned specialties">
              {assignedSpecialties.map((label) => <li key={label} className="rounded-full bg-muted px-3 py-1 text-sm">{label}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No specialties have been assigned yet.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Property Experience</CardTitle>
          <CardDescription>Managed by your admin. Contact an administrator to update the property types on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {propertyTypes.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Assigned property experience">
              {propertyTypes.map((label) => <li key={label} className="rounded-full bg-muted px-3 py-1 text-sm">{label}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No property experience has been recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
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

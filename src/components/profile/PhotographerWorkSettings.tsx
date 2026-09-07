import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { DefaultBracketModeField } from '@/components/accounts/DefaultBracketModeField';
import { TaxDocumentCard } from '@/components/profile/TaxDocumentCard';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useToast } from '@/hooks/use-toast';
import { approvedAddressFromUser } from '@/pages/applyApprovedPhotographerAddress';
import { photographerWorkSettingsSchema, type PhotographerWorkSettingsValues } from '@/pages/photographerAccountSchemas';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  ['America/New_York', 'Eastern Time (ET)'], ['America/Chicago', 'Central Time (CT)'],
  ['America/Denver', 'Mountain Time (MT)'], ['America/Los_Angeles', 'Pacific Time (PT)'],
  ['America/Anchorage', 'Alaska Time (AKT)'], ['Pacific/Honolulu', 'Hawaii Time (HT)'],
];

export function PhotographerWorkSettings() {
  const { user } = useAuth();
  const { saveProfile } = useSelfProfileSave();
  const { toast } = useToast();
  const pendingAddress = user?.pending_address_change;
  const metadata = (user?.metadata as Record<string, unknown> | undefined) ?? {};
  const preferences = metadata.preferences && typeof metadata.preferences === 'object'
    ? metadata.preferences as Record<string, unknown> : {};
  const form = useForm<PhotographerWorkSettingsValues>({
    resolver: zodResolver(photographerWorkSettingsSchema),
    defaultValues: {
      timezone: user?.timezone || 'America/New_York',
      address: user?.address || '', city: user?.city || '', state: user?.state || '', zip: user?.zipcode || '',
      travelRange: Number(metadata.travel_range ?? 25),
      travelRangeUnit: (metadata.travel_range_unit as 'miles' | 'km') ?? 'miles',
      weeklyInvoice: typeof preferences.weeklyInvoice === 'boolean' ? preferences.weeklyInvoice : true,
      defaultBracketMode: Number((user as { default_bracket_mode?: number } | undefined)?.default_bracket_mode ?? 5) === 3 ? 3 : 5,
    },
  });

  const onSubmit = async (data: PhotographerWorkSettingsValues) => {
    try {
      const result = await saveProfile({
        timezone: data.timezone,
        address: data.address, city: data.city, state: data.state, zip: data.zip,
        travel_range: data.travelRange, travel_range_unit: data.travelRangeUnit,
        default_bracket_mode: data.defaultBracketMode,
        preferences: { weeklyInvoice: data.weeklyInvoice },
      });
      const approved = approvedAddressFromUser(result.user);
      form.reset({ ...data, address: approved.address, city: approved.city, state: approved.state, zip: approved.zip });
      if (!result.reauthRequired) {
        toast({
          title: approved.pending ? 'Address submitted for approval' : 'Work settings updated',
          description: approved.pending ? 'Your other work settings have been saved. Your new address is awaiting admin approval.' : 'Your travel, shoot, and invoicing preferences have been saved.',
        });
      }
    } catch (error) {
      toast({ title: 'Unable to save work settings', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Location card */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Home base & travel</CardTitle>
                    <CardDescription>Your approved address and travel range help assign nearby shoots. Address changes require admin approval.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <FormControl>
                            <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                              {field.value && !TIMEZONES.some(([value]) => value === field.value) && <option value={field.value}>{field.value}</option>}
                              {TIMEZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                          {pendingAddress?.status === 'pending' && (
                            <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                              Address change pending admin approval
                              {pendingAddress.city ? `: ${[pendingAddress.street_address, pendingAddress.city, pendingAddress.state, pendingAddress.zip].filter(Boolean).join(', ')}` : '.'}
                            </div>
                          )}
                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Street Address</FormLabel>
                                <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl><Input placeholder="City" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State</FormLabel>
                                  <FormControl><Input placeholder="State" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="zip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ZIP Code</FormLabel>
                                  <FormControl><Input placeholder="ZIP" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Travel Range slider with miles/km toggle */}
                          <FormField
                            control={form.control}
                            name="travelRange"
                            render={({ field }) => {
                              const unit = form.watch('travelRangeUnit');
                              return (
                                <FormItem className="rounded-md border p-4">
                                  <div className="flex items-center justify-between">
                                    <FormLabel className="!m-0">Travel Range</FormLabel>
                                    <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
                                      {(['miles', 'km'] as const).map((u) => (
                                        <button
                                          key={u}
                                          type="button"
                                          onClick={() => form.setValue('travelRangeUnit', u)}
                                          className={cn(
                                            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                            unit === u
                                              ? 'bg-primary text-primary-foreground shadow-sm'
                                              : 'text-muted-foreground hover:text-foreground',
                                          )}
                                        >
                                          {u === 'miles' ? 'Miles' : 'Km'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <FormDescription>How far you're willing to travel from your address for shoots</FormDescription>
                                  <FormControl>
                                    <Slider
                                      min={1}
                                      max={100}
                                      step={1}
                                      value={[Number(field.value) || 25]}
                                      onValueChange={(v) => field.onChange(v[0])}
                                      className="pt-2"
                                    />
                                  </FormControl>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>1 {unit}</span>
                                    <span className="text-sm font-semibold text-foreground">{Number(field.value) || 25} {unit}</span>
                                    <span>100 {unit}</span>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                  </CardContent>
                </Card>
            {/* Business / Documents card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Shoot & invoicing preferences</CardTitle>
                <CardDescription>Choose defaults for new shoots and weekly payment summaries.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="weeklyInvoice"
                  render={({ field }) => (
                    <div className="flex items-center justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="weeklyInvoice">Weekly Invoice</Label>
                        <p className="text-sm text-muted-foreground">Receive weekly payment summaries</p>
                      </div>
                      <Switch
                        id="weeklyInvoice"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
                <DefaultBracketModeField control={form.control} />
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Work Settings'}
                </Button>
              </CardFooter>
            </Card>

        </form>
      </Form>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Tax & license documents</CardTitle>
          <CardDescription>Upload and manage your required documents. Uploads save separately.</CardDescription>
        </CardHeader>
        <CardContent><TaxDocumentCard key={user?.id} /></CardContent>
      </Card>
    </div>
  );
}

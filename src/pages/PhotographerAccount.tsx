import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useResendVerificationEmail } from '@/hooks/useResendVerificationEmail';
import { canResendUserVerification } from '@/utils/emailHealth';
import { Bell, CalendarDays, Camera, ExternalLink, Eye, Settings, ShieldCheck, User, Wrench } from 'lucide-react';
import { ImageUpload } from '@/components/profile/ImageUpload';
import { EquipmentVerificationDialog } from '@/components/equipment/EquipmentVerificationDialog';
import {
  equipmentStatusLabel,
  listMyPhotographerEquipments,
  type PhotographerEquipment,
  uploadPhotographerVerificationPhotos,
} from '@/services/photographerEquipmentService';
import {
  personalInfoSchema,
  type PersonalInfoFormValues,
} from '@/pages/photographerAccountSchemas';
import {
  PhotographerNotificationPreferencesForm,
  PhotographerSpecialtiesForm,
} from '@/components/profile/PhotographerPreferenceForms';
import { ProfileActivityCard } from '@/components/profile/ProfileActivityCard';
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard';

import { PhotographerWorkSettings } from '@/components/profile/PhotographerWorkSettings';
import { resolvePhotographerAccountTab } from '@/pages/photographerAccountNavigation';
import { getOnboardingConfig } from '@/features/dashboard/config/dashboardOnboardingConfig';
import { requestDashboardOnboardingReplay } from '@/lib/dashboardOnboardingEvents';

const PhotographerAccount = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const {
    preferences: displayPreferences,
    setTemperatureUnit,
    setTimeFormat,
  } = useUserPreferences();
  const { saveProfile } = useSelfProfileSave();
  const { isResendingVerification, resendVerification, resendFeedback } = useResendVerificationEmail();
  const canResendVerification = canResendUserVerification(undefined, user ?? {});
  const userMetadata = (user?.metadata as Record<string, unknown> | undefined) ?? {};
  const savedPreferences = userMetadata.preferences && typeof userMetadata.preferences === 'object'
    ? userMetadata.preferences as Record<string, unknown>
    : {};
  const onboarding = savedPreferences[getOnboardingConfig('photographer').onboardingKey] as { eligible?: boolean } | undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolvePhotographerAccountTab(searchParams);
  const [equipments, setEquipments] = useState<PhotographerEquipment[]>([]);
  const [isEquipmentLoading, setIsEquipmentLoading] = useState(false);
  const [equipmentLoadFailed, setEquipmentLoadFailed] = useState(false);
  const [equipmentUploads, setEquipmentUploads] = useState<Record<number, File[]>>({});
  const [uploadingEquipmentId, setUploadingEquipmentId] = useState<number | null>(null);
  const [verificationEquipment, setVerificationEquipment] = useState<PhotographerEquipment | null>(null);
  const verificationSearchParams = searchParams;
  const expectedPhotographerId = verificationSearchParams?.get('photographer_id') || verificationSearchParams?.get('photographer');
  const isEquipmentVerificationLink = activeTab === 'equipments';
  const isWrongEquipmentVerificationAccount = isEquipmentVerificationLink
    && (user?.role !== 'photographer' || Boolean(expectedPhotographerId && String(user?.id) !== expectedPhotographerId));

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete('verify');
    params.set('tab', value);
    setSearchParams(params, { replace: true });
  };

  const fetchEquipments = useCallback(async () => {
    setIsEquipmentLoading(true);
    setEquipmentLoadFailed(false);
    try {
      const data = await listMyPhotographerEquipments();
      setEquipments(data);
    } catch (error) {
      setEquipmentLoadFailed(true);
      console.error('Failed to load photographer equipments', error);
      toast({
        title: 'Unable to load equipment',
        description: 'Please refresh and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsEquipmentLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'equipments' && user?.role === 'photographer' && !isWrongEquipmentVerificationAccount) {
      fetchEquipments();
    }
  }, [activeTab, fetchEquipments, isWrongEquipmentVerificationAccount, user?.id, user?.role]);

  const handleEquipmentVerificationUpload = async (equipmentId: number) => {
    const photos = equipmentUploads[equipmentId] || [];
    if (photos.length === 0) {
      toast({
        title: 'Choose photos first',
        description: 'Select at least one verification photo before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingEquipmentId(equipmentId);
    try {
      const updated = await uploadPhotographerVerificationPhotos(equipmentId, photos);
      setEquipments((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setEquipmentUploads((uploads) => ({ ...uploads, [equipmentId]: [] }));
      toast({ title: 'Verification submitted', description: 'Admin review can now approve this equipment.' });
    } catch (error) {
      console.error('Failed to upload equipment verification photos', error);
      toast({
        title: 'Upload failed',
        description: 'Please try again with image files under 10 MB.',
        variant: 'destructive',
      });
    } finally {
      setUploadingEquipmentId(null);
    }
  };

  // Form for personal info
  const personalInfoForm = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.company || '',
      bio: String(savedPreferences.bio ?? user?.bio ?? ''),
      portfolioWebsite: String(savedPreferences.portfolioWebsite ?? ''),
      currentPassword: '',
    },
  });

  const onPersonalInfoSubmit = async (data: PersonalInfoFormValues) => {
    try {
      const result = await saveProfile({
        name: data.name,
        email: data.email,
        current_password: data.email !== user?.email ? data.currentPassword : undefined,
        phone_number: data.phone,
        company_name: data.company || null,
        bio: data.bio || null,
        preferences: {
          bio: data.bio || null,
          portfolioWebsite: data.portfolioWebsite || null,
        },
      });
      personalInfoForm.setValue('currentPassword', '');
      if (!result.reauthRequired) {
        toast({
          title: 'Profile updated',
          description: result.message || 'Your personal information has been updated successfully.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile.',
        variant: 'destructive',
      });
    }
  };

  // Handle profile image change — ImageUpload handles the actual upload to the
  // backend; we just surface a confirmation toast here.
  const handleProfileImageChange = (_url: string) => {
    toast({
      title: 'Profile photo updated',
      description: 'Your profile photo has been updated successfully.',
    });
  };

  if (isWrongEquipmentVerificationAccount) {
    return (
      <DashboardLayout>
        <div className="container max-w-3xl py-6">
          <Card>
            <CardHeader>
              <CardTitle>Sign in as the assigned photographer</CardTitle>
              <CardDescription>
                This Verify Equipment link is for a photographer account. You are currently signed in as {user?.name || 'another user'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please log out, then sign in with the photographer account that received the equipment verification email.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={logout}>
                  Log Out
                </Button>
                <Button type="button" variant="outline" onClick={() => window.location.assign('/profile')}>
                  Open My Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-20 sm:space-y-6 sm:p-6 sm:pb-6">
        <PageHeader
          title="My Account"
          description="Your profile, work preferences, equipment, and account security in one place."
          action={
            <div className="flex flex-wrap gap-2">
              {onboarding?.eligible && (
                <Button asChild variant="outline">
                  <Link to="/dashboard" onClick={() => requestDashboardOnboardingReplay('photographer')}>Replay dashboard tour</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/availability"><CalendarDays className="mr-2 h-4 w-4" />Manage Availability</Link>
              </Button>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList aria-label="Photographer account sections" className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            {[
              { value: 'personal', icon: User, label: 'Profile' },
              { value: 'work', icon: Settings, label: 'Work settings' },
              { value: 'specialties', icon: Camera, label: 'Specialties' },
              { value: 'equipments', icon: Wrench, label: 'Equipment' },
              { value: 'notifications', icon: Bell, label: 'Notifications' },
              { value: 'security', icon: ShieldCheck, label: 'Security' },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value} className="gap-2 rounded-full bg-muted px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="space-y-4">
            {/* Profile picture + identity badge (matches Settings.tsx pattern) */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="shrink-0">
                    <ImageUpload
                      onChange={handleProfileImageChange}
                      initialImage={user?.avatar}
                      className="h-24 w-24"
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
                    <h2 className="text-xl font-semibold truncate">{user?.name || 'Your Name'}</h2>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      Photographer
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Form {...personalInfoForm}>
              <form onSubmit={personalInfoForm.handleSubmit(onPersonalInfoSubmit)} className="space-y-4">
                {/* Personal Information card */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Personal Information</CardTitle>
                    <CardDescription>Your name and how clients reach you</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField
                              control={personalInfoForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name</FormLabel>
                                  <FormControl><Input placeholder="Enter your full name" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalInfoForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
                                  <FormDescription>Changing this requires your current password.</FormDescription>
                                  {canResendVerification && (
                                    <div className="mt-2 space-y-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void resendVerification()}
                                        disabled={isResendingVerification}
                                      >
                                        {isResendingVerification ? 'Sending...' : 'Resend verification email'}
                                      </Button>
                                      {resendFeedback && (
                                        <p className={`text-sm ${resendFeedback.ok ? 'text-emerald-700' : 'text-destructive'}`}>
                                          {resendFeedback.message}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalInfoForm.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone Number</FormLabel>
                                  <FormControl><Input placeholder="(123) 456-7890" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalInfoForm.control}
                              name="company"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Company</FormLabel>
                                  <FormControl><Input placeholder="Your company name" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalInfoForm.control}
                              name="portfolioWebsite"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Portfolio Website</FormLabel>
                                  <FormControl>
                                    <div className="flex">
                                      <Input placeholder="https://your-portfolio.com" {...field} className="rounded-r-none" />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-l-none"
                                        disabled={!field.value}
                                        onClick={() => field.value && window.open(String(field.value), '_blank')}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={personalInfoForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl><Input type="password" placeholder="Required only if you change your email" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={personalInfoForm.control}
                            name="bio"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bio</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Tell us a bit about yourself and your photography experience..."
                                    className="min-h-[100px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button type="submit" disabled={personalInfoForm.formState.isSubmitting}>
                    {personalInfoForm.formState.isSubmitting ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
                  
          {/* Specialties Tab */}
          <TabsContent value="specialties" className="space-y-4">
            <PhotographerSpecialtiesForm />
          </TabsContent>
                  
                  {/* Equipments Tab */}
                  <TabsContent value="equipments">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Review equipment assigned by your admin and upload photos when verification is requested.</p>
                      {isEquipmentLoading ? (
                        <div className="rounded-md border p-6 text-sm text-muted-foreground">Loading equipment...</div>
                      ) : equipmentLoadFailed ? (
                        <div className="space-y-3 rounded-md border p-6">
                          <p className="text-sm text-destructive">Equipment could not be loaded. Please try again.</p>
                          <Button type="button" variant="outline" onClick={() => void fetchEquipments()}>Retry</Button>
                        </div>
                      ) : equipments.length === 0 ? (
                        <div className="rounded-md border p-6 text-sm text-muted-foreground">No equipment is assigned to you. There is nothing to verify. Assigned equipment will appear here.</div>
                      ) : (
                        equipments.map((equipment) => {
                          const referencePhotos = equipment.photos.filter((photo) => photo.type === 'admin_reference');
                          const verificationPhotos = equipment.photos.filter((photo) => photo.type === 'photographer_verification');
                          const selectedFiles = equipmentUploads[equipment.id] || [];

                          return (
                            <Card key={equipment.id} className="border-border/70">
                              <CardHeader className="space-y-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <CardTitle className="text-lg">{equipment.name}</CardTitle>
                                    <CardDescription>
                                      {equipment.serial_number ? `Serial ${equipment.serial_number}` : 'No serial number'}{equipment.issue_date ? ` · Issued ${equipment.issue_date}` : ''}
                                    </CardDescription>
                                  </div>
                                  <Badge variant={equipment.status === 'verified' ? 'default' : equipment.status === 'rejected' ? 'destructive' : 'outline'}>
                                    {equipmentStatusLabel(equipment.status)}
                                  </Badge>
                                </div>
                                {equipment.rejection_reason && (
                                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                    {equipment.rejection_reason}
                                  </div>
                                )}
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <h4 className="text-sm font-medium">Equipment Images</h4>
                                      <p className="text-xs text-muted-foreground">
                                        {verificationPhotos.length} verification · {referencePhotos.length} admin reference
                                      </p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setVerificationEquipment(equipment)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View images
                                    </Button>
                                  </div>
                                </div>

                                {equipment.status !== 'verified' && (
                                  <div className="rounded-md border bg-muted/30 p-3">
                                    <div className="grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end">
                                      <div className="space-y-1.5">
                                        <label className="text-sm font-medium leading-none text-foreground">
                                          Upload Verification Photos
                                        </label>
                                        <Input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          onChange={(event) => setEquipmentUploads((uploads) => ({
                                            ...uploads,
                                            [equipment.id]: Array.from(event.target.files || []),
                                          }))}
                                        />
                                        {selectedFiles.length > 0 && (
                                          <p className="text-xs text-muted-foreground">
                                            {selectedFiles.length} photo{selectedFiles.length === 1 ? '' : 's'} selected
                                          </p>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => handleEquipmentVerificationUpload(equipment.id)}
                                        disabled={uploadingEquipmentId === equipment.id}
                                      >
                                        {uploadingEquipmentId === equipment.id ? 'Uploading...' : 'Submit'}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>

          <TabsContent value="work" className="space-y-4">
            <PhotographerWorkSettings key={user?.id} />

            {/* Display preferences card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Display</CardTitle>
                <CardDescription>How times and temperatures appear across the dashboard. Changes save automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="timeFormat">24-Hour Time</Label>
                    <p className="text-sm text-muted-foreground">
                      {displayPreferences.timeFormat === '24h' ? '24-hour format (14:30)' : '12-hour format (2:30 PM)'}
                    </p>
                  </div>
                  <Switch
                    id="timeFormat"
                    checked={displayPreferences.timeFormat === '24h'}
                    onCheckedChange={(checked) => setTimeFormat(checked ? '24h' : '12h')}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="temperatureUnit">Temperature in Celsius</Label>
                    <p className="text-sm text-muted-foreground">
                      {displayPreferences.temperatureUnit === 'celsius' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}
                    </p>
                  </div>
                  <Switch
                    id="temperatureUnit"
                    checked={displayPreferences.temperatureUnit === 'celsius'}
                    onCheckedChange={(checked) => setTemperatureUnit(checked ? 'celsius' : 'fahrenheit')}
                  />
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <PhotographerNotificationPreferencesForm />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <ProfileActivityCard />
              <ProfileSecurityCard />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EquipmentVerificationDialog
        equipment={verificationEquipment}
        open={Boolean(verificationEquipment)}
        onOpenChange={(open) => {
          if (!open) setVerificationEquipment(null);
        }}
        viewerLabel="photographer"
      />

    </DashboardLayout>
  );
};

export default PhotographerAccount;

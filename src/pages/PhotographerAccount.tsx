import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { API_BASE_URL } from '@/config/env';
import { Camera, ExternalLink, Eye, FileText, Settings, Upload, User, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/profile/ImageUpload';
import {
  equipmentStatusLabel,
  listMyPhotographerEquipments,
  openEquipmentPhoto,
  type PhotographerEquipment,
  uploadPhotographerVerificationPhotos,
} from '@/services/photographerEquipmentService';

// Define form schemas
const personalInfoSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().min(10, { message: 'Please enter a valid phone number.' }),
  bio: z.string().optional(),
  portfolioWebsite: z.string().optional().or(z.literal('')),
  currentPassword: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zip: z.string().optional().or(z.literal('')),
  travelRange: z.number().min(1).max(500),
  travelRangeUnit: z.enum(['miles', 'km']),
  weeklyInvoice: z.boolean(),
});

const specialtiesSchema = z.object({
  specialties: z.array(z.string()).min(1, { message: 'Please select at least one specialty.' }),
});

const notificationsSchema = z.object({
  email_notifications: z.boolean().default(true),
  sms_notifications: z.boolean().default(true),
});

type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;
type SpecialtiesFormValues = z.infer<typeof specialtiesSchema>;
type NotificationsFormValues = z.infer<typeof notificationsSchema>;

const PhotographerAccount = () => {
  const { user, setUser, logout } = useAuth();
  const { toast } = useToast();
  const {
    preferences: displayPreferences,
    setTemperatureUnit,
    setTimeFormat,
  } = useUserPreferences();
  const { saveProfile } = useSelfProfileSave();

  // Pull values previously stored on user.metadata so we can hydrate the form.
  const userMetadata = (user?.metadata as Record<string, unknown> | undefined) ?? {};
  const savedPreferences = ((user?.metadata as Record<string, any> | undefined)?.preferences ?? {}) as Record<string, any>;
  const taxInfoSubmitted = Boolean(userMetadata.tax_document_submitted_at || userMetadata.tax_document_url);
  const taxDocumentName = String(userMetadata.tax_document_name ?? '');
  const taxSubmittedAt = String(userMetadata.tax_document_submitted_at ?? '');

  // Tax / license document upload state.
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [selectedTaxDocument, setSelectedTaxDocument] = useState<File | null>(null);
  const [taxNotes, setTaxNotes] = useState('');
  const [isTaxSubmitting, setIsTaxSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'personal';
    return new URLSearchParams(window.location.search).get('tab') || 'personal';
  });
  const [equipments, setEquipments] = useState<PhotographerEquipment[]>([]);
  const [isEquipmentLoading, setIsEquipmentLoading] = useState(false);
  const [equipmentUploads, setEquipmentUploads] = useState<Record<number, File[]>>({});
  const [uploadingEquipmentId, setUploadingEquipmentId] = useState<number | null>(null);
  const verificationSearchParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
  const expectedPhotographerId = verificationSearchParams?.get('photographer_id') || verificationSearchParams?.get('photographer');
  const isEquipmentVerificationLink = verificationSearchParams?.get('verify') === 'equipment' || verificationSearchParams?.get('tab') === 'equipments';
  const isWrongEquipmentVerificationAccount = isEquipmentVerificationLink
    && (user?.role !== 'photographer' || Boolean(expectedPhotographerId && String(user?.id) !== expectedPhotographerId));

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (value === 'personal') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', value);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const fetchEquipments = async () => {
    setIsEquipmentLoading(true);
    try {
      const data = await listMyPhotographerEquipments();
      setEquipments(data);
    } catch (error) {
      console.error('Failed to load photographer equipments', error);
      toast({
        title: 'Unable to load equipments',
        description: 'Please refresh and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsEquipmentLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'equipments' && user?.role === 'photographer' && !isWrongEquipmentVerificationAccount) {
      fetchEquipments();
    }
  }, [activeTab, isWrongEquipmentVerificationAccount, user?.role]);

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
      bio: String(savedPreferences.bio ?? ''),
      portfolioWebsite: String(savedPreferences.portfolioWebsite ?? ''),
      currentPassword: '',
      address: user?.address || '',
      city: user?.city || '',
      state: user?.state || '',
      zip: user?.zipcode || '',
      travelRange: Number(userMetadata.travel_range ?? 25),
      travelRangeUnit: (userMetadata.travel_range_unit as 'miles' | 'km') ?? 'miles',
      weeklyInvoice: savedPreferences.weeklyInvoice ?? true,
    },
  });

  // Form for specialties
  const specialtiesForm = useForm<SpecialtiesFormValues>({
    resolver: zodResolver(specialtiesSchema),
    defaultValues: {
      specialties: ['Residential', 'Commercial'],
    },
  });
  
  // Form for notification preferences
  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      email_notifications: true,
      sms_notifications: true,
    },
  });

  const onPersonalInfoSubmit = async (data: PersonalInfoFormValues) => {
    try {
      const result = await saveProfile({
        name: data.name,
        email: data.email,
        current_password: data.email !== user?.email ? data.currentPassword : undefined,
        phone_number: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        travel_range: data.travelRange,
        travel_range_unit: data.travelRangeUnit,
        preferences: {
          bio: data.bio || null,
          portfolioWebsite: data.portfolioWebsite || null,
          weeklyInvoice: data.weeklyInvoice,
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

  const handleTaxDocumentSubmit = async () => {
    if (!selectedTaxDocument) {
      toast({ title: 'Choose a document', description: 'Please select a file to upload.', variant: 'destructive' });
      return;
    }
    setIsTaxSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const payload = new FormData();
      payload.append('document', selectedTaxDocument);
      if (taxNotes.trim()) payload.append('notes', taxNotes.trim());

      const response = await fetch(`${API_BASE_URL}/api/profile/tax-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to submit document');

      if (data.user && user) {
        setUser({ ...user, ...data.user });
      }
      setSelectedTaxDocument(null);
      setTaxNotes('');
      setTaxDialogOpen(false);
      toast({ title: 'Document submitted', description: 'Your document has been uploaded successfully.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload document.',
        variant: 'destructive',
      });
    } finally {
      setIsTaxSubmitting(false);
    }
  };

  const onSpecialtiesSubmit = (data: SpecialtiesFormValues) => {
    console.log('Updating specialties:', data);
    
    toast({
      title: 'Specialties updated',
      description: 'Your photography specialties have been updated successfully.',
    });
  };

  const onNotificationsSubmit = (data: NotificationsFormValues) => {
    console.log('Updating notification preferences:', data);
    
    toast({
      title: 'Preferences updated',
      description: 'Your notification preferences have been updated successfully.',
    });
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
          title="Settings"
          description="Manage your photographer profile and preferences"
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <AutoExpandingTabsList
            tabs={[
              { value: 'personal', icon: User, label: 'Personal Info' },
              { value: 'specialties', icon: Camera, label: 'Specialties' },
              { value: 'equipments', icon: Wrench, label: 'Equipments' },
              { value: 'notifications', icon: Settings, label: 'Preferences' },
            ]}
            value={activeTab}
            className="mb-6"
          />
                  
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

                {/* Location card */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Location</CardTitle>
                    <CardDescription>Used to assign you nearby shoots</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                          <FormField
                            control={personalInfoForm.control}
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
                              control={personalInfoForm.control}
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
                              control={personalInfoForm.control}
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
                              control={personalInfoForm.control}
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
                            control={personalInfoForm.control}
                            name="travelRange"
                            render={({ field }) => {
                              const unit = personalInfoForm.watch('travelRangeUnit');
                              return (
                                <FormItem className="rounded-md border p-4">
                                  <div className="flex items-center justify-between">
                                    <FormLabel className="!m-0">Travel Range</FormLabel>
                                    <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
                                      {(['miles', 'km'] as const).map((u) => (
                                        <button
                                          key={u}
                                          type="button"
                                          onClick={() => personalInfoForm.setValue('travelRangeUnit', u)}
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
                  <CardFooter className="border-t pt-4 flex justify-end">
                    <Button type="submit">Save Changes</Button>
                  </CardFooter>
                </Card>
              </form>
            </Form>
          </TabsContent>
                  
          {/* Specialties Tab */}
          <TabsContent value="specialties" className="space-y-4">
            <Form {...specialtiesForm}>
              <form onSubmit={specialtiesForm.handleSubmit(onSpecialtiesSubmit)} className="space-y-4">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Photography Services</CardTitle>
                    <CardDescription>Select all the services you provide as a photographer</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {['Residential', 'Commercial', 'Aerial', 'Virtual Tour', 'Twilight', 'HDR', 'Floor Plans', 'Video', '3D Tour'].map((specialty) => (
                        <div key={specialty} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`specialty-${specialty}`}
                            value={specialty}
                            onChange={(e) => {
                              const currentSpecialties = specialtiesForm.getValues().specialties;
                              if (e.target.checked) {
                                specialtiesForm.setValue('specialties', [...currentSpecialties, specialty]);
                              } else {
                                specialtiesForm.setValue(
                                  'specialties',
                                  currentSpecialties.filter((s) => s !== specialty)
                                );
                              }
                            }}
                            checked={specialtiesForm.watch('specialties').includes(specialty)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label htmlFor={`specialty-${specialty}`} className="text-sm">{specialty}</label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Property Types</CardTitle>
                    <CardDescription>Select the types of properties you're comfortable shooting</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {['Single Family', 'Multi-Family', 'Condo/Townhouse', 'Apartment', 'Vacant Land', 'Office', 'Retail', 'Industrial'].map((propertyType) => (
                        <div key={propertyType} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`property-${propertyType}`}
                            value={propertyType}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label htmlFor={`property-${propertyType}`} className="text-sm">{propertyType}</label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-end">
                    <Button type="submit">Save Specialties</Button>
                  </CardFooter>
                </Card>
              </form>
            </Form>
          </TabsContent>
                  
                  {/* Equipments Tab */}
                  <TabsContent value="equipments">
                    <div className="space-y-4">
                      {isEquipmentLoading ? (
                        <div className="rounded-md border p-6 text-sm text-muted-foreground">Loading equipments...</div>
                      ) : equipments.length === 0 ? (
                        <div className="rounded-md border p-6 text-sm text-muted-foreground">No equipments assigned.</div>
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
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Admin Reference Photos</h4>
                                    {referencePhotos.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No reference photos uploaded.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {referencePhotos.map((photo) => (
                                          <Button key={photo.id} type="button" variant="outline" size="sm" onClick={() => openEquipmentPhoto(photo)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            {photo.original_name || 'View photo'}
                                          </Button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Your Verification Photos</h4>
                                    {verificationPhotos.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No verification photos submitted.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {verificationPhotos.map((photo) => (
                                          <Button key={photo.id} type="button" variant="outline" size="sm" onClick={() => openEquipmentPhoto(photo)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            {photo.original_name || 'View photo'}
                                          </Button>
                                        ))}
                                      </div>
                                    )}
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

          {/* Preferences Tab */}
          <TabsContent value="notifications" className="space-y-4">
            {/* Business / Documents card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Business</CardTitle>
                <CardDescription>Invoicing preferences and required documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={personalInfoForm.control}
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
                <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="taxInfo" className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Tax / License Document
                    </Label>
                    <p className="text-sm text-muted-foreground">W-9, business license, or equivalent documentation</p>
                    {taxDocumentName && (
                      <p className="text-xs text-muted-foreground">
                        {taxDocumentName}
                        {taxSubmittedAt ? ` • Submitted ${new Date(taxSubmittedAt).toLocaleDateString()}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={taxInfoSubmitted ? 'outline' : 'destructive'}>
                      {taxInfoSubmitted ? 'Submitted' : 'Required'}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant={taxInfoSubmitted ? 'outline' : 'default'}
                      onClick={() => setTaxDialogOpen(true)}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {taxInfoSubmitted ? 'Update' : 'Upload'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The Weekly Invoice toggle is saved with your profile. Use the Save Changes button on the Personal Info tab.
                </p>
              </CardContent>
            </Card>

            {/* Display preferences card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Display</CardTitle>
                <CardDescription>How dates, times, and temperatures appear across the dashboard</CardDescription>
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

            {/* Notifications card */}
            <Form {...notificationsForm}>
              <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)}>
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Notifications</CardTitle>
                    <CardDescription>Choose how you want to be notified about new shoots and updates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="emailNotifications">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive updates via email</p>
                      </div>
                      <Switch
                        id="emailNotifications"
                        checked={notificationsForm.watch('email_notifications')}
                        onCheckedChange={(checked) => notificationsForm.setValue('email_notifications', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="smsNotifications">SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive text messages for urgent updates</p>
                      </div>
                      <Switch
                        id="smsNotifications"
                        checked={notificationsForm.watch('sms_notifications')}
                        onCheckedChange={(checked) => notificationsForm.setValue('sms_notifications', checked)}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-end">
                    <Button type="submit">Save Notifications</Button>
                  </CardFooter>
                </Card>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>

      {/* Tax / License document upload dialog */}
      <Dialog open={taxDialogOpen} onOpenChange={(open) => {
        setTaxDialogOpen(open);
        if (!open) {
          setSelectedTaxDocument(null);
          setTaxNotes('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Tax / License Document</DialogTitle>
            <DialogDescription>
              W-9, business license, or any equivalent documentation. PDF, PNG, or JPG up to 10 MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tax-doc-file">Document</Label>
              <Input
                id="tax-doc-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setSelectedTaxDocument(e.target.files?.[0] ?? null)}
              />
              {selectedTaxDocument && (
                <p className="text-xs text-muted-foreground">
                  {selectedTaxDocument.name} · {(selectedTaxDocument.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-doc-notes">Notes (optional)</Label>
              <Textarea
                id="tax-doc-notes"
                value={taxNotes}
                onChange={(e) => setTaxNotes(e.target.value)}
                placeholder="Anything we should know about this document"
                className="min-h-[72px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaxDialogOpen(false)} disabled={isTaxSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleTaxDocumentSubmit} disabled={isTaxSubmitting || !selectedTaxDocument}>
              {isTaxSubmitting ? 'Uploading…' : 'Upload Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PhotographerAccount;

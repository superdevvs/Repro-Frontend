import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useShoots } from '@/context/ShootsContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Camera, CameraIcon, CreditCard, Eye, MapPin, Phone, Settings, Upload, User, UserIcon, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { ShootsDialogs } from '@/components/dashboard/ShootsDialogs';
import { ShootData } from '@/types/shoots';
import { ImageUpload } from '@/components/profile/ImageUpload';
import API_ROUTES from '@/lib/api';
import { GoogleCalendarStatusBadge } from '@/components/integrations/GoogleCalendarStatusBadge';
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
  location: z.string().min(2, { message: 'Please enter your location.' }),
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

type GoogleCalendarStatus = {
  available: boolean;
  connected: boolean;
  provider_email?: string | null;
  calendar_id?: string | null;
  sync_enabled: boolean;
  last_synced_at?: string | null;
  last_error?: string | null;
};

const getStoredToken = () =>
  window.localStorage.getItem('authToken') ||
  window.localStorage.getItem('token') ||
  window.localStorage.getItem('access_token');

const buildAuthHeaders = () => {
  const token = getStoredToken();

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const PhotographerAccount = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { shoots, updateShoot } = useShoots();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'personal';
    return new URLSearchParams(window.location.search).get('tab') || 'personal';
  });
  const [selectedShoot, setSelectedShoot] = useState<ShootData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string>(user?.avatar || '');
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus>({
    available: true,
    connected: false,
    sync_enabled: false,
  });
  const [isGoogleCalendarLoading, setIsGoogleCalendarLoading] = useState(true);
  const [googleCalendarAction, setGoogleCalendarAction] = useState<'connect' | 'disconnect' | 'resync' | null>(null);
  const [equipments, setEquipments] = useState<PhotographerEquipment[]>([]);
  const [isEquipmentLoading, setIsEquipmentLoading] = useState(false);
  const [equipmentUploads, setEquipmentUploads] = useState<Record<number, File[]>>({});
  const [uploadingEquipmentId, setUploadingEquipmentId] = useState<number | null>(null);

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

  // Filter shoots by this photographer
  const photographerShoots = shoots.filter(shoot => 
    user && shoot.photographer.name === user.name
  );
  
  // Stats
  const completedShootsCount = photographerShoots.filter(shoot => shoot.status === 'completed').length;
  const scheduledShootsCount = photographerShoots.filter(shoot => shoot.status === 'scheduled').length;
  const totalEarnings = photographerShoots
    .filter(shoot => shoot.status === 'completed')
    .reduce((sum, shoot) => sum + shoot.payment.totalPaid || 0, 0);
  
  // Most recent shoots
  const recentShoots = [...photographerShoots]
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
    .slice(0, 5);
  
  // Filter completed shoots
  const completedShoots = photographerShoots.filter(shoot => shoot.status === 'completed');

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
    if (activeTab === 'equipments') {
      fetchEquipments();
    }
  }, [activeTab]);

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

  // Handle opening upload dialog
  const handleUploadMedia = (shoot: ShootData) => {
    setSelectedShoot(shoot);
    setIsUploadDialogOpen(true);
  };

  // Handle upload complete
  const handleUploadComplete = (files: File[]) => {
    if (!selectedShoot) return;
    
    // Sample demo images from Unsplash for demonstration
    const demoImages = [
      "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=800&q=80",
      "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80",
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80",
    ];
    
    // Create valid image URLs from demo images for testing purposes
    const photoUrls = files
      .filter(file => file.type.startsWith('image/'))
      .map((_, index) => {
        // Use Unsplash demo images that actually load
        return demoImages[index % demoImages.length];
      });
    
    updateShoot(selectedShoot.id, {
      media: {
        ...selectedShoot.media,
        photos: [...(selectedShoot.media?.photos || []), ...photoUrls]
      }
    });
    
    setIsUploadDialogOpen(false);
    toast({
      title: "Upload Complete",
      description: `${files.length} files have been uploaded successfully.`
    });
  };

  // Form for personal info
  const personalInfoForm = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: '',
      location: '',
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

  const onPersonalInfoSubmit = (data: PersonalInfoFormValues) => {
    console.log('Updating personal info:', data);
    
    // In a real app, you would update the user's profile in the database
    toast({
      title: 'Profile updated',
      description: 'Your personal information has been updated successfully.',
    });
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

  // Handle profile image change
  const handleProfileImageChange = (url: string) => {
    setProfileImage(url);
    toast({
      title: 'Profile photo updated',
      description: 'Your profile photo has been updated successfully.',
    });
  };

  const fetchGoogleCalendarStatus = async () => {
    setIsGoogleCalendarLoading(true);

    try {
      const response = await fetch(API_ROUTES.googleCalendar.status, {
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Unable to load Google Calendar status.');
      }

      const payload = await response.json();
      setGoogleCalendarStatus(payload.data);
    } catch (error) {
      setGoogleCalendarStatus({
        available: false,
        connected: false,
        sync_enabled: false,
        last_error: error instanceof Error ? error.message : 'Unable to load Google Calendar status.',
      });
    } finally {
      setIsGoogleCalendarLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleCalendarStatus();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const googleCalendarState = url.searchParams.get('google_calendar');
    const message = url.searchParams.get('message');

    if (!googleCalendarState) {
      return;
    }

    if (googleCalendarState === 'connected') {
      toast({
        title: 'Google Calendar connected',
        description: 'New and updated shoots will now sync to your primary Google Calendar.',
      });
    } else if (googleCalendarState === 'error') {
      toast({
        title: 'Google Calendar connection failed',
        description: message || 'We could not connect your Google Calendar.',
        variant: 'destructive',
      });
    }

    url.searchParams.delete('google_calendar');
    url.searchParams.delete('message');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    fetchGoogleCalendarStatus();
  }, [toast]);

  const handleGoogleCalendarConnect = async () => {
    setGoogleCalendarAction('connect');

    try {
      const response = await fetch(API_ROUTES.googleCalendar.connect, {
        method: 'POST',
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Unable to start Google Calendar connection.');
      }

      const payload = await response.json();
      const authorizationUrl = payload?.data?.authorization_url;

      if (!authorizationUrl) {
        throw new Error('Google Calendar authorization URL was not returned.');
      }

      window.location.assign(authorizationUrl);
    } catch (error) {
      toast({
        title: 'Google Calendar connection failed',
        description: error instanceof Error ? error.message : 'Unable to start Google Calendar connection.',
        variant: 'destructive',
      });
      setGoogleCalendarAction(null);
    }
  };

  const handleGoogleCalendarDisconnect = async () => {
    setGoogleCalendarAction('disconnect');

    try {
      const response = await fetch(API_ROUTES.googleCalendar.disconnect, {
        method: 'DELETE',
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Unable to disconnect Google Calendar.');
      }

      toast({
        title: 'Google Calendar disconnected',
        description: 'Shoot sync to Google Calendar has been turned off.',
      });
      await fetchGoogleCalendarStatus();
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : 'Unable to disconnect Google Calendar.',
        variant: 'destructive',
      });
    } finally {
      setGoogleCalendarAction(null);
    }
  };

  const handleGoogleCalendarResync = async () => {
    setGoogleCalendarAction('resync');

    try {
      const response = await fetch(API_ROUTES.googleCalendar.resync, {
        method: 'POST',
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Unable to start Google Calendar resync.');
      }

      toast({
        title: 'Google Calendar resync started',
        description: 'We are refreshing your synced shoot events now.',
      });
      await fetchGoogleCalendarStatus();
    } catch (error) {
      toast({
        title: 'Resync failed',
        description: error instanceof Error ? error.message : 'Unable to start Google Calendar resync.',
        variant: 'destructive',
      });
    } finally {
      setGoogleCalendarAction(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="container max-w-5xl py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left side - Profile summary */}
          <div className="lg:w-1/3 space-y-6">
            {/* Profile card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Photographer Profile</CardTitle>
                <CardDescription>Manage your account details</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center text-center pt-4">
                <ImageUpload 
                  onChange={handleProfileImageChange}
                  initialImage={user?.avatar}
                  className="h-24 w-24 mb-4"
                />
                
                <h3 className="text-xl font-bold">{user?.name || 'Photographer'}</h3>
                <p className="text-sm text-muted-foreground mb-4">{user?.email || 'email@example.com'}</p>
                
                <div className="w-full border-t pt-4 mt-2">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      Location:
                    </span>
                    <span>New York, NY</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      Phone:
                    </span>
                    <span>{user?.phone || 'Not provided'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center">
                      <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                      Member since:
                    </span>
                    <span>Jan 2023</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Stats card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-md p-4 text-center">
                    <p className="text-2xl font-bold">{completedShootsCount}</p>
                    <p className="text-sm text-muted-foreground">Completed shoots</p>
                  </div>
                  <div className="border rounded-md p-4 text-center">
                    <p className="text-2xl font-bold">{scheduledShootsCount}</p>
                    <p className="text-sm text-muted-foreground">Upcoming</p>
                  </div>
                  <div className="border rounded-md p-4 text-center col-span-2">
                    <p className="text-2xl font-bold">${totalEarnings.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total earnings</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-2">Recent Shoots</h4>
                  <div className="space-y-2">
                    {recentShoots.length > 0 ? (
                      recentShoots.map(shoot => (
                        <div key={shoot.id} className="flex justify-between items-center text-sm">
                          <span className="truncate max-w-[180px]">{shoot.location.address}</span>
                          <Badge variant="outline">
                            {format(new Date(shoot.scheduledDate), 'MMM dd')}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent shoots</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right side - Settings tabs */}
          <div className="lg:w-2/3">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>
                  Manage your account settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <AutoExpandingTabsList
                    tabs={[
                      { value: 'personal', icon: User, label: 'Personal Info' },
                      { value: 'specialties', icon: Camera, label: 'Specialties' },
                      { value: 'equipments', icon: Wrench, label: 'Equipments' },
                      { value: 'notifications', icon: Settings, label: 'Preferences' },
                      { value: 'completed-shoots', icon: Upload, label: 'Media' },
                    ]}
                    value={activeTab}
                    className="mb-6"
                  />
                  
                  {/* Personal Info Tab */}
                  <TabsContent value="personal">
                    <Form {...personalInfoForm}>
                      <form onSubmit={personalInfoForm.handleSubmit(onPersonalInfoSubmit)} className="space-y-4">
                        <FormField
                          control={personalInfoForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your full name" {...field} />
                              </FormControl>
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
                              <FormControl>
                                <Input placeholder="Enter your email" {...field} />
                              </FormControl>
                              <FormDescription>
                                This email will be used for communications.
                              </FormDescription>
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
                              <FormControl>
                                <Input placeholder="Enter your phone number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={personalInfoForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl>
                                <Input placeholder="City, State" {...field} />
                              </FormControl>
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
                        
                        <Button type="submit" className="w-full">Save Changes</Button>
                      </form>
                    </Form>
                  </TabsContent>
                  
                  {/* Specialties Tab */}
                  <TabsContent value="specialties">
                    <Form {...specialtiesForm}>
                      <form onSubmit={specialtiesForm.handleSubmit(onSpecialtiesSubmit)} className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Photography Services</h3>
                          <p className="text-sm text-muted-foreground">
                            Select all the services you provide as a photographer
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <label htmlFor={`specialty-${specialty}`}>{specialty}</label>
                              </div>
                            ))}
                          </div>
                          
                          <h3 className="text-lg font-medium pt-4">Property Types</h3>
                          <p className="text-sm text-muted-foreground">
                            Select the types of properties you're comfortable shooting
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['Single Family', 'Multi-Family', 'Condo/Townhouse', 'Apartment', 'Vacant Land', 'Office', 'Retail', 'Industrial'].map((propertyType) => (
                              <div key={propertyType} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`property-${propertyType}`}
                                  value={propertyType}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor={`property-${propertyType}`}>{propertyType}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <Button type="submit" className="w-full">Save Specialties</Button>
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
                                        <FormLabel>Upload Verification Photos</FormLabel>
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

                  {/* Notifications Tab */}
                  <TabsContent value="notifications">
                    <Form {...notificationsForm}>
                      <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Notification Preferences</h3>
                          <p className="text-sm text-muted-foreground">
                            Choose how you want to be notified about new shoots and updates
                          </p>
                          
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border p-4 rounded-md">
                              <div>
                                <h4 className="font-medium">Email Notifications</h4>
                                <p className="text-sm text-muted-foreground">Receive updates via email</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={notificationsForm.watch('email_notifications')}
                                onChange={(e) => notificationsForm.setValue('email_notifications', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </div>
                            
                            <div className="flex items-center justify-between border p-4 rounded-md">
                              <div>
                                <h4 className="font-medium">SMS Notifications</h4>
                                <p className="text-sm text-muted-foreground">Receive text messages for urgent updates</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={notificationsForm.watch('sms_notifications')}
                                onChange={(e) => notificationsForm.setValue('sms_notifications', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </div>
                          </div>
                          
                          <h3 className="text-lg font-medium pt-4">Calendar Sync</h3>
                          <p className="text-sm text-muted-foreground">
                            Connect Google Calendar to automatically sync scheduled shoots from REPro to your primary calendar.
                          </p>

                          <Card className="border-dashed">
                            <CardHeader className="space-y-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <CardTitle className="text-base">Google Calendar</CardTitle>
                                  <CardDescription>
                                    One-way sync for shoots only. Availability export stays separate on the Availability page.
                                  </CardDescription>
                                </div>
                                <GoogleCalendarStatusBadge
                                  available={googleCalendarStatus.available}
                                  connected={googleCalendarStatus.connected}
                                  syncEnabled={googleCalendarStatus.sync_enabled}
                                />
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Calendar</span>
                                  <span className="font-medium">
                                    {googleCalendarStatus.connected
                                      ? googleCalendarStatus.provider_email || 'Primary calendar'
                                      : 'Not connected'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Sync target</span>
                                  <span className="font-medium">
                                    {googleCalendarStatus.connected ? 'Primary Google Calendar' : 'No active sync'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Last sync</span>
                                  <span className="font-medium">
                                    {googleCalendarStatus.last_synced_at
                                      ? new Date(googleCalendarStatus.last_synced_at).toLocaleString()
                                      : 'Not synced yet'}
                                  </span>
                                </div>
                              </div>

                              {googleCalendarStatus.last_error && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                  {googleCalendarStatus.last_error}
                                </div>
                              )}

                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                  type="button"
                                  onClick={handleGoogleCalendarConnect}
                                  disabled={isGoogleCalendarLoading || googleCalendarAction !== null || !googleCalendarStatus.available}
                                >
                                  {googleCalendarAction === 'connect'
                                    ? 'Connecting...'
                                    : googleCalendarStatus.connected
                                      ? 'Reconnect Google Calendar'
                                      : 'Connect Google Calendar'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleGoogleCalendarResync}
                                  disabled={!googleCalendarStatus.connected || googleCalendarAction !== null}
                                >
                                  {googleCalendarAction === 'resync' ? 'Resyncing...' : 'Manual Resync'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={handleGoogleCalendarDisconnect}
                                  disabled={!googleCalendarStatus.connected || googleCalendarAction !== null}
                                >
                                  {googleCalendarAction === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        
                        <Button type="submit" className="w-full">Save Preferences</Button>
                      </form>
                    </Form>
                  </TabsContent>
                  
                  {/* Completed Shoots Media Tab */}
                  <TabsContent value="completed-shoots">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Completed Shoots</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload and manage media for your completed shoots.
                      </p>
                      
                      {completedShoots.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {completedShoots.map(shoot => (
                            <Card key={shoot.id} className="overflow-hidden">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="font-medium">{shoot.location.address}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {format(new Date(shoot.completedDate || shoot.scheduledDate), 'MMM dd, yyyy')}
                                    </p>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleUploadMedia(shoot)}
                                    className="flex items-center gap-1"
                                  >
                                    <Upload className="h-4 w-4" />
                                    <span>Upload Media</span>
                                  </Button>
                                </div>
                                
                                {shoot.media && shoot.media.photos && shoot.media.photos.length > 0 && (
                                  <div className="mt-4">
                                    <h5 className="text-sm font-medium mb-2">Uploaded Photos ({shoot.media.photos.length})</h5>
                                    <div className="grid grid-cols-4 gap-2">
                                      {shoot.media.photos.slice(0, 4).map((photo, index) => (
                                        <div key={index} className="aspect-square rounded-md overflow-hidden">
                                          <img 
                                            src={photo} 
                                            alt={`Property photo ${index + 1}`} 
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ))}
                                      {shoot.media.photos.length > 4 && (
                                        <div className="col-span-4 text-center mt-2">
                                          <Button 
                                            variant="link" 
                                            size="sm" 
                                            onClick={() => {
                                              setSelectedShoot(shoot);
                                              setIsDetailOpen(true);
                                            }}
                                          >
                                            View all {shoot.media.photos.length} photos
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-8 border rounded-lg">
                          <p className="text-muted-foreground">No completed shoots found.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Upload Media and Shoot Detail Dialogs */}
      <ShootsDialogs 
        selectedShoot={selectedShoot}
        isDetailOpen={isDetailOpen}
        isUploadDialogOpen={isUploadDialogOpen}
        setIsDetailOpen={setIsDetailOpen}
        setIsUploadDialogOpen={setIsUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />
    </DashboardLayout>
  );
};

export default PhotographerAccount;

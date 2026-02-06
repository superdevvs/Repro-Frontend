
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/profile/ImageUpload';
import { BrandingImageUpload } from '@/components/profile/BrandingImageUpload';
import { usePermission } from '@/hooks/usePermission';
import { IntegrationsSettingsContent } from '@/pages/IntegrationsSettings';
import { IntegrationsGrid } from '@/components/integrations/IntegrationsGrid';
import { IntegrationsHeader } from '@/components/integrations/IntegrationsHeader';
import { CouponsList } from '@/components/coupons/CouponsList';
import { CreateCouponDialog } from '@/components/coupons/CreateCouponDialog';
import { User, Settings as SettingsIcon, Palette, Bell, Plug, MessageSquare, Droplets, Ticket, Plus, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import WatermarkEditor from '@/components/settings/WatermarkEditor';
import { RobbieSettings } from '@/components/settings/RobbieSettings';

const BASE_TABS = ['profile', 'account', 'branding', 'notifications'] as const;
type TabValue = (typeof BASE_TABS)[number] | 'coupons' | 'integrations' | 'watermark' | 'robbie';

const Settings = () => {
  const { user, role, setUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const permission = usePermission();
  const integrationsPermission = permission.forResource('integrations');
  const canViewIntegrations = integrationsPermission.canView();
  const couponsPermission = permission.forResource('coupons');
  const canViewCoupons = couponsPermission.canView();
  const canCreateCoupons = couponsPermission.canCreate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Use clientId from URL if present (for admin editing), otherwise use logged-in user's id
  const clientIdFromUrl = searchParams.get('clientId');
  const clientIdForStorage = clientIdFromUrl || (user?.id ? String(user.id) : 'default');
  const storageKey = (key: string) => `client-${clientIdForStorage}-${key}`;
  const [avatar, setAvatar] = React.useState(user?.avatar || '');
  const [brandLogo, setBrandLogo] = React.useState('');
  const [brandBanner, setBrandBanner] = React.useState('');
  const [brandAbout, setBrandAbout] = React.useState('');
  const [showMap, setShowMap] = React.useState<boolean>(() => {
    const stored = localStorage.getItem(storageKey('showMap'));
    return stored ? stored === 'true' : false;
  });
  const [bio, setBio] = React.useState(user?.bio || '');
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const isSuperAdmin = role === 'superadmin';
  
  const availableTabs = React.useMemo<TabValue[]>(() => {
    const tabs: TabValue[] = [...BASE_TABS];
    if (canViewCoupons) {
      tabs.push('coupons');
    }
    if (canViewIntegrations) {
      tabs.push('integrations');
    }
    if (isSuperAdmin) {
      tabs.push('watermark');
      tabs.push('robbie');
    }
    return tabs;
  }, [canViewCoupons, canViewIntegrations, isSuperAdmin]);

  const getValidTab = React.useCallback(
    (tabParam: string | null): TabValue => {
      if (tabParam && availableTabs.includes(tabParam as TabValue)) {
        return tabParam as TabValue;
      }
      return 'profile';
    },
    [availableTabs]
  );

  React.useEffect(() => {
    const storedAbout = localStorage.getItem(storageKey('brandAbout'));
    if (storedAbout) setBrandAbout(storedAbout);

    const storedAvatar = localStorage.getItem(storageKey('avatar'));
    if (storedAvatar) setAvatar(storedAvatar);

    const storedLogo = localStorage.getItem(storageKey('brandLogo'));
    if (storedLogo) setBrandLogo(storedLogo);

    const storedBanner = localStorage.getItem(storageKey('brandBanner'));
    if (storedBanner) setBrandBanner(storedBanner);

    const storedShowMap = localStorage.getItem(storageKey('showMap'));
    if (storedShowMap) setShowMap(storedShowMap === 'true');
  }, [clientIdForStorage]);

  const [activeTab, setActiveTab] = React.useState<TabValue>(() => getValidTab(searchParams.get('tab')));

  React.useEffect(() => {
    const nextTab = getValidTab(searchParams.get('tab'));
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams, getValidTab]);

  const handleTabChange = (value: string) => {
    const nextTab = getValidTab(value);
    setActiveTab(nextTab);

    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'profile') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const payload: Record<string, string> = {};
      if (name && name !== user?.name) payload.name = name;
      if (bio !== (user?.bio || '')) payload.bio = bio;
      // Only include avatar if it's a valid URL (not a blob URL)
      if (avatar && avatar !== user?.avatar && !avatar.startsWith('blob:')) {
        payload.avatar = avatar;
      }

      // Only call API if there are changes
      if (Object.keys(payload).length > 0) {
        const { data } = await axios.put(
          `${API_BASE_URL}/api/profile`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        // Update the user in AuthProvider context
        if (data.user) {
          // Normalize the user data to ensure avatar is at top level
          const updatedUser = {
            ...data.user,
            avatar: data.user.avatar,
            bio: data.user.bio,
            company: data.user.company_name,
            phone: data.user.phonenumber,
          };
          setUser(updatedUser);
        }
      }

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();

    toast({
      title: "Account Updated",
      description: "Your account settings have been saved.",
    });
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();

    // Persist locally so the client portal can read it until API wiring is added.
    localStorage.setItem(storageKey('brandAbout'), brandAbout);

    toast({
      title: "Branding Updated",
      description: "Your branding settings have been saved.",
    });
  };

  const handleAvatarChange = async (url: string) => {
    setAvatar(url);
    localStorage.setItem(storageKey('avatar'), url);
    
    // Don't save blob URLs to the backend - they're only valid locally
    if (!url || url.startsWith('blob:')) {
      console.log('Skipping backend save for blob URL');
      return;
    }
    
    // Save to backend immediately for better UX
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const { data } = await axios.put(
        `${API_BASE_URL}/api/profile`,
        { avatar: url },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Update the user in AuthProvider context
      if (data.user) {
        // Normalize the user data to ensure avatar is at top level
        const updatedUser = {
          ...data.user,
          avatar: data.user.avatar,
          bio: data.user.bio,
          company: data.user.company_name,
          phone: data.user.phonenumber,
        };
        setUser(updatedUser);
        toast({
          title: "Avatar saved",
          description: "Your profile photo has been saved to your account.",
        });
      }
    } catch (error) {
      console.error('Error saving avatar:', error);
      toast({
        title: "Avatar save failed",
        description: "Could not save avatar to your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogoChange = (url: string) => {
    setBrandLogo(url);
    localStorage.setItem(storageKey('brandLogo'), url);
  };

  const handleBannerChange = (url: string) => {
    setBrandBanner(url);
    localStorage.setItem(storageKey('brandBanner'), url);
  };

  // Auto-expanding tabs configuration
  const tabsConfig: AutoExpandingTab[] = useMemo(() => {
    const tabMeta: Record<Exclude<TabValue, 'integrations' | 'watermark' | 'robbie'>, { icon: typeof User; label: string }> = {
      profile: { icon: User, label: 'Profile' },
      account: { icon: SettingsIcon, label: 'Account' },
      branding: { icon: Palette, label: 'Branding' },
      notifications: { icon: Bell, label: 'Notifications' },
      coupons: { icon: Ticket, label: 'Coupons' },
    };

    const mappedTabs: AutoExpandingTab[] = availableTabs
      .filter((tab) => tab !== 'integrations' && tab !== 'watermark' && tab !== 'robbie')
      .map((tab) => ({
        value: tab,
        icon: tabMeta[tab as Exclude<TabValue, 'integrations' | 'watermark' | 'robbie'>].icon,
        label: tabMeta[tab as Exclude<TabValue, 'integrations' | 'watermark' | 'robbie'>].label,
      }));

    if (availableTabs.includes('integrations')) {
      mappedTabs.push({
        value: 'integrations',
        icon: Plug,
        label: 'Integrations',
      });
    }

    if (availableTabs.includes('watermark')) {
      mappedTabs.push({
        value: 'watermark',
        icon: Droplets,
        label: 'Watermark',
      });
    }

    if (availableTabs.includes('robbie')) {
      mappedTabs.push({
        value: 'robbie',
        icon: Bot,
        label: 'Robbie AI',
      });
    }

    return mappedTabs;
  }, [availableTabs]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Settings"
          description="Manage your account settings and preferences"
        />

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <AutoExpandingTabsList 
              tabs={tabsConfig} 
              value={activeTab}
              className="mb-6"
            />

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Update your profile information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                        <div>
                          <Avatar className="h-24 w-24 border-2 border-muted">
                            <AvatarImage src={avatar || user?.avatar} alt={user?.name} />
                            <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                              >
                                Change Avatar
                              </Button>
                            </SheetTrigger>
                            <SheetContent>
                              <SheetHeader>
                                <SheetTitle>Profile Picture</SheetTitle>
                                <SheetDescription>
                                  Upload a new profile picture
                                </SheetDescription>
                              </SheetHeader>
                              <div className="py-6">
                                <ImageUpload onChange={handleAvatarChange} initialImage={avatar || user?.avatar} />
                              </div>
                            </SheetContent>
                          </Sheet>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label htmlFor="name" className="text-sm font-medium">
                                Full Name
                              </label>
                              <Input 
                                id="name" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="email" className="text-sm font-medium">
                                Email
                              </label>
                              <Input id="email" type="email" defaultValue={user?.email} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="bio" className="text-sm font-medium">
                              Bio
                            </label>
                            <Textarea
                              id="bio"
                              rows={4}
                              value={bio}
                              placeholder="Write a short bio about yourself"
                              onChange={(e) => setBio(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                  <CardDescription>
                    Update your account settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveAccount} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="phone" className="text-sm font-medium">
                          Phone Number
                        </label>
                        <Input 
                          id="phone" 
                          type="tel" 
                          placeholder="+1 (555) 123-4567"
                          defaultValue={user?.phone || ''}
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="company" className="text-sm font-medium">
                          Company
                        </label>
                        <Input 
                          id="company" 
                          type="text" 
                          placeholder="Your company name"
                          defaultValue={user?.company || ''}
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="timezone" className="text-sm font-medium">
                          Timezone
                        </label>
                        <select
                          id="timezone"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          defaultValue="America/New_York"
                        >
                          <option value="America/New_York">Eastern Time (ET)</option>
                          <option value="America/Chicago">Central Time (CT)</option>
                          <option value="America/Denver">Mountain Time (MT)</option>
                          <option value="America/Los_Angeles">Pacific Time (PT)</option>
                          <option value="America/Anchorage">Alaska Time (AKT)</option>
                          <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="current-password" className="text-sm font-medium">
                          Current Password
                        </label>
                        <Input id="current-password" type="password" />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label htmlFor="new-password" className="text-sm font-medium">
                            New Password
                          </label>
                          <Input id="new-password" type="password" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="confirm-password" className="text-sm font-medium">
                            Confirm Password
                          </label>
                          <Input id="confirm-password" type="password" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit">
                        Update Account
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                  <CardDescription>
                    Upload your company logo and branding images
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveBranding} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Company Logo</h3>
                        <p className="text-sm text-muted-foreground">
                          This logo will appear on your invoices and client communications.
                        </p>
                        <BrandingImageUpload
                          onChange={handleLogoChange}
                          initialImage={brandLogo}
                          aspectRatio="1/1"
                          maxWidth={200}
                          helperText="Recommended size: 200x200px (square)"
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Brand Banner</h3>
                        <p className="text-sm text-muted-foreground">
                          This banner will be used in client-facing materials.
                        </p>
                        <BrandingImageUpload
                          onChange={handleBannerChange}
                          initialImage={brandBanner}
                          aspectRatio="16/9"
                          maxWidth={600}
                          helperText="Recommended size: 1200x675px (16:9)"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="brand-colors" className="text-sm font-medium">
                          Brand Colors
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Primary</span>
                            <Input type="color" defaultValue="#0070f3" className="h-10 p-1" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Secondary</span>
                            <Input type="color" defaultValue="#f5f5f5" className="h-10 p-1" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Accent</span>
                            <Input type="color" defaultValue="#ff4500" className="h-10 p-1" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Text</span>
                            <Input type="color" defaultValue="#333333" className="h-10 p-1" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="tagline" className="text-sm font-medium">
                          Company Tagline
                        </label>
                        <Input
                          id="tagline"
                          placeholder="Your business tagline"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="brand-about" className="text-sm font-medium">
                          Portfolio About
                        </label>
                        <Textarea
                          id="brand-about"
                          placeholder="Short description to show in the client portfolio About section"
                          value={brandAbout}
                          onChange={(e) => setBrandAbout(e.target.value)}
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                          This text appears in the client-facing portfolio About section.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Show Map in Contact</p>
                            <p className="text-xs text-muted-foreground">
                              Toggle the map embed in the client portfolio contact section.
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={showMap}
                              onChange={(e) => {
                                setShowMap(e.target.checked);
                              localStorage.setItem(storageKey('showMap'), String(e.target.checked));
                              }}
                            />
                            <div className="w-11 h-6 bg-muted-foreground rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit">
                        Save Branding
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Manage how we contact you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h4 className="font-medium">Email Notifications</h4>
                        <p className="text-sm text-muted-foreground">Get notified about new bookings and updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-muted-foreground rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h4 className="font-medium">SMS Notifications</h4>
                        <p className="text-sm text-muted-foreground">Receive text messages for urgent updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-muted-foreground rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h4 className="font-medium">Marketing Emails</h4>
                        <p className="text-sm text-muted-foreground">Receive special offers and updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-muted-foreground rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button>Save Preferences</Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {canViewCoupons && (
              <TabsContent value="coupons" className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Coupons & Discounts</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage promotional codes and discounts
                    </p>
                  </div>
                  {canCreateCoupons && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Coupon
                        </Button>
                      </DialogTrigger>
                      <CreateCouponDialog />
                    </Dialog>
                  )}
                </div>
                <CouponsList />
              </TabsContent>
            )}

            {canViewIntegrations && (
              <TabsContent value="integrations" className="space-y-6">
                <div className="space-y-8">
                  {/* Main Integrations Grid */}
                  <div className="space-y-6">
                    <IntegrationsHeader />
                    <IntegrationsGrid />
                  </div>

                  {/* SMS / MightyCall Settings Card */}
                  <Card className="border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        SMS Settings (MightyCall)
                      </CardTitle>
                      <CardDescription>
                        Configure MightyCall phone numbers and API keys for SMS messaging
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Manage your MightyCall SMS integration including phone numbers, API keys, and messaging settings.
                      </p>
                      <Button onClick={() => navigate('/messaging/settings')}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open SMS Settings
                      </Button>
                    </CardContent>
                  </Card>

                  {/* API Integrations Section */}
                  <div className="space-y-6 pt-8 border-t">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">API Integrations</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Configure API credentials for Zillow, Bright MLS, and iGUIDE integrations.
                      </p>
                    </div>
                    <IntegrationsSettingsContent />
                  </div>
                </div>
              </TabsContent>
            )}

            {isSuperAdmin && (
              <TabsContent value="watermark" className="space-y-6">
                <WatermarkEditor />
              </TabsContent>
            )}

            {isSuperAdmin && (
              <TabsContent value="robbie" className="space-y-6">
                <RobbieSettings />
              </TabsContent>
            )}
          </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;


import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/profile/ImageUpload';
import { BrandingImageUpload } from '@/components/profile/BrandingImageUpload';
import { usePermission } from '@/hooks/usePermission';
import { IntegrationsSettingsContent } from '@/pages/IntegrationsSettings';
import { IntegrationsGrid } from '@/components/integrations/IntegrationsGrid';
import { IntegrationsHeader } from '@/components/integrations/IntegrationsHeader';
import { User, Settings as SettingsIcon, Palette, CreditCard, Bell, Plug } from 'lucide-react';

const BASE_TABS = ['profile', 'account', 'branding', 'billing', 'notifications'] as const;
type TabValue = (typeof BASE_TABS)[number] | 'integrations';

const Settings = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const permission = usePermission();
  const integrationsPermission = permission.forResource('integrations');
  const brandingPermission = permission.forResource('branding');
  const canViewIntegrations = integrationsPermission.canView();
  const canViewBranding = brandingPermission.canView(); // Only Super Admin and Admin can view branding
  const isAdminOrSuperAdmin = role === 'admin' || role === 'superadmin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [avatar, setAvatar] = React.useState(user?.avatar || '');
  const [brandLogo, setBrandLogo] = React.useState('');
  const [brandBanner, setBrandBanner] = React.useState('');
  const [bio, setBio] = React.useState(''); // Add a separate state for bio

  const availableTabs = React.useMemo<TabValue[]>(() => {
    const tabs: TabValue[] = [...BASE_TABS];
    // Only show branding tab for Super Admin and Admin
    if (!canViewBranding || !isAdminOrSuperAdmin) {
      const brandingIndex = tabs.indexOf('branding');
      if (brandingIndex > -1) {
        tabs.splice(brandingIndex, 1);
      }
    }
    if (canViewIntegrations) {
      tabs.push('integrations');
    }
    return tabs;
  }, [canViewIntegrations, canViewBranding, isAdminOrSuperAdmin]);

  const getValidTab = React.useCallback(
    (tabParam: string | null): TabValue => {
      if (tabParam && availableTabs.includes(tabParam as TabValue)) {
        return tabParam as TabValue;
      }
      return 'profile';
    },
    [availableTabs]
  );

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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved.",
    });
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

    toast({
      title: "Branding Updated",
      description: "Your branding settings have been saved.",
    });
  };

  const handleAvatarChange = (url: string) => {
    setAvatar(url);
  };

  const handleLogoChange = (url: string) => {
    setBrandLogo(url);
  };

  const handleBannerChange = (url: string) => {
    setBrandBanner(url);
  };

  // Auto-expanding tabs configuration
  const tabsConfig: AutoExpandingTab[] = useMemo(() => {
    const baseTabs: AutoExpandingTab[] = [
      {
        value: 'profile',
        icon: User,
        label: 'Profile',
      },
      {
        value: 'account',
        icon: SettingsIcon,
        label: 'Account',
      },
      {
        value: 'branding',
        icon: Palette,
        label: 'Branding',
      },
      {
        value: 'billing',
        icon: CreditCard,
        label: 'Billing',
      },
      {
        value: 'notifications',
        icon: Bell,
        label: 'Notifications',
      },
    ];

    if (canViewIntegrations) {
      baseTabs.push({
        value: 'integrations',
        icon: Plug,
        label: 'Integrations',
      });
    }

    return baseTabs;
  }, [canViewIntegrations]);

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Settings"
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
                              <Input id="name" defaultValue={user?.name} />
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
                              defaultValue={bio}
                              placeholder="Write a short bio about yourself"
                              onChange={(e) => setBio(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit">
                        Save Changes
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

            <TabsContent value="billing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Billing</CardTitle>
                  <CardDescription>
                    Manage your billing information and payment settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Square Payment Configuration */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Square Payment Configuration</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Configure Square payment processing for client payments
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="square-app-id" className="text-sm font-medium">
                            Square Application ID
                          </label>
                          <Input
                            id="square-app-id"
                            type="text"
                            placeholder="sandbox-sq0idb-..."
                            defaultValue="sandbox-sq0idb-KBncaaZuhXcaX42j5O7zdg"
                          />
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="square-location-id" className="text-sm font-medium">
                            Square Location ID
                          </label>
                          <Input
                            id="square-location-id"
                            type="text"
                            placeholder="L7DAFQ5SCKT74"
                            defaultValue="L7DAFQ5SCKT74"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="square-environment" className="text-sm font-medium">
                          Environment
                        </label>
                        <select
                          id="square-environment"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          defaultValue="sandbox"
                        >
                          <option value="sandbox">Sandbox (Testing)</option>
                          <option value="production">Production (Live)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between border-b pb-4">
                        <div>
                          <h4 className="font-medium">Enable Square Payments</h4>
                          <p className="text-sm text-muted-foreground">Allow clients to pay via Square</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-muted-foreground rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>

                    {/* Other Billing Settings */}
                    <div className="space-y-4 pt-6 border-t">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div>
                          <h4 className="font-medium">Auto-invoicing</h4>
                          <p className="text-sm text-muted-foreground">Automatically generate invoices for completed shoots</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-muted-foreground rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between border-b pb-4">
                        <div>
                          <h4 className="font-medium">Payment Reminders</h4>
                          <p className="text-sm text-muted-foreground">Send automatic payment reminders to clients</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-muted-foreground rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button>Save Billing Settings</Button>
                </CardFooter>
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

            {canViewIntegrations && (
              <TabsContent value="integrations" className="space-y-6">
                <div className="space-y-8">
                  {/* Main Integrations Grid */}
                  <div className="space-y-6">
                    <IntegrationsHeader />
                    <IntegrationsGrid />
                  </div>

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
          </Tabs>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default Settings;

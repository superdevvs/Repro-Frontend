
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/profile/ImageUpload';
import { BrandingImageUpload } from '@/components/profile/BrandingImageUpload';
import { usePermission } from '@/hooks/usePermission';
import { IntegrationsSettingsContent } from '@/pages/IntegrationsSettings';
import { ToursSection } from '@/components/integrations/sections/ToursSection';
import { CouponsList } from '@/components/coupons/CouponsList';
import { CreateCouponDialog } from '@/components/coupons/CreateCouponDialog';
import { User, Settings as SettingsIcon, Palette, Bell, Plug, MessageSquare, Droplets, Ticket, Plus, Bot, ExternalLink, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import WatermarkEditor from '@/components/settings/WatermarkEditor';
import { RobbieSettings } from '@/components/settings/RobbieSettings';
import SystemOverviewTab from '@/components/settings/SystemOverviewTab';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';

const BASE_TABS = ['profile', 'account', 'branding', 'notifications'] as const;
const SYSTEM_OVERVIEW_UNLOCK_CLICKS = 5;
const SYSTEM_OVERVIEW_UNLOCK_STORAGE_KEY = 'settings.systemOverview.unlocked';
type TabValue =
  | (typeof BASE_TABS)[number]
  | 'coupons'
  | 'integrations'
  | 'watermark'
  | 'robbie'
  | 'overview';

const formatRoleLabel = (value?: string | null) => {
  if (!value) return 'User';
  if (value === 'salesRep') return 'Sales Rep';

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const Settings = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { saveProfile } = useSelfProfileSave();
  const permission = usePermission();
  const integrationsPermission = permission.forResource('integrations');
  const canViewIntegrations = integrationsPermission.canView();
  const couponsPermission = permission.forResource('coupons');
  const canViewCoupons = couponsPermission.canView();
  const canCreateCoupons = couponsPermission.canCreate();
  const canViewWatermark = permission.can('watermark-settings', 'view');
  const canViewRobbieSettings = permission.can('robbie-settings', 'view');
  const [systemOverviewUnlocked, setSystemOverviewUnlocked] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.sessionStorage.getItem(SYSTEM_OVERVIEW_UNLOCK_STORAGE_KEY) === 'true';
  });
  const [accountTabTapCount, setAccountTabTapCount] = React.useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  // Use clientId from URL if present (for admin editing), otherwise use logged-in user's id
  const clientIdFromUrl = searchParams.get('clientId');
  const clientIdForStorage = clientIdFromUrl || (user?.id ? String(user.id) : 'default');
  const storageKey = React.useCallback((key: string) => `client-${clientIdForStorage}-${key}`, [clientIdForStorage]);
  const [avatar, setAvatar] = React.useState(user?.avatar || '');
  const [brandLogo, setBrandLogo] = React.useState('');
  const [brandBanner, setBrandBanner] = React.useState('');
  const [brandAbout, setBrandAbout] = React.useState('');
  const [heroHeadline, setHeroHeadline] = React.useState('');
  const [heroSubtitle, setHeroSubtitle] = React.useState('');
  const [heroImage, setHeroImage] = React.useState('');
  const [facebookUrl, setFacebookUrl] = React.useState('');
  const [linkedinUrl, setLinkedinUrl] = React.useState('');
  const [instagramUrl, setInstagramUrl] = React.useState('');
  const [showMap, setShowMap] = React.useState(false);
  const [bio, setBio] = React.useState(user?.bio || '');
  const [name, setName] = useState(user?.name || '');
  const [accountForm, setAccountForm] = React.useState({
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || '',
    timezone: user?.timezone || 'America/New_York',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [avatarDrawerOpen, setAvatarDrawerOpen] = useState(false);
  const showSystemOverviewTab = systemOverviewUnlocked;

  const availableTabs = React.useMemo<TabValue[]>(() => {
    // Hide branding tab for photographer, editor, and editing_manager roles
    const hideBranding = ['photographer', 'editor', 'editing_manager'].includes(role || '');
    const tabs: TabValue[] = [...BASE_TABS].filter(tab => !(tab === 'branding' && hideBranding));
    if (canViewCoupons) {
      tabs.push('coupons');
    }
    if (canViewIntegrations) {
      tabs.push('integrations');
    }
    if (canViewWatermark) {
      tabs.push('watermark');
    }
    if (canViewRobbieSettings) {
      tabs.push('robbie');
    }
    if (showSystemOverviewTab) {
      tabs.push('overview');
    }
    return tabs;
  }, [canViewCoupons, canViewIntegrations, canViewRobbieSettings, canViewWatermark, role, showSystemOverviewTab]);

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
    const storedAvatar = localStorage.getItem(storageKey('avatar'));
    if (storedAvatar) setAvatar(storedAvatar);

    // Load branding from API
    const userId = clientIdFromUrl || user?.id;
    if (userId) {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      axios.get(`${API_BASE_URL}/api/users/${userId}/branding`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ data }) => {
        const b = data?.data?.branding;
        setBrandLogo(b?.logo ?? '');
        setBrandBanner(b?.banner ?? '');
        setBrandAbout(b?.about ?? '');
        setHeroHeadline(b?.hero_headline ?? '');
        setHeroSubtitle(b?.hero_subtitle ?? '');
        setHeroImage(b?.hero_image ?? '');
        setFacebookUrl(b?.facebook_url ?? '');
        setLinkedinUrl(b?.linkedin_url ?? '');
        setInstagramUrl(b?.instagram_url ?? '');
        setShowMap(Boolean(b?.show_map));
      }).catch((err) => console.error('Failed to load branding:', err));
    }
  }, [clientIdFromUrl, storageKey, user?.id]);

  React.useEffect(() => {
    setName(user?.name || '');
    setBio(user?.bio || '');
    setAvatar(user?.avatar || '');
    setAccountForm({
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.company || '',
      timezone: user?.timezone || 'America/New_York',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [user?.avatar, user?.bio, user?.company, user?.email, user?.name, user?.phone, user?.timezone]);

  const [activeTab, setActiveTab] = React.useState<TabValue>(() => getValidTab(searchParams.get('tab')));

  React.useEffect(() => {
    const nextTab = getValidTab(searchParams.get('tab'));
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams, getValidTab]);

  React.useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (!requestedTab || availableTabs.includes(requestedTab as TabValue)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  }, [availableTabs, searchParams, setSearchParams]);

  const unlockSystemOverview = React.useCallback(() => {
    if (systemOverviewUnlocked) {
      return;
    }

    setSystemOverviewUnlocked(true);

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SYSTEM_OVERVIEW_UNLOCK_STORAGE_KEY, 'true');
    }

    toast({
      title: 'System Overview unlocked',
      description: 'The overview tab is now available in Settings for this session.',
    });
  }, [systemOverviewUnlocked, toast]);

  React.useEffect(() => {
    if (accountTabTapCount < SYSTEM_OVERVIEW_UNLOCK_CLICKS) {
      return;
    }

    unlockSystemOverview();
    setAccountTabTapCount(0);
  }, [accountTabTapCount, unlockSystemOverview]);

  const handleTabChange = (value: string) => {
    const nextTab = getValidTab(value);
    if (nextTab !== 'account') {
      setAccountTabTapCount(0);
    }
    setActiveTab(nextTab);

    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'profile') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleTabInteraction = React.useCallback((value: string) => {
    if (systemOverviewUnlocked) {
      return;
    }

    if (value !== 'account') {
      setAccountTabTapCount(0);
      return;
    }

    setAccountTabTapCount((current) => {
      return current + 1;
    });
  }, [systemOverviewUnlocked]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: Record<string, string> = {};
      if (name && name !== user?.name) payload.name = name;
      if (bio !== (user?.bio || '')) payload.bio = bio;
      // Only include avatar if it's a valid URL (not a blob URL)
      if (avatar && avatar !== user?.avatar && !avatar.startsWith('blob:')) {
        payload.avatar = avatar;
      }

      // Only call API if there are changes
      if (Object.keys(payload).length > 0) {
        const result = await saveProfile(payload);
        if (result.reauthRequired) {
          return;
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

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = clientIdFromUrl || user?.id;
    if (!userId) return;

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/users/${userId}/branding`,
        {
          branding: {
            logo: brandLogo || null,
            banner: brandBanner || null,
            about: brandAbout || null,
            hero_headline: heroHeadline || null,
            hero_subtitle: heroSubtitle || null,
            hero_image: heroImage || null,
            facebook_url: facebookUrl || null,
            linkedin_url: linkedinUrl || null,
            instagram_url: instagramUrl || null,
            show_map: showMap,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      toast({
        title: "Branding Updated",
        description: "Your branding settings have been saved.",
      });
    } catch (error: any) {
      console.error('Error saving branding:', error);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to save branding settings",
        variant: "destructive",
      });
    }
  };

  const handleAvatarChange = async (url: string) => {
    setAvatar(url);
    localStorage.setItem(storageKey('avatar'), url);
    
    // Don't save blob URLs to the backend - they're only valid locally
    if (url.startsWith('blob:')) {
      console.log('Skipping backend save for blob URL');
      return;
    }
    
    // Save to backend immediately for better UX
    // Empty string means user is removing their avatar - send null to clear it
    try {
      const result = await saveProfile({ avatar: url || null });
      if (!result.reauthRequired) {
        toast({
          title: url ? "Avatar saved" : "Avatar removed",
          description: url ? "Your profile photo has been saved to your account." : "Your profile photo has been removed.",
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
  };

  const handleAccountInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveAccountSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const result = await saveProfile({
        email: accountForm.email,
        current_password:
          accountForm.email !== user?.email || accountForm.newPassword
            ? accountForm.currentPassword
            : undefined,
        phone_number: accountForm.phone,
        company_name: accountForm.company,
        timezone: accountForm.timezone,
        new_password: accountForm.newPassword || undefined,
        new_password_confirmation: accountForm.confirmPassword || undefined,
      });

      if (result.reauthRequired) {
        return;
      }

      setAccountForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      toast({
        title: "Account Updated",
        description: result.message || "Your account settings have been saved.",
      });
    } catch (error) {
      console.error('Error saving account settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save account settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBannerChange = (url: string) => {
    setBrandBanner(url);
  };

  // Auto-expanding tabs configuration
  const tabsConfig: AutoExpandingTab[] = useMemo(() => {
    const tabMeta: Record<Exclude<TabValue, 'integrations' | 'watermark' | 'robbie' | 'overview'>, { icon: typeof User; label: string }> = {
      profile: { icon: User, label: 'Profile' },
      account: { icon: SettingsIcon, label: 'Account' },
      branding: { icon: Palette, label: 'Branding' },
      notifications: { icon: Bell, label: 'Notifications' },
      coupons: { icon: Ticket, label: 'Discounts' },
    };

    const mappedTabs: AutoExpandingTab[] = availableTabs
      .filter((tab) => tab !== 'integrations' && tab !== 'watermark' && tab !== 'robbie' && tab !== 'overview')
      .map((tab) => ({
        value: tab,
        icon: tabMeta[tab as Exclude<TabValue, 'integrations' | 'watermark' | 'robbie' | 'overview'>].icon,
        label: tabMeta[tab as Exclude<TabValue, 'integrations' | 'watermark' | 'robbie' | 'overview'>].label,
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

    if (availableTabs.includes('overview')) {
      mappedTabs.push({
        value: 'overview',
        icon: ExternalLink,
        label: 'Overview',
      });
    }

    return mappedTabs;
  }, [availableTabs]);

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-20 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0">
        <PageHeader
          title="Settings"
          description="Manage your account settings and preferences"
        />

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <AutoExpandingTabsList 
              tabs={tabsConfig} 
              value={activeTab}
              className="mb-6"
              onTabInteraction={handleTabInteraction}
            />

            <TabsContent value="profile" className="space-y-4">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Avatar + Identity Card */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                      <div className="relative group shrink-0">
                        <Avatar className="h-24 w-24 border-2 border-muted ring-4 ring-background shadow-lg">
                          <AvatarImage src={avatar || user?.avatar} alt={user?.name} />
                          <AvatarFallback className="text-2xl">{user?.name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <button
                          type="button"
                          onClick={() => setAvatarDrawerOpen(true)}
                          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <Camera className="h-5 w-5 text-white" />
                        </button>
                        <Drawer open={avatarDrawerOpen} onOpenChange={setAvatarDrawerOpen}>
                          <DrawerContent className="max-h-[80dvh]">
                            <DrawerHeader className="pb-2">
                              <DrawerTitle>Profile Picture</DrawerTitle>
                              <DrawerDescription>
                                Upload a new profile picture
                              </DrawerDescription>
                            </DrawerHeader>
                            <div className="px-4 pb-6 flex justify-center">
                              <ImageUpload onChange={(url) => { handleAvatarChange(url); setAvatarDrawerOpen(false); }} initialImage={avatar || user?.avatar} />
                            </div>
                          </DrawerContent>
                        </Drawer>
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
                        <h2 className="text-xl font-semibold truncate">{name || user?.name || 'Your Name'}</h2>
                        <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                        <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                          {formatRoleLabel(role)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Details Card */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Personal Information</CardTitle>
                    <CardDescription>
                      Update your name, email, and bio visible to your team.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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
                        rows={3}
                        value={bio}
                        placeholder="Write a short bio about yourself"
                        onChange={(e) => setBio(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Brief description for your profile. Max 300 characters.</p>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
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
                  <form onSubmit={handleSaveAccountSettings} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">
                          Email Address
                        </label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          value={accountForm.email}
                          onChange={handleAccountInputChange}
                        />
                        <p className="text-xs text-muted-foreground">
                          Changing your email requires your current password.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="phone" className="text-sm font-medium">
                          Phone Number
                        </label>
                        <Input 
                          id="phone" 
                          name="phone"
                          type="tel" 
                          placeholder="+1 (555) 123-4567"
                          value={accountForm.phone}
                          onChange={handleAccountInputChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="company" className="text-sm font-medium">
                          Company
                        </label>
                        <Input 
                          id="company" 
                          name="company"
                          type="text" 
                          placeholder="Your company name"
                          value={accountForm.company}
                          onChange={handleAccountInputChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="timezone" className="text-sm font-medium">
                          Timezone
                        </label>
                        <select
                          id="timezone"
                          name="timezone"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={accountForm.timezone}
                          onChange={handleAccountInputChange}
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
                        <Input
                          id="current-password"
                          name="currentPassword"
                          type="password"
                          value={accountForm.currentPassword}
                          onChange={handleAccountInputChange}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label htmlFor="new-password" className="text-sm font-medium">
                            New Password
                          </label>
                          <Input
                            id="new-password"
                            name="newPassword"
                            type="password"
                            value={accountForm.newPassword}
                            onChange={handleAccountInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="confirm-password" className="text-sm font-medium">
                            Confirm Password
                          </label>
                          <Input
                            id="confirm-password"
                            name="confirmPassword"
                            type="password"
                            value={accountForm.confirmPassword}
                            onChange={handleAccountInputChange}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Update Account'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Branding</CardTitle>
                      <CardDescription>
                        Upload your company logo and branding images
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const cid = clientIdFromUrl || user?.id;
                        if (cid) {
                          window.open(`/client-portal?clientId=${cid}`, '_blank');
                        }
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Portfolio
                    </Button>
                  </div>
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
                        <h3 className="text-lg font-medium">About Image</h3>
                        <p className="text-sm text-muted-foreground">
                          This image appears in the About section of your portfolio.
                        </p>
                        <BrandingImageUpload
                          onChange={handleBannerChange}
                          initialImage={brandBanner}
                          aspectRatio="4/3"
                          maxWidth={300}
                          helperText="Recommended size: 600x450px (4:3)"
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

                      <div className="border-t pt-4 mt-2">
                        <h3 className="text-lg font-medium mb-3">Portfolio Hero Section</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Customize the headline, subtitle, and background image on your portfolio page.
                        </p>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label htmlFor="hero_headline" className="text-sm font-medium">Hero Headline</label>
                            <Input
                              id="hero_headline"
                              value={heroHeadline}
                              onChange={(e) => setHeroHeadline(e.target.value)}
                              placeholder="Your Real Estate Portfolio"
                            />
                            <p className="text-xs text-muted-foreground">
                              This headline is shown to visitors on your portfolio page. Use <code className="bg-muted px-1 rounded">{'{name}'}</code> to insert the visitor's name.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="hero_subtitle" className="text-sm font-medium">Hero Subtitle</label>
                            <Textarea
                              id="hero_subtitle"
                              value={heroSubtitle}
                              onChange={(e) => setHeroSubtitle(e.target.value)}
                              placeholder="Explore our latest property listings with high-resolution photography and virtual tours."
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Hero Background Image</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {[
                                { id: '', label: 'None (Gradient)' },
                                { id: 'header-1', label: 'Harbor Beach' },
                                { id: 'header-2', label: 'Coastal Aerial' },
                                { id: 'header-3', label: 'Residential Aerial' },
                                { id: 'header-4', label: 'Suburban Homes' },
                                { id: 'header-5', label: 'Luxury Hillside' },
                                { id: 'header-6', label: 'Colorful Townhouses' },
                                { id: 'header-7', label: 'Modern Office' },
                                { id: 'header-8', label: 'Highland Houses' },
                                { id: 'header-9', label: 'City Skyline' },
                                { id: 'header-10', label: 'Family Home' },
                                { id: 'header-11', label: 'Real Estate Agent' },
                                { id: 'header-12', label: 'Modern Architecture' },
                                { id: 'header-13', label: 'Neighborhood' },
                              ].map((img) => (
                                <button
                                  key={img.id}
                                  type="button"
                                  onClick={() => setHeroImage(img.id)}
                                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                                    heroImage === img.id
                                      ? 'border-primary ring-2 ring-primary/30'
                                      : 'border-border hover:border-muted-foreground/50'
                                  }`}
                                >
                                  {img.id ? (
                                    <img
                                      src={`/images/portfolio-headers/${img.id}.jpg`}
                                      alt={img.label}
                                      className="w-full aspect-[16/9] object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full aspect-[16/9] bg-gradient-to-br from-background via-muted/30 to-primary/5 flex items-center justify-center">
                                      <span className="text-xs text-muted-foreground">Default</span>
                                    </div>
                                  )}
                                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-1 text-center truncate px-1">
                                    {img.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4 mt-2">
                        <h3 className="text-lg font-medium mb-3">Social Links</h3>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label htmlFor="facebook_url" className="text-sm font-medium">Facebook URL</label>
                            <Input
                              id="facebook_url"
                              value={facebookUrl}
                              onChange={(e) => setFacebookUrl(e.target.value)}
                              placeholder="https://facebook.com/yourpage"
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="linkedin_url" className="text-sm font-medium">LinkedIn URL</label>
                            <Input
                              id="linkedin_url"
                              value={linkedinUrl}
                              onChange={(e) => setLinkedinUrl(e.target.value)}
                              placeholder="https://linkedin.com/in/yourprofile"
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="instagram_url" className="text-sm font-medium">Instagram URL</label>
                            <Input
                              id="instagram_url"
                              value={instagramUrl}
                              onChange={(e) => setInstagramUrl(e.target.value)}
                              placeholder="https://instagram.com/yourhandle"
                            />
                          </div>
                        </div>
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
                              onChange={(e) => setShowMap(e.target.checked)}
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
                    <h3 className="text-lg font-semibold">Discounts</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage discount codes and discounts
                    </p>
                  </div>
                  {canCreateCoupons && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Discount
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
                  <Card className="border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plug className="h-5 w-5 text-primary" />
                        Integration Controls
                      </CardTitle>
                      <CardDescription>
                        This page now uses the API-backed integrations editor as the single source of truth.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Summary cards stay read-only unless the underlying integration has real saved settings.
                        Configure providers below so tours, storage, and external sync behavior stay consistent
                        across admin and client views.
                      </p>
                    </CardContent>
                  </Card>

                  <ToursSection
                    onOpenSettings={() => {
                      document.getElementById('api-integrations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  />

                  {/* SMS / Telnyx Settings Card */}
                  <Card className="border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          SMS Settings (Telnyx)
                        </CardTitle>
                        <CardDescription>
                          Configure your Telnyx sender and messaging settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          Manage your Telnyx SMS integration including sender configuration and messaging settings.
                        </p>
                      <Button onClick={() => navigate('/messaging/settings')}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open SMS Settings
                      </Button>
                    </CardContent>
                  </Card>

                  {/* API Integrations Section */}
                  <div id="api-integrations" className="space-y-6 pt-8 border-t">
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

            {canViewWatermark && (
              <TabsContent value="watermark" className="space-y-6">
                <WatermarkEditor />
              </TabsContent>
            )}

            {canViewRobbieSettings && (
              <TabsContent value="robbie" className="space-y-6">
                <RobbieSettings />
              </TabsContent>
            )}

            {showSystemOverviewTab && (
              <TabsContent value="overview" className="space-y-6">
                <SystemOverviewTab />
              </TabsContent>
            )}
          </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;

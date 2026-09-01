
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/profile/ImageUpload";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "@/lib/sonner-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import type { UserRole } from "@/types/auth";
import { useSelfProfileSave } from "@/hooks/useSelfProfileSave";
import { ProfileActivityCard } from "@/components/profile/ProfileActivityCard";
import { ProfileSecurityCard } from "@/components/profile/ProfileSecurityCard";

const getRoleLabel = (role?: UserRole) => {
  switch (role) {
    case 'superadmin':
      return 'Super Admin';
    case 'editing_manager':
      return 'Editing Manager';
    case 'salesRep':
      return 'Sales Rep';
    case 'admin':
    default:
      return 'Admin';
  }
};

const getRoleBadgeClassName = (role?: UserRole) => {
  switch (role) {
    case 'superadmin':
      return 'bg-red-600 hover:bg-red-700';
    case 'editing_manager':
      return 'bg-violet-600 hover:bg-violet-700';
    case 'salesRep':
      return 'bg-indigo-600 hover:bg-indigo-700';
    case 'admin':
    default:
      return 'bg-blue-600 hover:bg-blue-700';
  }
};

export function AdminProfile() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { preferences: displayPreferences, setTemperatureUnit, setTimeFormat } = useUserPreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roleLabel = getRoleLabel(user?.role);
  const { saveProfile } = useSelfProfileSave();
  const metadata = (user?.metadata ?? {}) as Record<string, unknown>;
  const savedPreferences = metadata.preferences && typeof metadata.preferences === 'object'
    ? metadata.preferences as Record<string, unknown>
    : {};
  const savedNotifications = savedPreferences.notifications && typeof savedPreferences.notifications === 'object'
    ? savedPreferences.notifications as Record<string, unknown>
    : {};
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
    department: String(savedPreferences.department || "Operations"),
    notifications: {
      shootReminders: typeof savedNotifications.shootReminders === 'boolean' ? savedNotifications.shootReminders : true,
      paymentReminders: typeof savedNotifications.paymentReminders === 'boolean' ? savedNotifications.paymentReminders : true,
      weeklySummaries: typeof savedNotifications.weeklySummaries === 'boolean' ? savedNotifications.weeklySummaries : true
    },
    uiDensity: String(savedPreferences.uiDensity || "default"),
    currentPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    const [category, setting] = name.split('.');
    
    if (category === 'notifications') {
      setFormData(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          [setting]: checked
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: checked }));
    }
  };

  const handleAvatarChange = async (url: string) => {
    setFormData(prev => ({ ...prev, avatar: url }));

    // Don't save blob URLs to the backend
    if (url.startsWith('blob:')) return;

    try {
      const result = await saveProfile({ avatar: url || null });
      if (!result.reauthRequired) {
        toast.success(url ? "Avatar saved" : "Avatar removed");
      }
    } catch (error) {
      console.error('Error saving avatar:', error);
      toast.error("Could not save avatar. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const result = await saveProfile({
          name: formData.name,
          email: formData.email,
          current_password: formData.email !== user?.email ? formData.currentPassword : undefined,
          avatar: formData.avatar || null,
          preferences: {
            department: formData.department || null,
            uiDensity: formData.uiDensity,
            notifications: formData.notifications,
          },
      });
      if (!result.reauthRequired) {
        setFormData((prev) => ({ ...prev, currentPassword: "" }));
        toast.success(result.message);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{roleLabel} Profile</h2>
          <p className="text-muted-foreground">
            Manage your account information and preferences
          </p>
        </div>
        <Badge className={getRoleBadgeClassName(user?.role)}>{roleLabel}</Badge>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your profile details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                  <ImageUpload 
                    onChange={handleAvatarChange}
                    initialImage={formData.avatar}
                  />
                  <div className="space-y-4 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Your full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="you@example.com"
                        />
                        <p className="text-xs text-muted-foreground">Changing your email requires your current password.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          placeholder="Your department"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Input
                          id="role"
                          value={roleLabel}
                          readOnly
                          disabled
                          className="opacity-70"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                          id="currentPassword"
                          name="currentPassword"
                          type="password"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          placeholder="Required only if you change your email"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Customize when and how you receive alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="notifications.shootReminders">Shoot Reminders</Label>
                      <p className="text-sm text-muted-foreground">Receive alerts about upcoming shoots</p>
                    </div>
                    <Switch
                      id="notifications.shootReminders"
                      checked={formData.notifications.shootReminders}
                      onCheckedChange={(checked) => handleSwitchChange("notifications.shootReminders", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="notifications.paymentReminders">Payment Reminders</Label>
                      <p className="text-sm text-muted-foreground">Get notified about pending payments</p>
                    </div>
                    <Switch
                      id="notifications.paymentReminders"
                      checked={formData.notifications.paymentReminders}
                      onCheckedChange={(checked) => handleSwitchChange("notifications.paymentReminders", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="notifications.weeklySummaries">Weekly Summaries</Label>
                      <p className="text-sm text-muted-foreground">Receive weekly platform activity reports</p>
                    </div>
                    <Switch
                      id="notifications.weeklySummaries"
                      checked={formData.notifications.weeklySummaries}
                      onCheckedChange={(checked) => handleSwitchChange("notifications.weeklySummaries", checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interface Preferences</CardTitle>
                <CardDescription>Customize your dashboard experience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="darkMode">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">Use dark theme across the platform</p>
                    </div>
                    <Switch
                      id="darkMode"
                      checked={theme === 'dark'}
                      onCheckedChange={toggleTheme}
                    />
                  </div>
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="uiDensity">Compact UI</Label>
                      <p className="text-sm text-muted-foreground">Use more compact layout for denser information</p>
                    </div>
                    <Switch
                      id="uiDensity"
                      checked={formData.uiDensity === 'compact'}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, uiDensity: checked ? 'compact' : 'default' }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="temperatureUnit">Temperature Unit</Label>
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
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="timeFormat">24-Hour Time Format</Label>
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
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Updating..." : "Update Profile"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          <ProfileActivityCard />
          <ProfileSecurityCard />
        </div>
      </div>
    </div>
  );
}

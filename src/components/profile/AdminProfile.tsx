
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/profile/ImageUpload";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertTriangle, Clock, Activity, Settings, Thermometer, Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { API_BASE_URL } from "@/config/env";
import axios from 'axios';

export function AdminProfile() {
  const { user, setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { preferences, setTemperatureUnit, setTimeFormat } = useUserPreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
    department: "Operations",
    notifications: {
      shootReminders: true,
      paymentReminders: true,
      weeklySummaries: true
    },
    uiDensity: "default"
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

    // Save avatar to backend immediately for better UX
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) return;

      const { data } = await axios.put(
        `${API_BASE_URL}/api/profile`,
        { avatar: url || null },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (data.user && user) {
        setUser({ ...user, ...data.user, avatar: data.user.avatar });
      }

      toast.success(url ? "Avatar saved" : "Avatar removed");
    } catch (error) {
      console.error('Error saving avatar:', error);
      toast.error("Could not save avatar. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          avatar: formData.avatar || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      // Update local user state
      if (data.user && user) {
        setUser({ ...user, ...data.user });
      }

      toast.success("Profile updated successfully");
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

  // Mock activity log
  const activityLog = [
    { id: 1, action: "Login", timestamp: "2025-04-05 09:32 AM", ip: "192.168.1.100" },
    { id: 2, action: "Updated Shoot #1234", timestamp: "2025-04-04 03:15 PM", ip: "192.168.1.100" },
    { id: 3, action: "Approved Payment", timestamp: "2025-04-04 01:47 PM", ip: "192.168.1.100" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Profile</h2>
          <p className="text-muted-foreground">
            Manage your account information and admin preferences
          </p>
        </div>
        {user?.role === 'superadmin' ? (
          <Badge className="bg-red-600 hover:bg-red-700">Super Admin</Badge>
        ) : (
          <Badge className="bg-blue-600 hover:bg-blue-700">Admin</Badge>
        )}
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
                          value={user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                          readOnly
                          disabled
                          className="opacity-70"
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
                        {preferences.temperatureUnit === 'celsius' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}
                      </p>
                    </div>
                    <Switch
                      id="temperatureUnit"
                      checked={preferences.temperatureUnit === 'celsius'}
                      onCheckedChange={(checked) => setTemperatureUnit(checked ? 'celsius' : 'fahrenheit')}
                    />
                  </div>
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="timeFormat">24-Hour Time Format</Label>
                      <p className="text-sm text-muted-foreground">
                        {preferences.timeFormat === '24h' ? '24-hour format (14:30)' : '12-hour format (2:30 PM)'}
                      </p>
                    </div>
                    <Switch
                      id="timeFormat"
                      checked={preferences.timeFormat === '24h'}
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Account Activity
              </CardTitle>
              <CardDescription>Recent actions performed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityLog.map(activity => (
                  <div key={activity.id} className="border-b pb-3 last:border-b-0">
                    <div className="flex justify-between">
                      <span className="font-medium text-sm">{activity.action}</span>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        {activity.timestamp.split(' ')[1]}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-muted-foreground">{activity.timestamp.split(' ')[0]}</span>
                      <span className="text-xs text-muted-foreground">IP: {activity.ip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-center border-t pt-4">
              <Button variant="outline" size="sm">View Full Activity Log</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Password</span>
                    <span className="text-xs text-muted-foreground">Last changed 30 days ago</span>
                  </div>
                  <Button variant="outline" size="sm">Change Password</Button>
                </div>
                <div className="flex flex-col space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Two-Factor Authentication</span>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Not Enabled
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm">Enable 2FA</Button>
                </div>
                <div className="flex flex-col space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Active Sessions</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      1 Active
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm">Manage Sessions</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

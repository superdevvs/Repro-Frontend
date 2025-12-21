
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
import { FileEdit, ClipboardList } from "lucide-react";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

export function EditorProfile() {
  const { user } = useAuth();
  const { preferences, setTemperatureUnit, setTimeFormat } = useUserPreferences();
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    avatar: user?.avatar || "",
    showEditingNotes: true,
    emailNotifications: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleAvatarChange = (url: string) => {
    setFormData(prev => ({ ...prev, avatar: url }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, save to database
    toast.success("Profile updated successfully");
  };

  // Mock data for editor stats
  const editorStats = {
    assignedShoots: 12,
    completedEdits: 146,
    pendingEdits: 8,
    avgTurnaroundTime: "1.5 days"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Editor Profile</h2>
          <p className="text-muted-foreground">
            Manage your account information and editing preferences
          </p>
        </div>
        <Badge className="bg-purple-600 hover:bg-purple-700">Editor</Badge>
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
                          readOnly
                          disabled
                          className="opacity-70"
                        />
                        <p className="text-xs text-muted-foreground">Contact admin to change email</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="(123) 456-7890"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Editor Preferences</CardTitle>
                <CardDescription>Customize your editing experience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="showEditingNotes">Auto Display Editing Notes</Label>
                      <p className="text-sm text-muted-foreground">Show editing notes when opening a shoot</p>
                    </div>
                    <Switch
                      id="showEditingNotes"
                      checked={formData.showEditingNotes}
                      onCheckedChange={(checked) => handleSwitchChange("showEditingNotes", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNotifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications for new assignments</p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={formData.emailNotifications}
                      onCheckedChange={(checked) => handleSwitchChange("emailNotifications", checked)}
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
              <CardFooter className="border-t pt-6">
                <Button type="submit">Update Info</Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Editor Stats</CardTitle>
              <CardDescription>Your current workload and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Assigned Shoots</span>
                  <span className="font-medium">{editorStats.assignedShoots}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed Edits</span>
                  <span className="font-medium">{editorStats.completedEdits}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Edits</span>
                  <span className="font-medium">{editorStats.pendingEdits}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg. Turnaround</span>
                  <span className="font-medium">{editorStats.avgTurnaroundTime}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access Information</CardTitle>
              <CardDescription>Your system permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-md p-3">
                  <h4 className="font-medium mb-2 text-sm">Access Level</h4>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-600">Editor</Badge>
                  </div>
                  <p className="text-xs mt-2 text-muted-foreground">
                    You have access to photo editing features and assigned shoots
                  </p>
                </div>
                <div className="border rounded-md p-3">
                  <h4 className="font-medium mb-2 text-sm">Features Access</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      <FileEdit className="h-3 w-3" />
                      <span>Edit Photos</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <ClipboardList className="h-3 w-3" />
                      <span>View Tasks</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

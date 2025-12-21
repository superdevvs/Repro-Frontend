
import { useState } from "react";
import { User } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

const availableNotifications: NotificationSetting[] = [
  {
    id: "new_shoot",
    label: "New Shoot Assignments",
    description: "Notify when assigned to a new shoot",
    defaultEnabled: true,
  },
  {
    id: "shoot_changes",
    label: "Shoot Changes",
    description: "Notify when there are changes to scheduled shoots",
    defaultEnabled: true,
  },
  {
    id: "messages",
    label: "New Messages",
    description: "Notify when receiving new messages",
    defaultEnabled: true,
  },
  {
    id: "account_updates",
    label: "Account Updates",
    description: "Notify about account changes",
    defaultEnabled: false,
  },
  {
    id: "system_announcements",
    label: "System Announcements",
    description: "Notify about important system updates",
    defaultEnabled: true,
  },
  {
    id: "invoice_created",
    label: "Invoices Created",
    description: "Notify when a new invoice is created",
    defaultEnabled: true,
  },
  {
    id: "invoice_paid",
    label: "Invoices Paid",
    description: "Notify when an invoice is paid",
    defaultEnabled: true,
  },
];

interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSubmit?: (userId: string, notificationSettings: Record<string, boolean>) => void;
}

export function NotificationSettingsDialog({
  open,
  onOpenChange,
  user,
  onSubmit = () => {},
}: NotificationSettingsDialogProps) {
  const [settings, setSettings] = useState<Record<string, boolean>>(
    availableNotifications.reduce((acc, notification) => {
      acc[notification.id] = notification.defaultEnabled;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const handleToggle = (id: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      [id]: checked,
    }));
  };

  const handleSubmit = () => {
    if (user) {
      onSubmit(user.id, settings);
    }
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Configure notification preferences for {user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-lg">Email Notifications</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                const allEnabled = Object.values(settings).every(v => v);
                const newValue = !allEnabled;
                
                const newSettings = availableNotifications.reduce((acc, { id }) => {
                  acc[id] = newValue;
                  return acc;
                }, {} as Record<string, boolean>);
                
                setSettings(newSettings);
              }}
            >
              {Object.values(settings).every(v => v) ? "Disable All" : "Enable All"}
            </Button>
          </div>
          
          <Separator />
          
          <div className="grid gap-4 md:grid-cols-2">
            {availableNotifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/40 p-4"
              >
                <div className="space-y-1">
                  <Label htmlFor={`notification-${notification.id}`} className="font-medium">
                    {notification.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {notification.description}
                  </p>
                </div>
                <Switch
                  id={`notification-${notification.id}`}
                  checked={settings[notification.id]}
                  onCheckedChange={(checked) => handleToggle(notification.id, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

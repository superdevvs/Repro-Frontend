
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSubmit?: (userId: string, notificationSettings: { notificationEmail: boolean }) => Promise<boolean | void> | boolean | void;
}

export function NotificationSettingsDialog({
  open,
  onOpenChange,
  user,
  onSubmit = () => {},
}: NotificationSettingsDialogProps) {
  const [notificationEmail, setNotificationEmail] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    const preferences = (user.metadata?.preferences ?? {}) as Record<string, unknown>;
    setNotificationEmail(typeof preferences.notificationEmail === 'boolean' ? preferences.notificationEmail : true);
    setError(null);
  }, [open, user]);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await onSubmit(user.id, { notificationEmail });
      if (result !== false) onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save notification preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSaving) return;
    if (!nextOpen) setError(null);
    onOpenChange(nextOpen);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Configure notification preferences for {user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="space-y-1">
              <Label htmlFor="notification-email" className="font-medium">Internal message emails</Label>
              <p className="text-sm text-muted-foreground">
                Send an email when this user receives a new internal dashboard message.
              </p>
            </div>
            <Switch id="notification-email" checked={notificationEmail} onCheckedChange={setNotificationEmail} disabled={isSaving} />
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

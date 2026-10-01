import { Link } from 'react-router-dom';
import { ArrowRight, Bell } from 'lucide-react';

export function NotificationSettingsLink() {
  return (
    <Link
      to="/settings?tab=notifications"
      className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Notification settings</p>
        <p className="text-sm text-muted-foreground">Manage your notifications in Settings.</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

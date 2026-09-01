import { useCallback, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, Clock3, Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getProfileActivity,
  profileSecurityErrorMessage,
  type ProfileActivity,
} from '@/services/profileSecurityService';

const safeDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ActivityRow = ({ activity }: { activity: ProfileActivity }) => {
  const date = safeDate(activity.timestamp);

  return (
    <div className="space-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-5">{activity.title}</p>
          {activity.description && (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{activity.description}</p>
          )}
        </div>
        {date && (
          <Badge variant="outline" className="shrink-0 font-normal">
            <Clock3 className="mr-1 h-3 w-3" />
            {formatDistanceToNow(date, { addSuffix: true })}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {date && <span title={format(date, 'PPpp')}>{format(date, 'PPp')}</span>}
        {activity.device && activity.device !== 'Unknown device' && <span>{activity.device}</span>}
        {activity.ip_address && <span>IP {activity.ip_address}</span>}
      </div>
    </div>
  );
};

export function ProfileActivityCard() {
  const [activities, setActivities] = useState<ProfileActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setActivities(await getProfileActivity());
    } catch (loadError) {
      setError(profileSecurityErrorMessage(loadError, 'Could not load account activity.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivity();
    const refresh = () => void loadActivity();
    window.addEventListener('profile-activity-changed', refresh);
    return () => window.removeEventListener('profile-activity-changed', refresh);
  }, [loadActivity]);

  const content = isLoading ? (
    <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading activity…
    </div>
  ) : error ? (
    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p>{error}</p>
      <Button variant="outline" size="sm" onClick={() => void loadActivity()}>
        <RefreshCw className="mr-2 h-4 w-4" /> Retry
      </Button>
    </div>
  ) : activities.length === 0 ? (
    <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
      New sign-ins and account changes will appear here.
    </div>
  ) : (
    <div>{activities.slice(0, 3).map((activity) => <ActivityRow key={activity.id} activity={activity} />)}</div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Account Activity
          </CardTitle>
          <CardDescription>Verified sign-ins and account changes</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
        {!isLoading && !error && activities.length > 3 && (
          <CardFooter className="border-t pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(true)}>
              View all {activities.length} events
            </Button>
          </CardFooter>
        )}
      </Card>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Account activity</DialogTitle>
            <DialogDescription>Your most recent security and profile events.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {activities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

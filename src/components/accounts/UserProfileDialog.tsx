
import { User } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar, 
  AvatarFallback, 
  AvatarImage
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ShootData } from "@/types/shoots";
import type { RepDetails } from "@/types/auth";

interface UserActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

// Mock data for user activity
const mockActivities: UserActivity[] = [
  {
    id: "1",
    type: "login",
    description: "User logged in",
    timestamp: new Date().toISOString(),
  },
  {
    id: "2",
    type: "role_change",
    description: "User role changed from Client to Photographer",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "3",
    type: "shoot_assigned",
    description: "Assigned to shoot #12345",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
  },
];

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onEdit?: () => void;
  accountRep?: string;
  lastShootDate?: string;
  shootStats?: {
    totalShoots: number;
    completedShoots: number;
    upcomingShoots: number;
    lastShootDate?: string;
  };
  recentScheduledShoots?: ShootData[];
  recentCompletedShoots?: ShootData[];
}

export function UserProfileDialog({
  open,
  onOpenChange,
  user,
  onEdit = () => {},
  accountRep = 'Unassigned',
  lastShootDate,
  shootStats,
  recentScheduledShoots = [],
  recentCompletedShoots = [],
}: UserProfileDialogProps) {
  if (!user) return null;

  const { role: viewerRole } = useAuth();
  const canSeeSensitiveRepData = viewerRole === 'superadmin';
  const repDetails = (user.metadata?.repDetails as RepDetails | undefined) || undefined;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return format(date, "MMM d, yyyy");
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return format(date, "MMM d, yyyy 'at' h:mm a");
  };

  const stats = shootStats || {
    totalShoots: 0,
    completedShoots: 0,
    upcomingShoots: 0,
    lastShootDate,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center space-y-3">
            <Avatar className="h-24 w-24">
              <AvatarImage src={getAvatarUrl(user.avatar, user.role, (user as any).gender, user.id)} alt={user.name} />
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge className="mt-2">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Badge>
            </div>
          </div>

          <div className="flex-1">
            <Tabs defaultValue="info">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="info">Profile Info</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
                <TabsTrigger value="stats">Stats</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {user.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{user.phone}</p>
                    </div>
                  )}
                  
                  {user.company && (
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-medium">{user.company}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground">Account Rep</p>
                    <p className="font-medium">{accountRep || 'Unassigned'}</p>
                  </div>

                  {user.role === 'client' && (user as any).created_by_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Created By</p>
                      <p className="font-medium">{(user as any).created_by_name || (user as any).createdBy || 'N/A'}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground">Last Shoot</p>
                    <p className="font-medium">{formatDate(lastShootDate)}</p>
                  </div>
                  
                  {user.createdAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Account Created</p>
                      <p className="font-medium">
                        {format(new Date(user.createdAt), "PPP")}
                      </p>
                    </div>
                  )}
                  
                  {user.lastLogin && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Login</p>
                      <p className="font-medium">
                        {format(new Date(user.lastLogin), "PPP 'at' p")}
                      </p>
                    </div>
                  )}
                  {user.role === 'salesRep' && repDetails && (
                    <div className="md:col-span-2 rounded-lg border border-dashed border-border/70 p-3 space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Payout Email</p>
                        <p className="font-medium">{repDetails.payoutEmail || "—"}</p>
                      </div>
                      {repDetails.payoutFrequency && (
                        <div>
                          <p className="text-sm text-muted-foreground">Payout Frequency</p>
                          <p className="font-medium capitalize">{repDetails.payoutFrequency}</p>
                        </div>
                      )}
                      {repDetails.salesCategories?.length ? (
                        <div>
                          <p className="text-sm text-muted-foreground">Sales Categories</p>
                          <p className="font-medium">{repDetails.salesCategories.join(", ")}</p>
                        </div>
                      ) : null}
                      {typeof repDetails.autoApprovePayouts === 'boolean' && (
                        <div>
                          <p className="text-sm text-muted-foreground">Auto Approvals</p>
                          <p className="font-medium">
                            {repDetails.autoApprovePayouts ? "Enabled" : "Requires manual approval"}
                          </p>
                        </div>
                      )}
                      {typeof repDetails.smsEnabled === 'boolean' && (
                        <div>
                          <p className="text-sm text-muted-foreground">SMS Outreach</p>
                          <p className="font-medium">{repDetails.smsEnabled ? "Allowed" : "Disabled"}</p>
                        </div>
                      )}
                      {repDetails.notes && (
                        <div>
                          <p className="text-sm text-muted-foreground">Internal Notes</p>
                          <p className="font-medium">{repDetails.notes}</p>
                        </div>
                      )}
                      {canSeeSensitiveRepData && repDetails.commissionPercentage !== undefined && (
                        <div>
                          <p className="text-sm text-muted-foreground">Commission %</p>
                          <p className="font-medium">{repDetails.commissionPercentage}%</p>
                        </div>
                      )}
                      {canSeeSensitiveRepData && repDetails.homeAddress && (
                        <div>
                          <p className="text-sm text-muted-foreground">Home Address</p>
                          <p className="font-medium">
                            {[repDetails.homeAddress.line1, repDetails.homeAddress.line2, repDetails.homeAddress.city, repDetails.homeAddress.state, repDetails.homeAddress.postalCode]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {user.companyNotes && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Company Notes</p>
                    <p className="mt-1">{user.companyNotes}</p>
                  </div>
                )}

                {user.role === 'client' && (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-medium">Recent Scheduled Shoots</p>
                    {recentScheduledShoots.length ? (
                      <div className="space-y-3">
                        {recentScheduledShoots.map((shoot) => (
                          <div key={shoot.id} className="rounded-lg border border-border/70 p-3">
                            <p className="font-medium">{shoot.location.address}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(shoot.scheduledDate)} · {shoot.status}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No scheduled shoots yet.</p>
                    )}
                  </div>
                )}

                {user.role === 'photographer' && (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-medium">Recent Completed Shoots</p>
                    {recentCompletedShoots.length ? (
                      <div className="space-y-3">
                        {recentCompletedShoots.map((shoot) => (
                          <div key={shoot.id} className="rounded-lg border border-border/70 p-3">
                            <p className="font-medium">{shoot.client.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(shoot.completedDate || shoot.scheduledDate)} · {shoot.status}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No completed shoots yet.</p>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="activity" className="pt-4">
                <div className="space-y-4">
                  <h3 className="font-medium">Recent Activity</h3>
                  <div className="space-y-4">
                    {mockActivities.map(activity => (
                      <div key={activity.id} className="border-b pb-3">
                        <div className="flex justify-between">
                          <p className="font-medium">{activity.description}</p>
                          <Badge variant="outline">{activity.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(activity.timestamp), "PPP 'at' p")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="stats" className="pt-4">
                <div className="space-y-4">
                  <h3 className="font-medium">Account Statistics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Total Shoots</p>
                      <p className="text-2xl font-bold">{stats.totalShoots}</p>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Completed Shoots</p>
                      <p className="text-2xl font-bold">{stats.completedShoots}</p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Upcoming Shoots</p>
                      <p className="text-2xl font-bold">{stats.upcomingShoots}</p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Last Shoot Date</p>
                      <p className="text-2xl font-bold">{formatDate(stats.lastShootDate)}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onEdit}>
            Edit Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


import { useState } from "react";
import { User, Role } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Pencil,
  UserCog,
  KeyRound,
  Bell,
  Link,
  Camera,
  ExternalLink,
  Trash2,
  LogIn
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Client } from "@/types/clients";
import type { RepDetails } from "@/types/auth";

interface AccountCardProps {
  user: User;
  onEdit: (user: User) => void;
  onChangeRole: (user: User) => void;
  onResetPassword: (user: User) => void;
  onImpersonate: (user: User) => void;
  onManageNotifications: (user: User) => void;
  onLinkClientBranding: (user: User) => void;
  onViewProfile: (user: User) => void;
  onDeleteUser?: (user: User) => void;
  isActive?: boolean;
  clientMenuActions?: {
    onBookShoot: (e: React.MouseEvent) => void;
    onClientPortal: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
  };
}

export function AccountCard({
  user,
  onEdit,
  onChangeRole,
  onResetPassword,
  onImpersonate,
  onManageNotifications,
  onLinkClientBranding,
  onViewProfile,
  onDeleteUser,
  clientMenuActions,
}: AccountCardProps) {
  const [hovering, setHovering] = useState(false);
  const { role: viewerRole } = useAuth();
  const isSuperAdmin = viewerRole === 'superadmin';
  const isAdmin = viewerRole === 'admin';
  const canViewSensitiveRepData = isSuperAdmin;
  const canManageAccounts = isAdmin || isSuperAdmin;
  const canEditClients = canManageAccounts || viewerRole === 'salesRep';
  const canEditThisUser = canManageAccounts || (viewerRole === 'salesRep' && user.role === 'client');
  const canChangeRole = isSuperAdmin; // Only Super Admin can change access rules for other account types
  const repDetails = (user.metadata?.repDetails as RepDetails | undefined) || undefined;

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'superadmin': return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800";
      case 'admin': return "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 border-purple-200 dark:border-purple-800";
      case 'editing_manager': return "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200 border-violet-200 dark:border-violet-800";
      case 'photographer': return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800";
      case 'client': return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-800";
      case 'editor': return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800";
      case 'salesRep': return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card 
      className={`overflow-hidden transition-all duration-200 hover:shadow-md dark:shadow-none ${
        hovering ? "transform-gpu -translate-y-1" : ""
      }`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => onViewProfile(user)}
    >
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={getAvatarUrl(user.avatar, user.role, (user as any).gender, user.id)} alt={user.name} />
              <AvatarFallback className="bg-[#F1F0FB] dark:bg-slate-800 text-[#6E59A5] dark:text-[#9b87f5] font-medium">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-base">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {canEditThisUser && (
                <DropdownMenuItem onClick={(e) => { 
                  e.stopPropagation();
                  onEdit(user);
                }}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit User
                </DropdownMenuItem>
              )}
              {/* Only Super Admin can change roles (access rules) */}
              {canChangeRole && (
                <DropdownMenuItem onClick={(e) => { 
                  e.stopPropagation();
                  onChangeRole(user);
                }}>
                  <UserCog className="mr-2 h-4 w-4" /> Change Role
                </DropdownMenuItem>
              )}
              {canManageAccounts && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onImpersonate(user);
                  }}>
                    <LogIn className="mr-2 h-4 w-4" /> Login as User
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { 
                    e.stopPropagation();
                    onResetPassword(user);
                  }}>
                    <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { 
                    e.stopPropagation();
                    onManageNotifications(user);
                  }}>
                    <Bell className="mr-2 h-4 w-4" /> Notification Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { 
                    e.stopPropagation();
                    onLinkClientBranding(user);
                  }}>
                    <Link className="mr-2 h-4 w-4" /> Link Client/Branding
                  </DropdownMenuItem>
                </>
              )}
              {user.role === 'client' && clientMenuActions && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      clientMenuActions.onBookShoot(e);
                    }}>
                      <Camera className="mr-2 h-4 w-4" /> Book Shoot
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      clientMenuActions.onClientPortal(e);
                    }}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Client Portal
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => {
                      e.stopPropagation();
                      clientMenuActions.onDelete(e);
                    }}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Client
                    </DropdownMenuItem>
                </>
              )}
              {/* Delete Account - Super Admin only */}
              {isSuperAdmin && onDeleteUser && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-600 focus:text-red-600" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteUser(user);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="space-y-3">
          {user.company && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Company:</span>
              <span className="text-muted-foreground">{user.company}</span>
            </div>
          )}
          {user.phone && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Phone:</span>
              <span className="text-muted-foreground">{user.phone}</span>
            </div>
          )}
          {user.role === 'salesRep' && repDetails && (
            <div className="space-y-1 rounded-md border border-dashed border-border/60 p-3 text-sm">
              <p className="font-medium">Rep Overview</p>
              {repDetails.payoutEmail && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Payout:</span> {repDetails.payoutEmail}
                </div>
              )}
              {repDetails.salesCategories?.length ? (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Categories:</span>{" "}
                  {repDetails.salesCategories.join(", ")}
                </div>
              ) : null}
              {canViewSensitiveRepData && repDetails.commissionPercentage !== undefined && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Commission:</span>{" "}
                  {repDetails.commissionPercentage}%
                </div>
              )}
              {canViewSensitiveRepData && repDetails.homeAddress && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Home:</span>{" "}
                  {[repDetails.homeAddress.line1, repDetails.homeAddress.line2, repDetails.homeAddress.city, repDetails.homeAddress.state, repDetails.homeAddress.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
            </div>
          )}
          {/* {user.lastLogin && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Last active {formatDistance(new Date(user.lastLogin), new Date(), { addSuffix: true })}</span>
            </div>
          )} */}
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
          <Badge 
            variant="outline" 
            className={`${getRoleBadgeColor(user.role)} border`}
          >
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Badge>
          
        </div>
      </div>
    </Card>
  );
}

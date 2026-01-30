
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Role } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth";
import { Camera, ExternalLink, Trash2, LogIn } from "lucide-react";
import { format } from "date-fns";

interface AccountListProps {
  users: Array<User & { active?: boolean; accountRep?: string; lastShootDate?: string }>;
  onEdit: (user: User) => void;
  onChangeRole: (user: User) => void;
  onResetPassword: (user: User) => void;
  onImpersonate: (user: User) => void;
  onManageNotifications: (user: User) => void;
  onLinkClientBranding: (user: User) => void;
  onViewProfile: (user: User) => void;
  onDeleteUser: (user: User) => void;
  getClientMenuActions?: (user: User) => {
    onBookShoot: (e: React.MouseEvent) => void;
    onClientPortal: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
  } | undefined;
}

export function AccountList({
  users,
  onEdit,
  onChangeRole,
  onResetPassword,
  onImpersonate,
  onManageNotifications,
  onLinkClientBranding,
  onViewProfile,
  onDeleteUser,
  getClientMenuActions,
}: AccountListProps) {
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

  const formatRoleLabel = (value: string) =>
    value
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (char) => char.toUpperCase());

  const { role: viewerRole } = useAuth();
  const isSuperAdmin = viewerRole === 'superadmin';
  const isAdmin = viewerRole === 'admin';
  const canManageAccounts = isAdmin || isSuperAdmin;
  const canEditClients = canManageAccounts || viewerRole === 'salesRep';
  const canChangeRole = isSuperAdmin; // Only Super Admin can change access rules for other account types

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return format(date, "MMM d, yyyy");
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Rep</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Last Shoot</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const canEditRow = canManageAccounts || (viewerRole === 'salesRep' && user.role === 'client');
            const secondaryRoles = Array.isArray((user as any).secondaryRoles)
              ? (user as any).secondaryRoles
              : Array.isArray((user as any).secondary_roles)
                ? (user as any).secondary_roles
                : [];
            const secondaryRoleList = secondaryRoles
              .filter((role: Role) => role && role !== user.role)
              .filter((role: Role, index: number, list: Role[]) => list.indexOf(role) === index);
            return (
              <TableRow key={user.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <TableCell onClick={() => onViewProfile(user)}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={getAvatarUrl(user.avatar, user.role, (user as any).gender, user.id)} alt={user.name} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className={`${getRoleBadgeColor(user.role)} border`}>
                    {formatRoleLabel(user.role)}
                  </Badge>
                  {secondaryRoleList.map((role: Role) => (
                    <Badge
                      key={`${user.id}-${role}`}
                      variant="outline"
                      className={`${getRoleBadgeColor(role)} border text-xs px-2 py-0.5 opacity-80`}
                    >
                      {formatRoleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{user.accountRep || "Unassigned"}</TableCell>
              <TableCell>{user.phone || "—"}</TableCell>
              <TableCell>{formatDate(user.lastShootDate)}</TableCell>
              <TableCell>{user.company || "-"}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {canEditRow && (
                      <DropdownMenuItem onClick={() => onEdit(user)}>
                        Edit User
                      </DropdownMenuItem>
                    )}
                    {/* Only Super Admin can change roles (access rules) */}
                    {canChangeRole && (
                      <DropdownMenuItem onClick={() => onChangeRole(user)}>
                        Change Role
                      </DropdownMenuItem>
                    )}
                    {canManageAccounts && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onImpersonate(user)}>
                          <LogIn className="mr-2 h-4 w-4" /> Login as User
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onResetPassword(user)}>
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onManageNotifications(user)}>
                          Notification Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onLinkClientBranding(user)}>
                          Link Client/Branding
                        </DropdownMenuItem>
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
                    {user.role === 'client' && getClientMenuActions?.(user) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => getClientMenuActions(user)?.onBookShoot(e)}>
                          <Camera className="mr-2 h-4 w-4" /> Book Shoot
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => getClientMenuActions(user)?.onClientPortal(e)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Client Portal
                        </DropdownMenuItem>
                        {!canManageAccounts && (
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => getClientMenuActions(user)?.onDelete(e)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Client
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

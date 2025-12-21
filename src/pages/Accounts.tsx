
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountList } from "@/components/accounts/AccountList";
import { AccountsHeader } from "@/components/accounts/AccountsHeader";
import { AccountForm } from "@/components/accounts/AccountForm";
import { UserProfileDialog } from '@/components/accounts/UserProfileDialog';
import { ResetPasswordDialog } from '@/components/accounts/ResetPasswordDialog';
import { RoleChangeDialog } from '@/components/accounts/RoleChangeDialog';
import { NotificationSettingsDialog } from '@/components/accounts/NotificationSettingsDialog';
import { LinkClientBrandingDialog } from '@/components/accounts/LinkClientBrandingDialog';
import { PermissionsManager } from '@/components/accounts/PermissionsManager';
import { AccountLinkingManager } from '@/components/accounts/AccountLinkingManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Role } from '@/components/auth/AuthProvider';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { UsersIcon, PlusCircle, Loader2 } from 'lucide-react';
import { ClientDetails } from '@/components/clients/ClientDetails';
import { ClientForm } from '@/components/clients/ClientForm';
import { useClientsData } from '@/hooks/useClientsData';
import { useClientActions } from '@/hooks/useClientActions';
import { useShoots } from '@/context/ShootsContext';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { useNavigate } from 'react-router-dom';

const sampleUsersData = [
  {
    id: "1",
    name: "John Smith",
    email: "john@example.com",
    role: "admin" as Role,
    avatar: "/placeholder.svg",
    lastLogin: "2023-04-01T08:30:00Z",
    active: true,
  },
  {
    id: "2",
    name: "Sarah Wilson",
    email: "sarah@photostudio.com",
    role: "photographer" as Role,
    avatar: "/placeholder.svg",
    phone: "555-123-4567",
    lastLogin: "2023-04-02T14:20:00Z",
    active: true,
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "michael@editing.com",
    role: "editor" as Role,
    avatar: "/placeholder.svg",
    phone: "555-987-6543",
    lastLogin: "2023-03-28T09:15:00Z",
    active: true,
  },
  {
    id: "4",
    name: "Emily Davis",
    email: "emily@realestate.com",
    role: "client" as Role,
    company: "Davis Realty",
    avatar: "/placeholder.svg",
    phone: "555-456-7890",
    lastLogin: "2023-04-03T11:40:00Z",
    active: true,
  },
  {
    id: "5",
    name: "Robert Johnson",
    email: "robert@inactive.com",
    role: "client" as Role,
    avatar: "/placeholder.svg",
    lastLogin: "2023-02-15T10:10:00Z",
    active: false,
  },
];

type UserType = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  phone?: string;
  company?: string;
  accountRep?: string;
  lastShootDate?: string;
  metadata?: Record<string, any>;
  created_by_name?: string;
  createdBy?: string;
  [key: string]: any;
};

export default function Accounts() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [repFilter, setRepFilter] = useState<'all' | 'unassigned' | string>('all');
  const { toast } = useToast();
  const { user: currentUser, role: currentUserRole, impersonate, logout } = useAuth();
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);

  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [notificationSettingsDialogOpen, setNotificationSettingsDialogOpen] = useState(false);
  const [linkClientBrandingDialogOpen, setLinkClientBrandingDialogOpen] = useState(false);
  const [userProfileDialogOpen, setUserProfileDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<UserType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const {
    clientsData,
    setClientsData,
    totalClients,
    activeClients,
    totalShoots,
    averageShootsPerClient
  } = useClientsData();

  const {
    selectedClient,
    clientDetailsOpen,
    setClientDetailsOpen,
    clientFormOpen,
    setClientFormOpen,
    clientFormData,
    setClientFormData,
    isEditing,
    showUploadOptions,
    setShowUploadOptions,
    handleClientSelect,
    handleAddClient,
    handleEditClient,
    handleClientFormSubmit,
    handleDeleteClient,
    handleBookShoot,
    handleClientPortal
  } = useClientActions({
    clientsData,
    setClientsData
  });

  const { shoots } = useShoots();
  const navigate = useNavigate();
  const sessionExpiredRef = useRef(false);

  useEffect(() => {
    sessionExpiredRef.current = false;
  }, [currentUser?.id]);

  const handleSessionExpired = useCallback(
    (description?: string) => {
      if (sessionExpiredRef.current) return;
      sessionExpiredRef.current = true;
      toast({
        title: "Session expired",
        description: description || "Please log in again to continue.",
        variant: "destructive",
      });
      logout();
      navigate('/login', { replace: true });
    },
    [logout, navigate, toast],
  );


  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) {
          handleSessionExpired("Please log in to view accounts.");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`, // If needed
          },
        });

        if (res.status === 401 || res.status === 419) {
          handleSessionExpired();
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error('Failed to fetch users');

        const data = await res.json();
        console.log('Fetched users:', data);
        setUsers(data.users || []);
      } catch (err) {
        if (sessionExpiredRef.current) {
          setLoading(false);
          return;
        }
        console.error(err);
        toast({
          title: "Error loading users",
          description: "Unable to fetch user data from server.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [handleSessionExpired, toast]);

  function getAccountRepInfo(user: UserType) {
    const metadata = user.metadata || {};
    const rawRepId = metadata.accountRepId || (user as any).account_rep_id || (user as any).rep_id || (user as any).created_by_id;
    const repUser = rawRepId ? users.find((candidate) => String(candidate.id) === String(rawRepId)) : undefined;
    
    // Check if the potential rep is a superadmin - if so, don't show them as rep
    const isRepUserSuperAdmin = repUser && repUser.role === 'superadmin';
    
    // Get potential rep names from various sources - check by ID first, then by name
    const createdById = (user as any).created_by_id;
    const createdByUserById = createdById ? users.find(u => String(u.id) === String(createdById)) : undefined;
    const createdByUserByName = user.created_by_name ? users.find(u => u.name === user.created_by_name) : undefined;
    const createdByUser = createdByUserById || createdByUserByName;
    const isCreatedBySuperAdmin = createdByUser && createdByUser.role === 'superadmin';
    
    const inferredName =
      // Prefer explicit accountRep metadata if present
      metadata.accountRep ||
      // Fall back to backend "created by" fields, but ONLY if they're not superadmins
      // Prefer the user found by ID (more reliable)
      (createdByUserById && !isCreatedBySuperAdmin ? createdByUserById.name : undefined) ||
      (user.created_by_name && !isCreatedBySuperAdmin ? user.created_by_name : undefined) ||
      (user.createdBy && !isCreatedBySuperAdmin ? user.createdBy : undefined) ||
      // Then check any other legacy / helper fields
      metadata.rep ||
      user.accountRep ||
      // Use rep user name only if they're not a superadmin
      (repUser && !isRepUserSuperAdmin ? repUser.name : undefined) ||
      undefined;

    if (!rawRepId && !inferredName) {
      return undefined;
    }

    return {
      id: rawRepId ? String(rawRepId) : createdById ? String(createdById) : repUser ? String(repUser.id) : undefined,
      name: inferredName,
    };
  }

  const getAccountRep = (user: UserType) => getAccountRepInfo(user)?.name;

  // Build rep options from recorded account reps / creators (e.g. "User Account Created By")
  // so that the Rep filter reflects whoever actually owns or created the account.
  const repOptions = React.useMemo(() => {
    const map = new Map<string, string>();

    users.forEach((user) => {
      const info = getAccountRepInfo(user);
      if (!info?.name) return;

      const key = info.name.trim().toLowerCase();
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, info.name.trim());
      }
    });

    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [users]);

  // Keep current repFilter value in sync with available options
  useEffect(() => {
    if (repFilter === 'all' || repFilter === 'unassigned') return;
    const exists = repOptions.some((option) => option.value === repFilter);
    if (!exists) {
      setRepFilter('all');
    }
  }, [repOptions, repFilter]);

  const filteredUsers = users.filter((user) => {
    const roleMatch = filterRole === "all" || user.role === filterRole;
    const searchMatch = searchQuery === "" ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.company && user.company.toLowerCase().includes(searchQuery.toLowerCase()));
    const repInfo = getAccountRepInfo(user);
    const repKey = repInfo?.name ? repInfo.name.trim().toLowerCase() : undefined;
    const repMatch =
      repFilter === 'all'
        ? true
        : repFilter === 'unassigned'
          ? !repInfo
          : repKey === repFilter;
    return roleMatch && searchMatch && repMatch;
  });

  const normalize = (value?: string | null) => value ? value.trim().toLowerCase() : "";

  const isCompletedShoot = (shoot: ShootData) => {
    const status = shoot.status?.toLowerCase();
    return Boolean(shoot.completedDate) || status === 'completed' || status === 'delivered' || status === 'finalized';
  };

  const getShootsForUser = (user: UserType) => {
    const normalizedEmail = normalize(user.email);
    const normalizedName = normalize(user.name);

    return shoots.filter((shoot) => {
      if (!shoot) return false;
      if (user.role === 'client') {
        return normalize(shoot.client?.email) === normalizedEmail ||
          normalize(shoot.client?.name) === normalizedName;
      }
      if (user.role === 'photographer') {
        return normalize(shoot.photographer?.name) === normalizedName;
      }
      if (user.role === 'editor') {
        return normalize(shoot.editor?.name) === normalizedName;
      }
      const createdBy = normalize(shoot.createdBy);
      return createdBy === normalizedEmail || createdBy === normalizedName;
    });
  };

  const getLastShootDateForUser = (user: UserType) => {
    const userShoots = getShootsForUser(user);
    if (!userShoots.length) return user.lastShootDate;
    const sorted = [...userShoots].sort((a, b) => {
      const aDate = new Date(a.completedDate || a.scheduledDate).getTime();
      const bDate = new Date(b.completedDate || b.scheduledDate).getTime();
      return bDate - aDate;
    });
    const latest = sorted[0];
    return latest.completedDate || latest.scheduledDate;
  };

  const getRecentShootsForUser = (user: UserType, type: 'scheduled' | 'completed') => {
    const history = getShootsForUser(user);
    return history
      .filter((shoot) => type === 'completed' ? isCompletedShoot(shoot) : !isCompletedShoot(shoot))
      .sort((a, b) => {
        const aDate = new Date(type === 'completed' ? (a.completedDate || a.scheduledDate) : a.scheduledDate).getTime();
        const bDate = new Date(type === 'completed' ? (b.completedDate || b.scheduledDate) : b.scheduledDate).getTime();
        return bDate - aDate;
      })
      .slice(0, 3);
  };

  const getShootStatsForUser = (user: UserType) => {
    const history = getShootsForUser(user);
    const completed = history.filter(isCompletedShoot);
    const upcoming = history.filter((shoot) => !isCompletedShoot(shoot));
    return {
      totalShoots: history.length,
      completedShoots: completed.length,
      upcomingShoots: upcoming.length,
      lastShootDate: getLastShootDateForUser(user),
    };
  };

  const accountListUsers = filteredUsers.map((user) => ({
    ...user,
    accountRep: getAccountRep(user) || 'Unassigned',
    lastShootDate: getLastShootDateForUser(user),
  }));

  const handleUpdateUser = (data) => {
    if (!selectedUser) return;

    console.log("Updating account", selectedUser.id, data);

    // Update state locally - include created_by fields for proper display
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === selectedUser.id) {
          return {
            ...u,
            ...data,
            // Ensure created_by fields are properly merged
            created_by_name: data.created_by_name || data.createdBy || u.created_by_name,
            createdBy: data.created_by_name || data.createdBy || u.createdBy,
            created_by_id: data.created_by_id || u.created_by_id,
          };
        }
        return u;
      })
    );

    // Close dialog
    setEditUserDialogOpen(false);

    toast({
      title: "User updated",
      description: `${data.name}'s account has been updated successfully.`,
    });
  };


  const handleAddAccount = () => {
    setIsNewAccountOpen(true);
  };

  const handleNewAccount = (created: any) => {
    // AccountForm already created on server and passes created shape with id
    const newUser: UserType = {
      id: String(created.id),
      name: created.name,
      email: created.email,
      role: created.role,
      avatar: created.avatar || '/placeholder.svg',
      phone: created.phone || created.phone_number || undefined,
      company: created.company || created.company_name || undefined,
      created_by_name: created.created_by_name || created.createdBy || undefined,
      createdBy: created.created_by_name || created.createdBy || undefined,
      metadata: created.metadata || {},
    };
    setUsers(prev => [newUser, ...prev]);
  };

  const handleExport = (format: 'csv' | 'print' | 'copy' = 'csv') => {
    if (!users.length) {
      toast({
        title: "No users to export",
        description: "Please add users before exporting.",
      });
      return;
    }

    const headers = [
      "ID",
      "Name",
      "Email",
      "Role",
      "Phone",
      "Company",
      "Number of Shoots",
      "Account Type",
      "Last Login",
      "Active",
    ];

    const rows = users.map((user) => {
      const userShoots = getShootsForUser(user);
      return [
        user.id,
        user.name,
        user.email,
        user.role,
        user.phone || "",
        user.company || "",
        userShoots.length.toString(),
        user.role,
        user.lastLogin || "",
        user.active ? "Yes" : "No",
      ];
    });

    if (format === 'print') {
      // Create printable HTML table
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const tableHtml = `
          <html>
            <head>
              <title>Accounts Export</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                @media print { body { margin: 0; } }
              </style>
            </head>
            <body>
              <h1>Accounts Export</h1>
              <p>Generated: ${new Date().toLocaleString()}</p>
              <table>
                <thead>
                  <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
              </table>
            </body>
          </html>
        `;
        printWindow.document.write(tableHtml);
        printWindow.document.close();
        printWindow.print();
        toast({
          title: "Print",
          description: "Print dialog opened.",
        });
        return;
      }
    }

    if (format === 'copy') {
      // Copy to clipboard
      const csvContent = [headers, ...rows]
        .map((row) =>
          row
            .map((cell) =>
              typeof cell === "string" && cell.includes(",")
                ? `"${cell.replace(/"/g, '""')}"`
                : cell ?? ""
            )
            .join("\t")
        )
        .join("\n");
      
      navigator.clipboard.writeText(csvContent).then(() => {
        toast({
          title: "Copied",
          description: "Account data copied to clipboard.",
        });
      }).catch(() => {
        toast({
          title: "Copy failed",
          description: "Failed to copy to clipboard.",
          variant: "destructive",
        });
      });
      return;
    }

    // CSV export (default)
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell.replace(/"/g, '""')}"`
              : cell ?? ""
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `accounts-export-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export started",
      description: "A CSV file with account data has been downloaded.",
    });
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditUserDialogOpen(true);
  };

  const handleChangeRole = (user) => {
    setSelectedUser(user);
    setRoleChangeDialogOpen(true);
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
  };

  const handleImpersonate = (user) => {
    impersonate(user);
    toast({
      title: "Impersonating user",
      description: `You are now viewing the dashboard as ${user.name}.`,
    });
    // Small delay to ensure state updates, then navigate
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 100);
  };

  const handleManageNotifications = (user) => {
    setSelectedUser(user);
    setNotificationSettingsDialogOpen(true);
  };

  const handleLinkClientBranding = (user) => {
    setSelectedUser(user);
    setLinkClientBrandingDialogOpen(true);
  };

  const handleViewProfile = (user) => {
    setSelectedUser(user);
    setUserProfileDialogOpen(true);
  };

  const handleUpdateRoles = async (userId: string, roles: Role[]) => {
    const newRole = roles[0];
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        handleSessionExpired();
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.status === 401 || res.status === 419) {
        handleSessionExpired();
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to change role');
      }
      const data = await res.json();
      if (!data.changed) {
        toast({ title: 'No change', description: 'Role was not changed. Try again.', variant: 'destructive' });
        return;
      }
      setUsers(users.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      toast({ title: 'Role updated', description: `User role updated to ${newRole}.` });
    } catch (e: any) {
      console.error('Role change failed', e);
      if (sessionExpiredRef.current) {
        return;
      }
      toast({ title: 'Failed to change role', description: e?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const handleUpdateNotifications = (userId: string, settings: Record<string, boolean>) => {
    toast({
      title: "Notification preferences updated",
      description: "Notification settings have been saved successfully.",
    });
  };

  const handleUpdateClientBranding = (userId: string, data) => {
    toast({
      title: "Client branding updated",
      description: "Client associations and branding settings have been saved.",
    });
  };

  const handleSendResetLink = (userId: string, email: string) => {
    toast({
      title: "Reset link sent",
      description: `Password reset link has been sent to ${email}.`,
    });
  };

  const handleUpdatePassword = (userId: string, password: string) => {
    toast({
      title: "Password updated",
      description: "The user's password has been changed successfully.",
    });
  };

  const requestDeleteUser = (user: UserType) => {
    setUserPendingDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userPendingDelete) return;

    try {
      setIsDeletingUser(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        handleSessionExpired();
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userPendingDelete.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 419) {
        handleSessionExpired();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to delete account');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userPendingDelete.id));

      if (selectedUser && selectedUser.id === userPendingDelete.id) {
        setSelectedUser(null);
        setEditUserDialogOpen(false);
        setUserProfileDialogOpen(false);
        setRoleChangeDialogOpen(false);
        setResetPasswordDialogOpen(false);
        setNotificationSettingsDialogOpen(false);
        setLinkClientBrandingDialogOpen(false);
      }

      toast({
        title: "Account deleted",
        description: `${userPendingDelete.name}'s account has been removed.`,
      });
    } catch (error: any) {
      if (sessionExpiredRef.current) return;
      console.error('Delete user failed', error);
      toast({
        title: "Delete failed",
        description: error?.message || 'Unable to delete this account.',
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
      setIsDeleteDialogOpen(false);
      setUserPendingDelete(null);
    }
  };



  // Determine which tabs to show based on user role
  const isSuperAdmin = currentUserRole === 'superadmin';
  const isAdminOrSuperAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
  const showPermissionsTab = isAdminOrSuperAdmin; // Allow both admin and superadmin to see permissions
  const showLinkingTab = isAdminOrSuperAdmin;

  // Calculate number of tabs to show
  const tabCount =
    1 +
    (showPermissionsTab ? 1 : 0) +
    (showLinkingTab ? 1 : 0);
  const gridCols =
    tabCount === 4
      ? 'grid-cols-4'
      : tabCount === 3
        ? 'grid-cols-3'
        : tabCount === 2
          ? 'grid-cols-2'
          : 'grid-cols-1';

  const getClientMenuHandlers = (user: UserType) => {
    const client = clientsData.find(
      (c) => c.id === String(user.id) || c.email === user.email
    );
    if (!client) return undefined;
    return {
      onBookShoot: (e: React.MouseEvent) => handleBookShoot(client, e),
      onClientPortal: (e: React.MouseEvent) => handleClientPortal(client, e),
      onDelete: (e: React.MouseEvent) => handleDeleteClient(client, e),
    };
  };

  const selectedUserAccountRep = selectedUser ? (getAccountRep(selectedUser) || 'Unassigned') : undefined;
  const selectedUserLastShootDate = selectedUser ? getLastShootDateForUser(selectedUser) : undefined;
  const selectedUserStats = selectedUser ? getShootStatsForUser(selectedUser) : undefined;
  const recentScheduledShoots = selectedUser && selectedUser.role === 'client'
    ? getRecentShootsForUser(selectedUser, 'scheduled')
    : [];
  const recentCompletedShoots = selectedUser && selectedUser.role === 'photographer'
    ? getRecentShootsForUser(selectedUser, 'completed')
    : [];

  const handleImportAccounts = async (file: File) => {
    try {
      const text = await file.text();
      let imported: any[] = [];

      if (file.name.endsWith(".json")) {
        imported = JSON.parse(text);
      } else {
        // CSV parsing
        const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean);
        const headers = headerLine.split(",").map((h) => h.trim());
        imported = rows.map((row) => {
          const cells = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
          const obj: Record<string, string> = {};
          headers.forEach((header, i) => {
            obj[header] = cells[i]?.replace(/^"|"$/g, "") || "";
          });
          return {
            id: obj.ID || crypto.randomUUID(),
            name: obj.Name || "",
            email: obj.Email || "",
            role: (obj.Role || "client") as Role,
            phone: obj.Phone || "",
            company: obj.Company || "",
            lastLogin: obj["Last Login"] || "",
            active: obj.Active ? obj.Active.toLowerCase() === "yes" : true,
            avatar: "/placeholder.svg",
          } as UserType;
        });
      }

      if (!imported.length) {
        toast({
          title: "Import failed",
          description: "No records found in the selected file.",
          variant: "destructive",
        });
        return;
      }

      setUsers((prev) => [...imported, ...prev]);
      toast({
        title: "Accounts imported",
        description: `${imported.length} account(s) added from file.`,
      });
    } catch (error: any) {
      console.error("Import failed:", error);
      toast({
        title: "Import failed",
        description: error?.message || "Unable to process the selected file.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          badge="Team"
          title="Accounts"
          description="Manage your team members and their permissions"
          icon={UsersIcon}
          action={
            <Button
              onClick={handleAddAccount}
              className="h-10 bg-gradient-to-r from-[#4FA8FF] via-[#3E8BFF] to-[#2F6DFF] text-white shadow-lg shadow-blue-500/30 transition-all duration-200 hover:from-[#63B4FF] hover:via-[#4C94FF] hover:to-[#3775FF]"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          }
        />

        <Tabs defaultValue="accounts" className="w-full">
          <TabsList className={`grid w-full max-w-2xl ${gridCols}`}>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            {showPermissionsTab && (
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
            )}
            {showLinkingTab && (
              <TabsTrigger value="linking">Linking</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="accounts" className="space-y-6 mt-6">
            <AccountsHeader
              onExport={handleExport}
              onImport={handleImportAccounts}
              onSearch={setSearchQuery}
              onFilterChange={setFilterRole}
              selectedFilter={filterRole}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              repFilter={repFilter}
              onRepFilterChange={setRepFilter}
              repOptions={repOptions}
            />

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading accounts...</span>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredUsers.map((user) => (
                  <AccountCard
                    key={user.id}
                    user={user}
                    onEdit={handleEditUser}
                    onChangeRole={handleChangeRole}
                    onResetPassword={handleResetPassword}
                    onImpersonate={handleImpersonate}
                    onManageNotifications={handleManageNotifications}
                    onLinkClientBranding={handleLinkClientBranding}
                    onViewProfile={handleViewProfile}
                    clientMenuActions={getClientMenuHandlers(user)}
                  />
                ))}

                {filteredUsers.length === 0 && (
                  <div className="col-span-full bg-muted/30 p-8 rounded-lg text-center">
                    <h3 className="text-lg font-medium mb-2">No accounts found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery
                        ? "Try adjusting your search or filter criteria."
                        : "Get started by adding a new account."}
                    </p>
                    <button
                      onClick={handleAddAccount}
                      className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md"
                    >
                      Add Account
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <AccountList
                users={accountListUsers}
                onEdit={handleEditUser}
                onChangeRole={handleChangeRole}
                onResetPassword={handleResetPassword}
                onImpersonate={handleImpersonate}
                onManageNotifications={handleManageNotifications}
                onLinkClientBranding={handleLinkClientBranding}
                onViewProfile={handleViewProfile}
                onDeleteUser={requestDeleteUser}
                getClientMenuActions={getClientMenuHandlers}
              />
            )}
          </TabsContent>

          {showPermissionsTab && (
            <TabsContent value="permissions" className="mt-6">
              <PermissionsManager />
            </TabsContent>
          )}

          {showLinkingTab && (
            <TabsContent value="linking" className="mt-6">
              <AccountLinkingManager />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ClientDetails
        open={clientDetailsOpen}
        onOpenChange={setClientDetailsOpen}
        client={selectedClient}
        onDelete={handleDeleteClient}
        onEdit={handleEditClient}
      />

      <ClientForm
        open={clientFormOpen}
        onOpenChange={setClientFormOpen}
        formData={clientFormData}
        setFormData={setClientFormData}
        isEditing={isEditing}
        showUploadOptions={showUploadOptions}
        setShowUploadOptions={setShowUploadOptions}
        onSubmit={handleClientFormSubmit}
      />

      {selectedUser && (
        <>
          <UserProfileDialog
            open={userProfileDialogOpen}
            onOpenChange={setUserProfileDialogOpen}
            user={selectedUser}
            onEdit={() => handleEditUser(selectedUser)}
            accountRep={selectedUserAccountRep}
            lastShootDate={selectedUserLastShootDate}
            shootStats={selectedUserStats}
            recentScheduledShoots={recentScheduledShoots}
            recentCompletedShoots={recentCompletedShoots}
          />

          <ResetPasswordDialog
            open={resetPasswordDialogOpen}
            onOpenChange={setResetPasswordDialogOpen}
            user={selectedUser}
            onSendResetLink={handleSendResetLink}
            onUpdatePassword={handleUpdatePassword}
          />

          <RoleChangeDialog
            open={roleChangeDialogOpen}
            onOpenChange={setRoleChangeDialogOpen}
            user={selectedUser}
            onSubmit={handleUpdateRoles}
          />

          <NotificationSettingsDialog
            open={notificationSettingsDialogOpen}
            onOpenChange={setNotificationSettingsDialogOpen}
            user={selectedUser}
            onSave={handleUpdateNotifications}
          />

          <LinkClientBrandingDialog
            open={linkClientBrandingDialogOpen}
            onOpenChange={setLinkClientBrandingDialogOpen}
            user={selectedUser}
            onSave={handleUpdateClientBranding}
          />
        </>
      )}

      <AccountForm
        open={isNewAccountOpen || editUserDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsNewAccountOpen(false);
            setEditUserDialogOpen(false);
          }
        }}
        onSubmit={editUserDialogOpen ? handleUpdateUser : handleNewAccount}
        initialData={editUserDialogOpen ? selectedUser : undefined}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all data for{' '}
              <span className="font-semibold">{userPendingDelete?.name}</span> including shoots,
              links, and history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeletingUser}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeletingUser ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

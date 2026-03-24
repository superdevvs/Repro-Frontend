
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionsManager } from '@/components/accounts/PermissionsManager';
import { usePermission } from '@/hooks/usePermission';
import { Navigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';

const PermissionSettingsPage = () => {
  const { can } = usePermission();
  const canManagePermissions = can('permissions-manager', 'view');

  // Redirect users without permission
  if (!canManagePermissions) {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access permissions settings.",
      variant: "destructive",
    });
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          badge="Accounts"
          title="Permissions"
          description="Manage role permissions, missing feature flags, and live dashboard access."
        />

        <PermissionsManager />
      </div>
    </DashboardLayout>
  );
};

export default PermissionSettingsPage;

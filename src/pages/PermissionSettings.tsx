
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  PermissionsManager,
  PermissionsModeTabs,
  type PermissionsManagerMode,
} from '@/components/accounts/PermissionsManager';
import { usePermission } from '@/hooks/usePermission';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';

const PermissionSettingsPage = () => {
  const { can } = usePermission();
  const canManagePermissions = can('permissions-manager', 'view');
  const [searchParams] = useSearchParams();
  const permissionsUserParam = searchParams.get('user');
  const [mode, setMode] = useState<PermissionsManagerMode>(permissionsUserParam ? 'users' : 'roles');

  useEffect(() => {
    if (permissionsUserParam) {
      setMode('users');
    }
  }, [permissionsUserParam]);

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
      <div className="space-y-6 px-0 py-6 sm:p-6">
        <PageHeader
          badge="Accounts"
          title="Permissions"
          description="Manage role defaults and per-user overrides for dashboard and API access."
          action={<PermissionsModeTabs value={mode} onChange={setMode} />}
        />

        <PermissionsManager initialUserId={permissionsUserParam} mode={mode} onModeChange={setMode} />
      </div>
    </DashboardLayout>
  );
};

export default PermissionSettingsPage;

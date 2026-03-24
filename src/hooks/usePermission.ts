
import { usePermissions } from '@/context/PermissionsContext';

/**
 * Hook to check if the current user has permission to perform an action on a resource
 */
export function usePermission() {
  const { can, userPermissions, permissionIds, isLoading } = usePermissions();

  /**
   * Check if the user can perform an action on a resource
   */
  const hasPermission = (resource: string, action: string, conditions?: Record<string, any>) => {
    return can(resource, action, conditions);
  };

  /**
   * Create a predefined permission checker for a specific resource
   */
  const forResource = (resource: string) => {
    return {
      can: (action: string, conditions?: Record<string, any>) => hasPermission(resource, action, conditions),
      canView: (conditions?: Record<string, any>) => hasPermission(resource, 'view', conditions),
      canCreate: (conditions?: Record<string, any>) => hasPermission(resource, 'create', conditions),
      canUpdate: (conditions?: Record<string, any>) => hasPermission(resource, 'update', conditions),
      canDelete: (conditions?: Record<string, any>) => hasPermission(resource, 'delete', conditions),
      canApprove: (conditions?: Record<string, any>) => hasPermission(resource, 'approve', conditions),
      canAssign: (conditions?: Record<string, any>) => hasPermission(resource, 'assign', conditions),
      canBook: (conditions?: Record<string, any>) => hasPermission(resource, 'book', conditions),
      canUpload: (conditions?: Record<string, any>) => hasPermission(resource, 'upload', conditions),
      canDownload: (conditions?: Record<string, any>) => hasPermission(resource, 'download', conditions),
      canMarkPaid: (conditions?: Record<string, any>) => hasPermission(resource, 'mark-paid', conditions),
    };
  };

  return {
    can: hasPermission,
    forResource,
    permissions: userPermissions,
    permissionIds,
    isLoading,
  };
}

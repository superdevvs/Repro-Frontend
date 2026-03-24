
import React, { createContext, useContext, useEffect, useState } from 'react';
import { PermissionRule } from '@/types/permissions';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchCurrentUserPermissions } from '@/services/permissionService';

interface PermissionsContextType {
  can: (resource: string, action: string, conditions?: Record<string, any>) => boolean;
  userPermissions: PermissionRule[];
  permissionIds: string[];
  isLoading: boolean;
}

const defaultContext: PermissionsContextType = {
  can: () => false,
  userPermissions: [],
  permissionIds: [],
  isLoading: true,
};

const PermissionsContext = createContext<PermissionsContextType>(defaultContext);

export const usePermissions = () => useContext(PermissionsContext);

interface PermissionsProviderProps {
  children: React.ReactNode;
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
  const { role, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [userPermissions, setUserPermissions] = useState<PermissionRule[]>([]);
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const controller = new AbortController();

    const loadPermissions = async () => {
      if (!isAuthenticated || !role) {
        setUserPermissions([]);
        setPermissionIds([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetchCurrentUserPermissions(controller.signal);
        setUserPermissions(response.permissions || []);
        setPermissionIds(response.permissionIds || []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Failed to load permissions:', error);
        setUserPermissions([]);
        setPermissionIds([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      controller.abort();
    };
  }, [role, isAuthenticated, authLoading]);

  const can = (resource: string, action: string, conditions?: Record<string, any>): boolean => {
    if (isLoading || authLoading || !isAuthenticated) return false;

    // Check if user has the required permission
    const hasPermission = userPermissions.some(permission => 
      permission.resource === resource && 
      permission.action === action
    );

    if (!hasPermission) return false;

    // If there are conditions, check those as well
    // This can be extended to handle more complex condition checks
    if (conditions) {
      // Example: check if user can only perform action on their own resources
      if (conditions.selfOnly && user?.id !== conditions.userId) {
        return false;
      }
      
      // Example: check if user can only perform action on assigned resources
      if (conditions.assignedOnly && !conditions.isAssigned) {
        return false;
      }
    }

    return true;
  };

  return (
    <PermissionsContext.Provider value={{ can, userPermissions, permissionIds, isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
};

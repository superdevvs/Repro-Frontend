import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { resources, actions, permissionsConfig } from '@/config/permissions';
import { PermissionRule, RolePermissions } from '@/types/permissions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/config/env';

export function PermissionsManager() {
  const { toast } = useToast();
  const [activeRole, setActiveRole] = useState('admin');
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermissions>>(permissionsConfig);
  
  // Create a permission key for easier management
  const getPermissionKey = (resource: string, action: string) => `${resource}-${action}`;
  
  // Check if a permission exists for the current role
  const hasPermission = (resource: string, action: string) => {
    const permissions = rolePermissions[activeRole]?.permissions || [];
    return permissions.some(p => p.resource === resource && p.action === action);
  };
  
  // Toggle a permission for the current role
  const togglePermission = (resource: string, action: string) => {
    const permKey = getPermissionKey(resource, action);
    const currentPerms = [...(rolePermissions[activeRole]?.permissions || [])];
    
    if (hasPermission(resource, action)) {
      // Remove permission
      const updatedPerms = currentPerms.filter(
        p => !(p.resource === resource && p.action === action)
      );
      
      setRolePermissions({
        ...rolePermissions,
        [activeRole]: {
          role: activeRole,
          permissions: updatedPerms,
        }
      });
    } else {
      // Add permission
      const newPerm: PermissionRule = {
        id: permKey,
        resource: resource,
        action: action,
      };
      
      setRolePermissions({
        ...rolePermissions,
        [activeRole]: {
          role: activeRole,
          permissions: [...currentPerms, newPerm],
        }
      });
    }
  };

  // Save changes
  const saveChanges = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      // In a real app, this would persist to the backend
      const res = await fetch(`${API_BASE_URL}/api/admin/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: rolePermissions }),
      });

      if (!res.ok) throw new Error('Failed to save permissions');

      toast({
        title: "Permissions Updated",
        description: `Permissions for all roles have been updated successfully.`,
        variant: "default",
      });
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save permissions. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Reset to default
  const resetToDefault = () => {
    setRolePermissions(permissionsConfig);
    toast({
      title: "Reset to Default",
      description: "Permissions have been reset to default values.",
      variant: "default",
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Account Permissions</CardTitle>
            <CardDescription>
              Manage permissions for all user types including pages and features
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={resetToDefault} className="w-full sm:w-auto">
              Reset to Default
            </Button>
            <Button onClick={saveChanges} className="w-full sm:w-auto">
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6">
        <Tabs 
          defaultValue="admin" 
          value={activeRole}
          onValueChange={setActiveRole}
          className="w-full"
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="inline-flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-5">
              <TabsTrigger value="superadmin" className="min-w-[116px] sm:min-w-0">Superadmin</TabsTrigger>
              <TabsTrigger value="admin" className="min-w-[96px] sm:min-w-0">Admin</TabsTrigger>
              <TabsTrigger value="client" className="min-w-[96px] sm:min-w-0">Client</TabsTrigger>
              <TabsTrigger value="photographer" className="min-w-[126px] sm:min-w-0">Photographer</TabsTrigger>
              <TabsTrigger value="editor" className="min-w-[96px] sm:min-w-0">Editor</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value={activeRole} className="mt-6">
            <div className="mb-4">
              <Badge variant="outline" className="text-sm">
                {rolePermissions[activeRole]?.permissions.length || 0} permissions enabled
              </Badge>
            </div>
            <ScrollArea className="h-[58vh] min-h-[360px] pr-1 sm:h-[500px] sm:pr-4">
              <div className="space-y-6">
                {resources.map(resource => (
                  <div key={resource.id} className="border rounded-lg p-4 bg-muted/30">
                    <div className="mb-3">
                      <h3 className="font-semibold text-base">{resource.name}</h3>
                      <p className="text-sm text-muted-foreground">{resource.description}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {actions.map(action => (
                        <div key={`${resource.id}-${action.id}`} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`${resource.id}-${action.id}`} 
                            checked={hasPermission(resource.id, action.id)}
                            onCheckedChange={() => togglePermission(resource.id, action.id)}
                          />
                          <Label 
                            htmlFor={`${resource.id}-${action.id}`} 
                            className="text-sm font-normal cursor-pointer"
                          >
                            {action.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}



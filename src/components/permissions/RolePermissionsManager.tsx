
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

export function RolePermissionsManager() {
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
  const saveChanges = () => {
    // In a real app, this would persist to the backend API
    toast({
      title: "Permissions Updated",
      description: `Permissions for role '${activeRole}' have been updated.`,
      variant: "default",
    });
    
    // For demo purposes, we'll just log the changes
    console.log('Updated permissions:', rolePermissions);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Role Permissions</CardTitle>
        <CardDescription>
          Manage permissions for each role in the system
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          defaultValue="admin" 
          value={activeRole}
          onValueChange={setActiveRole}
          className="w-full"
        >
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="superadmin">Superadmin</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="client">Client</TabsTrigger>
            <TabsTrigger value="photographer">Photographer</TabsTrigger>
            <TabsTrigger value="editor">Editor</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeRole} className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {resources.map(resource => (
                  <div key={resource.id} className="border rounded-md p-4">
                    <h3 className="font-medium mb-3">{resource.name}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {actions.map(action => (
                        <div key={`${resource.id}-${action.id}`} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`${resource.id}-${action.id}`} 
                            checked={hasPermission(resource.id, action.id)}
                            onCheckedChange={() => togglePermission(resource.id, action.id)}
                          />
                          <Label htmlFor={`${resource.id}-${action.id}`} className="text-sm">
                            {action.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="mt-4 flex justify-end">
              <Button variant="outline" className="mr-2">
                Reset
              </Button>
              <Button onClick={saveChanges}>
                Save Changes
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

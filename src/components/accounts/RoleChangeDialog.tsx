
import { useState } from "react";
import { User, Role } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface RoleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSubmit?: (userId: string, roles: Role[]) => void;
}

export function RoleChangeDialog({
  open,
  onOpenChange,
  user,
  onSubmit = () => {},
}: RoleChangeDialogProps) {
  const [primaryRole, setPrimaryRole] = useState<Role>(user?.role || 'client');
  
  // For multiple role assignment (optional feature)
  const [multipleRoles, setMultipleRoles] = useState(false);
  const [secondaryRoles, setSecondaryRoles] = useState<Role[]>([]);

  const handleRoleChange = (value: string) => {
    setPrimaryRole(value as Role);
  };

  const handleSecondaryRoleToggle = (role: Role) => {
    setSecondaryRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSubmit = () => {
    if (user) {
      if (multipleRoles) {
        const uniqueRoles = [primaryRole, ...secondaryRoles].filter(
          (value, index, self) => self.indexOf(value) === index
        ) as Role[];
        onSubmit(user.id, uniqueRoles);
      } else {
        onSubmit(user.id, [primaryRole]);
      }
    }
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Update role for {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Primary Role</Label>
            <Select defaultValue={user.role} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="photographer">Photographer</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="salesRep">Sales Rep</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="multi-roles" 
              checked={multipleRoles} 
              onCheckedChange={(checked) => setMultipleRoles(checked === true)}
            />
            <Label htmlFor="multi-roles">Assign multiple roles</Label>
          </div>
          
          {multipleRoles && (
            <div className="space-y-2 border rounded-md p-3">
              <Label className="block mb-2">Additional Roles</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-admin"
                    checked={secondaryRoles.includes('admin')}
                    onCheckedChange={() => handleSecondaryRoleToggle('admin')}
                    disabled={primaryRole === 'admin'}
                  />
                  <Label htmlFor="role-admin">Admin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-photographer"
                    checked={secondaryRoles.includes('photographer')}
                    onCheckedChange={() => handleSecondaryRoleToggle('photographer')}
                    disabled={primaryRole === 'photographer'}
                  />
                  <Label htmlFor="role-photographer">Photographer</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-client"
                    checked={secondaryRoles.includes('client')}
                    onCheckedChange={() => handleSecondaryRoleToggle('client')}
                    disabled={primaryRole === 'client'}
                  />
                  <Label htmlFor="role-client">Client</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-editor"
                    checked={secondaryRoles.includes('editor')}
                    onCheckedChange={() => handleSecondaryRoleToggle('editor')}
                    disabled={primaryRole === 'editor'}
                  />
                  <Label htmlFor="role-editor">Editor</Label>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="role-salesRep"
                  checked={secondaryRoles.includes('salesRep')}
                  onCheckedChange={() => handleSecondaryRoleToggle('salesRep')}
                  disabled={primaryRole === 'salesRep'}
                />
                <Label htmlFor="role-salesRep">Sales Rep</Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


import { useEffect, useState } from "react";
import { User, Role, useAuth } from "@/components/auth/AuthProvider";
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
  onSubmit?: (userId: string, roles: Role[]) => boolean | void | Promise<boolean | void>;
}

export function RoleChangeDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
}: RoleChangeDialogProps) {
  const { role: viewerRole } = useAuth();
  const isSuperAdmin = viewerRole === 'superadmin';
  const [primaryRole, setPrimaryRole] = useState<Role>(user?.role || 'client');
  
  // For multiple role assignment (optional feature)
  const [multipleRoles, setMultipleRoles] = useState(false);
  const [secondaryRoles, setSecondaryRoles] = useState<Role[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open || !user) {
      return;
    }

    const roleAwareUser = user as User & {
      secondaryRoles?: Role[];
      secondary_roles?: Role[];
    };
    const savedSecondaryRoles = roleAwareUser.secondaryRoles ?? roleAwareUser.secondary_roles ?? [];
    const nextSecondaryRoles = savedSecondaryRoles.filter((role) => role !== user.role);

    setPrimaryRole(user.role || 'client');
    setSecondaryRoles(nextSecondaryRoles);
    setMultipleRoles(nextSecondaryRoles.length > 0);
    setSubmitError("");
  }, [open, user]);

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

  const handleSubmit = async () => {
    if (!user || !onSubmit) {
      setSubmitError("Role changes are unavailable right now.");
      return;
    }

    const roles = multipleRoles
      ? [primaryRole, ...secondaryRoles].filter(
          (value, index, self) => self.indexOf(value) === index,
        ) as Role[]
      : [primaryRole];

    setSubmitError("");
    setIsSubmitting(true);
    try {
      const succeeded = await onSubmit(user.id, roles);
      if (succeeded === false) {
        setSubmitError("The user's roles could not be updated. Please try again.");
        return;
      }

      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The user's roles could not be updated.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSubmitting) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
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
            <Select value={primaryRole} onValueChange={handleRoleChange} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {isSuperAdmin && <SelectItem value="superadmin">Super Admin</SelectItem>}
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editing_manager">Editing Manager</SelectItem>
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
              disabled={isSubmitting}
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
                    disabled={isSubmitting || primaryRole === 'admin'}
                  />
                  <Label htmlFor="role-admin">Admin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-photographer"
                    checked={secondaryRoles.includes('photographer')}
                    onCheckedChange={() => handleSecondaryRoleToggle('photographer')}
                    disabled={isSubmitting || primaryRole === 'photographer'}
                  />
                  <Label htmlFor="role-photographer">Photographer</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-client"
                    checked={secondaryRoles.includes('client')}
                    onCheckedChange={() => handleSecondaryRoleToggle('client')}
                    disabled={isSubmitting || primaryRole === 'client'}
                  />
                  <Label htmlFor="role-client">Client</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="role-editor"
                    checked={secondaryRoles.includes('editor')}
                    onCheckedChange={() => handleSecondaryRoleToggle('editor')}
                    disabled={isSubmitting || primaryRole === 'editor'}
                  />
                  <Label htmlFor="role-editor">Editor</Label>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="role-salesRep"
                  checked={secondaryRoles.includes('salesRep')}
                  onCheckedChange={() => handleSecondaryRoleToggle('salesRep')}
                  disabled={isSubmitting || primaryRole === 'salesRep'}
                />
                <Label htmlFor="role-salesRep">Sales Rep</Label>
              </div>
            </div>
          )}

          {submitError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert">
              {submitError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

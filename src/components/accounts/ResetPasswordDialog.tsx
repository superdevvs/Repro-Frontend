
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/sonner-toast";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; email: string; name: string } | null;
  onSendResetLink?: (userId: string, email: string) => void;
  onUpdatePassword?: (userId: string, password: string) => void;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onSendResetLink = () => {},
  onUpdatePassword = () => {},
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleSendResetLink = () => {
    if (user) {
      onSendResetLink(user.id, user.email);
      setResetSent(true);
      toast.success("Password reset link sent successfully");
    }
  };

  const handleUpdatePassword = () => {
    setError("");
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    
    if (user) {
      onUpdatePassword(user.id, password);
      toast.success("Password has been updated successfully");
      onOpenChange(false);
      setPassword("");
      setConfirmPassword("");
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setPassword("");
        setConfirmPassword("");
        setError("");
        setResetSent(false);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Reset password for {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="reset-link">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="reset-link">Send Reset Link</TabsTrigger>
            <TabsTrigger value="manual-reset">Manual Reset</TabsTrigger>
          </TabsList>
          
          <TabsContent value="reset-link" className="space-y-4 pt-4">
            <p>
              Send a password reset link to the user's email address. The user will be able to create a new password by following the link.
            </p>
            
            <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            
            {resetSent && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-300">
                Reset link has been sent to the user's email address
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSendResetLink}
                disabled={resetSent}
              >
                {resetSent ? "Link Sent" : "Send Reset Link"}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="manual-reset" className="space-y-4 pt-4">
            <p>
              Manually set a new password for this user account.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleUpdatePassword}
                disabled={!password || !confirmPassword}
              >
                Update Password
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

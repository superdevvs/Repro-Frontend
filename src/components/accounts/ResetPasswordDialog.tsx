
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

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; email: string; name: string } | null;
  onSendResetLink?: (userId: string, email: string) => boolean | void | Promise<boolean | void>;
  onUpdatePassword?: (userId: string, password: string) => boolean | void | Promise<boolean | void>;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onSendResetLink,
  onUpdatePassword,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const resetDialogState = () => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    setLinkError("");
    setResetSent(false);
  };

  const closeDialog = () => {
    resetDialogState();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen && (isSendingLink || isUpdatingPassword)) {
      return;
    }

    if (!isOpen) {
      closeDialog();
      return;
    }

    onOpenChange(true);
  };

  const handleSendResetLink = async () => {
    if (!user || !onSendResetLink) {
      setLinkError("Password reset links are unavailable right now.");
      return;
    }

    setLinkError("");
    setIsSendingLink(true);
    try {
      const succeeded = await onSendResetLink(user.id, user.email);
      if (succeeded === false) {
        setLinkError("The reset link could not be sent. Please try again.");
        return;
      }

      setResetSent(true);
    } catch (actionError) {
      setLinkError(actionError instanceof Error ? actionError.message : "The reset link could not be sent.");
    } finally {
      setIsSendingLink(false);
    }
  };

  const handleUpdatePassword = async () => {
    setError("");
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    
    if (!user || !onUpdatePassword) {
      setError("Manual password reset is unavailable right now.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const succeeded = await onUpdatePassword(user.id, password);
      if (succeeded === false) {
        setError("The password could not be updated. Please try again.");
        return;
      }

      closeDialog();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The password could not be updated.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Reset password for {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="reset-link">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="reset-link" disabled={isSendingLink || isUpdatingPassword}>Send Reset Link</TabsTrigger>
            <TabsTrigger value="manual-reset" disabled={isSendingLink || isUpdatingPassword}>Manual Reset</TabsTrigger>
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

            {linkError && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300" role="alert">
                {linkError}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSendResetLink}
                disabled={resetSent || isSendingLink || isUpdatingPassword}
              >
                {isSendingLink ? "Sending..." : resetSent ? "Link Sent" : "Send Reset Link"}
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  disabled={isUpdatingPassword}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                  disabled={isUpdatingPassword}
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
                disabled={!password || !confirmPassword || isUpdatingPassword || isSendingLink}
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={isSendingLink || isUpdatingPassword}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
import { User } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/env";

/** The three canonical account states (mirrors the backend AccountStatusService). */
export type AccountStatus = "active" | "locked" | "deleted";

const STATUS_OPTIONS: Array<{ value: AccountStatus; label: string; description: string }> = [
  { value: "active", label: "Active", description: "User can sign in and access the dashboard." },
  { value: "locked", label: "Locked", description: "User is signed out immediately and blocked from signing in." },
  { value: "deleted", label: "Deleted", description: "Account is soft-deleted and access is revoked immediately." },
];

const STATUS_BADGE_CLASS: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-800",
  locked: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  deleted: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800",
};

/** Statuses that require an explicit confirmation step before they are applied. */
const REQUIRES_CONFIRMATION: AccountStatus[] = ["locked", "deleted"];

function readCurrentStatus(user: User | null): AccountStatus {
  if (!user) return "active";
  const raw = (user as any).account_status ?? (user as any).accountStatus;
  if (raw === "locked" || raw === "deleted" || raw === "active") {
    return raw;
  }
  // Fall back to derived signals when the explicit status is absent.
  if ((user as any).deleted_at) return "deleted";
  if ((user as any).locked_at) return "locked";
  if (user.isActive === false) return "locked";
  return "active";
}

function statusLabel(status: AccountStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

interface AccountStatusControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  /** Called with the persisted status returned by the backend so the parent can update its list. */
  onStatusChanged?: (userId: string, status: AccountStatus) => void;
  /** Optional hook so the parent can run its shared session-expiry flow. */
  onSessionExpired?: () => void;
}

/**
 * AccountStatusControls — lets an admin move a user between the active / locked / deleted
 * account states (Req 16.4). Locking or deleting requires an explicit confirmation step before
 * the change is sent. On success the new status is reflected in the dialog and surfaced to the
 * parent via `onStatusChanged`.
 */
export function AccountStatusControls({
  open,
  onOpenChange,
  user,
  onStatusChanged = () => {},
  onSessionExpired,
}: AccountStatusControlsProps) {
  const { toast } = useToast();
  const currentStatus = useMemo(() => readCurrentStatus(user), [user]);
  const [target, setTarget] = useState<AccountStatus>(currentStatus);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset local state whenever the dialog opens for a (possibly different) user.
  useEffect(() => {
    if (open) {
      setTarget(currentStatus);
      setConfirming(false);
      setSubmitting(false);
    }
  }, [open, currentStatus]);

  if (!user) return null;

  const isUnchanged = target === currentStatus;
  const needsConfirmation = REQUIRES_CONFIRMATION.includes(target);
  const targetOption = STATUS_OPTIONS.find((o) => o.value === target);

  const applyStatus = async () => {
    if (isUnchanged) {
      onOpenChange(false);
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!token) {
        onSessionExpired?.();
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: target }),
      });

      if (res.status === 401 || res.status === 419) {
        onSessionExpired?.();
        return;
      }

      const data = await res.json().catch(() => ({} as any));

      if (res.status === 403) {
        // Safety-guard rejection (e.g. self lock/delete, or non-super-admin deleting an admin).
        throw new Error(data?.message || "You are not allowed to make this change.");
      }

      if (res.status === 422) {
        const validationMessage =
          data?.errors?.status?.[0] || data?.message || "That account status is not valid.";
        throw new Error(validationMessage);
      }

      if (!res.ok) {
        throw new Error(data?.message || "Failed to update account status.");
      }

      const persisted: AccountStatus = (data?.status as AccountStatus) ?? target;
      onStatusChanged(user.id, persisted);
      toast({
        title: "Account status updated",
        description: `${user.name}'s account is now ${statusLabel(persisted).toLowerCase()}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't update account status",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (isUnchanged) {
      onOpenChange(false);
      return;
    }
    if (needsConfirmation && !confirming) {
      setConfirming(true);
      return;
    }
    void applyStatus();
  };

  const primaryLabel = (() => {
    if (isUnchanged) return "Close";
    if (needsConfirmation && !confirming) return `Continue`;
    return `Set to ${statusLabel(target)}`;
  })();

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Account Status</DialogTitle>
          <DialogDescription>
            Manage the account status for {user.name} ({user.email}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current status:</span>
            <Badge variant="outline" className={`${STATUS_BADGE_CLASS[currentStatus]} border`}>
              {statusLabel(currentStatus)}
            </Badge>
          </div>

          {!confirming ? (
            <div className="space-y-2">
              <Label htmlFor="account-status-select">New status</Label>
              <Select
                value={target}
                onValueChange={(value) => setTarget(value as AccountStatus)}
                disabled={submitting}
              >
                <SelectTrigger id="account-status-select">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetOption && (
                <p className="text-sm text-muted-foreground">{targetOption.description}</p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="font-medium">
                  Set {user.name}'s account to {statusLabel(target).toLowerCase()}?
                </p>
                <p className="text-muted-foreground">
                  {target === "deleted"
                    ? "The account will be soft-deleted and the user will be signed out immediately. This revokes their active sessions and tokens."
                    : "The user will be signed out immediately and blocked from signing in until the account is set back to active."}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {confirming ? (
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handlePrimaryAction}
            disabled={submitting}
            variant={confirming && target === "deleted" ? "destructive" : "default"}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

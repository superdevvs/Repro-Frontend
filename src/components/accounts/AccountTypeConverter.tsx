import { useEffect, useMemo, useState } from "react";
import { User, Role, useAuth } from "@/components/auth/AuthProvider";
import { API_BASE_URL } from "@/config/env";
import { getStoredAuthToken } from "@/utils/authToken";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, AlertTriangle } from "lucide-react";

/**
 * Account type (role) options that an admin may convert a user to. These mirror the
 * roles defined in the backend (`config('permissions.roles')`) and the `UserRole` union,
 * and the values match what `PATCH /api/admin/users/{user}/convert-type` validates against.
 */
const ACCOUNT_TYPES: { value: Role; label: string }[] = [
  { value: "superadmin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "editing_manager", label: "Editing Manager" },
  { value: "salesRep", label: "Sales Rep" },
  { value: "photographer", label: "Photographer" },
  { value: "editor", label: "Editor" },
  { value: "client", label: "Client" },
];

export function roleLabel(role?: Role | string | null): string {
  if (!role) return "Unknown";
  return ACCOUNT_TYPES.find((t) => t.value === role)?.label ?? String(role);
}

interface ConvertTypeResponse {
  id: number | string;
  role: Role;
  previous_type: Role;
  new_type: Role;
}

interface AccountTypeConverterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  /** Called after a successful conversion so the parent can reflect the new type. */
  onConverted?: (userId: string, newType: Role) => void;
  /** Called when the request is rejected for an expired/invalid session (401/419). */
  onSessionExpired?: () => void;
}

/**
 * AccountTypeConverter lets an admin select and confirm a new account type (role) for a user
 * (Req 18.1). Selection and confirmation are split into two steps so the change is never
 * applied by accident, and the resolved new type is surfaced on success.
 */
export function AccountTypeConverter({
  open,
  onOpenChange,
  user,
  onConverted = () => {},
  onSessionExpired,
}: AccountTypeConverterProps) {
  const { role: viewerRole } = useAuth();
  const isSuperAdmin = viewerRole === "superadmin";

  const [targetType, setTargetType] = useState<Role | "">("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state whenever the dialog opens for a (different) user.
  useEffect(() => {
    if (open) {
      setTargetType("");
      setConfirming(false);
      setSubmitting(false);
      setError(null);
    }
  }, [open, user?.id]);

  // Only a Super Admin may convert someone to Super Admin (mirrors RoleChangeDialog gating).
  const options = useMemo(
    () => ACCOUNT_TYPES.filter((t) => t.value !== "superadmin" || isSuperAdmin),
    [isSuperAdmin],
  );

  if (!user) return null;

  const currentType = user.role;
  const isNoChange = targetType !== "" && targetType === currentType;

  const handleContinue = () => {
    setError(null);
    setConfirming(true);
  };

  const handleConvert = async () => {
    if (!targetType || targetType === currentType) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      if (!token) {
        onSessionExpired?.();
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/api/admin/users/${user.id}/convert-type`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ account_type: targetType }),
        },
      );

      if (res.status === 401 || res.status === 419) {
        onSessionExpired?.();
        return;
      }

      if (res.status === 422) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.errors?.account_type?.[0] ||
          payload?.message ||
          "That account type is not a valid role.";
        setError(message);
        setConfirming(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to convert account type.");
      }

      const data = (await res.json()) as ConvertTypeResponse;
      const newType = (data.new_type ?? data.role ?? targetType) as Role;

      onConverted(String(user.id), newType);
      onOpenChange(false);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to convert account type.";
      setError(message);
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Convert Account Type</DialogTitle>
          <DialogDescription>
            Change the account type for {user.name} ({user.email}).
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current account type</Label>
              <div>
                <Badge variant="outline">{roleLabel(currentType)}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-type-select">New account type</Label>
              <Select
                value={targetType || undefined}
                onValueChange={(value) => setTargetType(value as Role)}
              >
                <SelectTrigger id="account-type-select">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isNoChange && (
              <p className="text-sm text-muted-foreground">
                This user already has that account type.
              </p>
            )}

            {error && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Please confirm this account type change. The user's permissions will be
              updated immediately.
            </p>
            <div className="flex items-center justify-center gap-3 rounded-md border p-4">
              <Badge variant="outline">{roleLabel(currentType)}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{roleLabel(targetType as Role)}</Badge>
            </div>
            {error && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {!confirming ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!targetType || isNoChange}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Back
              </Button>
              <Button onClick={handleConvert} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Convert
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

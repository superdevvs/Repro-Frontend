import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';

interface DeletedAccount {
  id: number;
  name: string | null;
  original_email: string | null;
  original_username: string | null;
  role: string | null;
  deleted_at: string | null;
  restore_until: string | null;
  days_remaining: number | null;
  restorable: boolean;
}

function getToken(): string | null {
  return localStorage.getItem('authToken') || localStorage.getItem('token');
}

/**
 * Settings → Deleted Accounts.
 *
 * Lists soft-deleted accounts still within (or recently past) their 14-day restore window and
 * lets an admin restore them. If the original email has been reused by a new account, the API
 * returns a 422 conflict; the panel then prompts the admin to restore with a different email.
 */
export function DeletedAccountsPanel() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<DeletedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  // Conflict dialog state.
  const [conflictAccount, setConflictAccount] = useState<DeletedAccount | null>(null);
  const [overrideEmail, setOverrideEmail] = useState('');
  const [conflictMessage, setConflictMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/admin/users/deleted-accounts`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load deleted accounts');
      const data = await res.json();
      setAccounts(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      toast({
        title: 'Could not load deleted accounts',
        description: e instanceof Error ? e.message : 'Unexpected error.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = useCallback(
    async (account: DeletedAccount, email?: string) => {
      setRestoringId(account.id);
      try {
        const token = getToken();
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/admin/users/${account.id}/restore`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(email ? { email } : {}),
        });
        const payload = await res.json().catch(() => ({}));

        if (res.status === 422) {
          // Email conflict — original address was reused by a new account.
          const msg =
            payload?.errors?.email?.[0] ||
            payload?.message ||
            'This email is already used by a new account. Restore with a different email or cancel.';
          setConflictAccount(account);
          setConflictMessage(msg);
          setOverrideEmail('');
          return;
        }

        if (res.status === 403) {
          toast({
            title: 'Restore not allowed',
            description: payload?.message || 'The 14-day restore window has expired.',
            variant: 'destructive',
          });
          return;
        }

        if (!res.ok) {
          throw new Error(payload?.message || 'Failed to restore account');
        }

        toast({
          title: 'Account restored',
          description: `${account.name || 'Account'} is active again. A password reset link was sent.`,
        });
        setConflictAccount(null);
        await load();
      } catch (e) {
        toast({
          title: 'Restore failed',
          description: e instanceof Error ? e.message : 'Unexpected error.',
          variant: 'destructive',
        });
      } finally {
        setRestoringId(null);
      }
    },
    [load, toast]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading deleted accounts…
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 text-center">
        <Trash2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No deleted accounts in the restore window.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleted accounts can be restored for 14 days before they are permanently anonymized.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200/60 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold">Deleted Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Restore within 14 days. After that, accounts are permanently anonymized and business
            history (shoots, invoices, payments) is preserved.
          </p>
        </div>

        <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
          {accounts.map((a) => {
            const expired = !a.restorable;
            return (
              <div
                key={a.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{a.name || 'Unnamed account'}</span>
                    {a.role && (
                      <Badge variant="secondary" className="capitalize">
                        {a.role}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {a.original_email || '(email cleared)'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.deleted_at && (
                      <>Deleted {new Date(a.deleted_at).toLocaleDateString()} · </>
                    )}
                    {expired ? (
                      <span className="text-destructive">Restore window expired</span>
                    ) : a.days_remaining != null ? (
                      <span>{a.days_remaining} day{a.days_remaining === 1 ? '' : 's'} left to restore</span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={expired || restoringId === a.id}
                    onClick={() => restore(a)}
                  >
                    {restoringId === a.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Restore
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog
        open={conflictAccount !== null}
        onOpenChange={(open) => {
          if (!open) setConflictAccount(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email already in use</AlertDialogTitle>
            <AlertDialogDescription>{conflictMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="override-email">
              Restore with a different email
            </label>
            <Input
              id="override-email"
              type="email"
              placeholder="new.email@example.com"
              value={overrideEmail}
              onChange={(e) => setOverrideEmail(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!overrideEmail.trim() || restoringId === conflictAccount?.id}
              onClick={(e) => {
                e.preventDefault();
                if (conflictAccount) restore(conflictAccount, overrideEmail.trim());
              }}
            >
              {restoringId === conflictAccount?.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Restore with this email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

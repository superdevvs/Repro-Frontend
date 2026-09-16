import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { AlertCircle, Check, Eraser, Lock, Minus, RotateCcw, Save, Search, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { cn } from '@/lib/utils';
import {
  fetchAdminPermissionsConfig,
  fetchPermissionUsers,
  fetchUserPermissionOverrides,
  updateUserPermissionOverrides,
} from '@/services/permissionService';
import type {
  PermissionCatalogGroup,
  PermissionCatalogItem,
  PermissionOverrideState,
  PermissionOverrides,
  PermissionRoleMeta,
  PermissionUserSummary,
  UserPermissionOverridesResponse,
} from '@/types/permissions';
import { FALLBACK_ROLE_ICON, ROLE_ICONS } from '@/components/accounts/permissionRoleIcons';

type DraftOverrides = Record<string, Exclude<PermissionOverrideState, 'inherit'>>;

const STAFF_ROLES = new Set(['superadmin', 'admin', 'editing_manager', 'salesRep', 'photographer', 'editor']);

type UserFilter = 'staff' | 'all' | 'overrides';

interface UserPermissionOverridesManagerProps {
  initialUserId?: string | number | null;
}

const toDraft = (overrides: PermissionOverrides): DraftOverrides => {
  const draft: DraftOverrides = {};
  overrides.deny.forEach((id) => {
    draft[id] = 'deny';
  });
  overrides.allow.forEach((id) => {
    if (!draft[id]) draft[id] = 'allow';
  });
  return draft;
};

const fromDraft = (draft: DraftOverrides): PermissionOverrides => ({
  allow: Object.keys(draft).filter((id) => draft[id] === 'allow').sort(),
  deny: Object.keys(draft).filter((id) => draft[id] === 'deny').sort(),
});

const sameOverrides = (left: PermissionOverrides, right: PermissionOverrides) =>
  left.allow.length === right.allow.length &&
  left.deny.length === right.deny.length &&
  left.allow.every((id, index) => id === right.allow[index]) &&
  left.deny.every((id, index) => id === right.deny[index]);

const permissionMatchesSearch = (permission: PermissionCatalogItem, search: string) => {
  if (!search) return true;
  const haystack = [permission.label, permission.description, permission.resource, permission.action]
    .join(' ')
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
};

const userMatchesSearch = (user: PermissionUserSummary, search: string) => {
  if (!search) return true;
  const haystack = [user.name, user.email, user.role, ...(user.secondaryRoles ?? [])].join(' ').toLowerCase();
  return haystack.includes(search.toLowerCase());
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

interface TriStateControlProps {
  value: PermissionOverrideState;
  baselineEnabled: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: PermissionOverrideState) => void;
}

function TriStateControl({ value, baselineEnabled, disabled, label, onChange }: TriStateControlProps) {
  const options: { id: PermissionOverrideState; label: string; icon: ElementType; activeClass: string }[] = [
    { id: 'deny', label: 'Deny', icon: X, activeClass: 'bg-rose-600 text-white shadow-sm dark:bg-rose-500' },
    { id: 'inherit', label: 'Inherit', icon: Minus, activeClass: 'bg-slate-700 text-white shadow-sm dark:bg-slate-200 dark:text-slate-900' },
    { id: 'allow', label: 'Allow', icon: Check, activeClass: 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={`${label} override`}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted/40 p-0.5',
        disabled && 'opacity-60',
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.id;
        const title =
          option.id === 'inherit'
            ? `Inherit from role (${baselineEnabled ? 'enabled' : 'disabled'})`
            : option.label;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${option.label} ${label}`}
            title={title}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? option.activeClass : 'text-muted-foreground hover:bg-background hover:text-foreground',
              disabled && 'cursor-not-allowed',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function UserPermissionOverridesManager({ initialUserId = null }: UserPermissionOverridesManagerProps) {
  const { toast } = useToast();
  const { can } = usePermission();
  const { user: viewer } = useAuth();
  const canEdit = can('permissions-manager', 'update');

  const [catalog, setCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [roles, setRoles] = useState<PermissionRoleMeta[]>([]);
  const [users, setUsers] = useState<PermissionUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('staff');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId ? String(initialUserId) : null);

  const [detail, setDetail] = useState<UserPermissionOverridesResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draft, setDraft] = useState<DraftOverrides>({});
  const [permissionSearch, setPermissionSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialUserId) {
      setSelectedUserId(String(initialUserId));
    }
  }, [initialUserId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [config, usersResponse] = await Promise.all([
          fetchAdminPermissionsConfig(controller.signal),
          fetchPermissionUsers(controller.signal),
        ]);
        if (cancelled) return;
        setCatalog(config.catalog);
        setRoles(config.roles);
        setUsers(usersResponse.users);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.error('Failed to load user permission overrides:', error);
        setLoadError(error instanceof Error ? error.message : 'Unable to load accounts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      setDraft({});
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const response = await fetchUserPermissionOverrides(selectedUserId, controller.signal);
        if (cancelled) return;
        setDetail(response);
        setDraft(toDraft(response.overrides));
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.error('Failed to load user permissions:', error);
        toast({
          title: 'Failed to load user permissions',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
        setDetail(null);
        setDraft({});
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedUserId, toast]);

  const roleLabel = useCallback(
    (roleId: string) => roles.find((role) => role.id === roleId)?.label ?? roleId,
    [roles],
  );

  const visibleUsers = useMemo(() => {
    return users.filter((user) => {
      if (userFilter === 'staff' && !STAFF_ROLES.has(user.role) && user.overrideCount === 0) return false;
      if (userFilter === 'overrides' && user.overrideCount === 0) return false;
      return userMatchesSearch(user, userSearch);
    });
  }, [userFilter, userSearch, users]);

  const visibleGroups = useMemo(
    () =>
      catalog
        .map((group) => ({
          ...group,
          permissions: group.permissions.filter((permission) => permissionMatchesSearch(permission, permissionSearch)),
        }))
        .filter((group) => group.permissions.length > 0),
    [catalog, permissionSearch],
  );

  const baseline = useMemo(() => new Set(detail?.roleBaseline ?? []), [detail]);
  const savedOverrides = detail?.overrides ?? { allow: [], deny: [] };
  const draftOverrides = useMemo(() => fromDraft(draft), [draft]);
  const dirty = detail ? !sameOverrides(draftOverrides, savedOverrides) : false;
  const locked = Boolean(detail?.user.locked);
  const editable = canEdit && !locked && !detailLoading && Boolean(detail);
  const editingSelf = Boolean(detail && viewer?.id !== undefined && String(viewer.id) === String(detail.user.id));

  const stateFor = (permissionId: string): PermissionOverrideState => draft[permissionId] ?? 'inherit';
  const effectiveFor = (permissionId: string) => {
    const state = stateFor(permissionId);
    if (state === 'allow') return true;
    if (state === 'deny') return false;
    return baseline.has(permissionId);
  };

  const effectiveCount = detail
    ? catalog.reduce(
        (count, group) => count + group.permissions.filter((permission) => effectiveFor(permission.id)).length,
        0,
      )
    : 0;

  const overrideCount = draftOverrides.allow.length + draftOverrides.deny.length;

  const setState = (permissionId: string, next: PermissionOverrideState) => {
    setDraft((current) => {
      const copy = { ...current };
      if (next === 'inherit') {
        delete copy[permissionId];
      } else {
        copy[permissionId] = next;
      }
      return copy;
    });
  };

  const handleRevert = () => {
    if (!detail) return;
    setDraft(toDraft(detail.overrides));
  };

  const handleClear = () => setDraft({});

  const handleSave = async () => {
    if (!detail || !editable) return;

    setSaving(true);
    try {
      const response = await updateUserPermissionOverrides(detail.user.id, draftOverrides);
      setDetail(response);
      setDraft(toDraft(response.overrides));
      const nextCount = response.overrides.allow.length + response.overrides.deny.length;
      setUsers((current) =>
        current.map((user) =>
          String(user.id) === String(response.user.id) ? { ...user, overrideCount: nextCount } : user,
        ),
      );
      toast({
        title: 'User permissions saved',
        description:
          nextCount === 0
            ? `${response.user.name} now inherits every permission from their role.`
            : `${response.user.name} has ${nextCount} override${nextCount === 1 ? '' : 's'} applied.`,
      });
    } catch (error) {
      console.error('Failed to save user permissions:', error);
      toast({
        title: 'Failed to save user permissions',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex min-h-[420px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4" />
            Loading accounts...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="w-full border-destructive/30">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <div>
            <p className="font-medium">User permissions are unavailable.</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedSummary = users.find((user) => String(user.id) === selectedUserId);

  const renderUserList = () => (
    <div className="flex flex-col gap-1 pb-1">
      {visibleUsers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No accounts match that search.
        </div>
      )}
      {visibleUsers.map((user) => {
        const Icon = ROLE_ICONS[user.role] ?? FALLBACK_ROLE_ICON;
        const active = String(user.id) === selectedUserId;

        return (
          <button
            key={user.id}
            type="button"
            onClick={() => setSelectedUserId(String(user.id))}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
              active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/40',
            )}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={getAvatarUrl(user.avatar ?? undefined, user.role, undefined, String(user.id))} alt={user.name} />
              <AvatarFallback className="text-xs font-medium">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Icon className="h-3 w-3" />
                {roleLabel(user.role)}
              </span>
              {user.locked ? (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  Locked
                </Badge>
              ) : user.overrideCount > 0 ? (
                <Badge className="rounded-full text-[10px]">
                  {user.overrideCount} override{user.overrideCount === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderPermissionGroups = () => (
    <div className="flex min-h-full flex-col gap-4">
      {visibleGroups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">No permissions match that search.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a broader term like dashboard, messaging, accounting, or media.
          </p>
        </div>
      )}

      {visibleGroups.map((group) => (
        <section
          key={group.id}
          className="flex flex-col overflow-visible rounded-none border-y border-border/60 bg-background shadow-none last:flex-1 sm:rounded-2xl sm:border"
        >
          <div className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-5">
            <h3 className="text-base font-semibold">{group.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          </div>

          <div className="flex-1 space-y-3 px-4 py-4 sm:px-5 sm:py-5">
            {group.permissions.map((permission) => {
              const state = stateFor(permission.id);
              const baselineEnabled = baseline.has(permission.id);
              const effective = effectiveFor(permission.id);
              const overridden = state !== 'inherit';

              return (
                <div
                  key={permission.id}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors sm:gap-4',
                    overridden
                      ? state === 'deny'
                        ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20'
                        : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                      : 'border-border/60 hover:bg-muted/30',
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{permission.label}</p>
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        {permission.resource}.{permission.action}
                      </Badge>
                      <Badge
                        variant={effective ? 'secondary' : 'outline'}
                        className={cn('rounded-full text-[11px]', !effective && 'text-muted-foreground')}
                      >
                        {effective ? 'On' : 'Off'}
                        {overridden ? ' (override)' : ` via ${detail ? roleLabel(detail.user.role) : 'role'}`}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{permission.description}</p>
                  </div>
                  <TriStateControl
                    value={state}
                    baselineEnabled={baselineEnabled}
                    disabled={!editable}
                    label={permission.label}
                    onChange={(next) => setState(permission.id, next)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  const renderEditor = () => {
    if (!selectedUserId) {
      return (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">Pick an account to review its permissions.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Each permission can inherit from the role, be explicitly allowed, or be explicitly denied for that
            one account. Deny always wins.
          </p>
        </div>
      );
    }

    if (detailLoading && !detail) {
      return (
        <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4" />
          Loading permissions...
        </div>
      );
    }

    if (!detail) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-muted-foreground">This account could not be loaded.</p>
        </div>
      );
    }

    const DetailIcon = ROLE_ICONS[detail.user.role] ?? FALLBACK_ROLE_ICON;

    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage
                src={getAvatarUrl(detail.user.avatar ?? undefined, detail.user.role, undefined, String(detail.user.id))}
                alt={detail.user.name}
              />
              <AvatarFallback className="font-medium">{initials(detail.user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{detail.user.name}</p>
                <Badge variant="outline" className="rounded-full gap-1">
                  <DetailIcon className="h-3 w-3" />
                  {roleLabel(detail.user.role)}
                </Badge>
                {detail.user.secondaryRoles.map((roleId) => (
                  <Badge key={roleId} variant="outline" className="rounded-full">
                    + {roleLabel(roleId)}
                  </Badge>
                ))}
                {locked && (
                  <Badge variant="secondary" className="rounded-full gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{detail.user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[300px]">
            <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Role</p>
              <p className="text-lg font-semibold">{detail.roleBaseline.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Effective</p>
              <p className="text-lg font-semibold">{effectiveCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Overrides</p>
              <p className="text-lg font-semibold">{overrideCount}</p>
            </div>
          </div>
        </div>

        {locked && (
          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            Super Admin accounts always keep every permission, so overrides cannot be applied here.
          </div>
        )}

        {!locked && editingSelf && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            You are editing your own account. Denying Permissions Manager here will lock you out of this page.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={permissionSearch}
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Search permissions, resources, or actions..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRevert} disabled={!editable || !dirty || saving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} disabled={!editable || overrideCount === 0 || saving}>
              <Eraser className="mr-2 h-4 w-4" />
              Clear overrides
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!editable || !dirty || saving}>
              {saving ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[60vh] min-h-[420px] rounded-2xl border border-border/60 bg-background p-4">
          {renderPermissionGroups()}
        </ScrollArea>
      </div>
    );
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="space-y-3 border-b border-border/60 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1.5">
            <CardTitle>User Permission Overrides</CardTitle>
            <CardDescription>
              Tune a single account without touching its role. Overrides apply on top of the role defaults.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {users.filter((user) => user.overrideCount > 0).length} accounts with overrides
            </Badge>
            <Badge variant={dirty ? 'default' : 'outline'} className="rounded-full px-3 py-1">
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search accounts..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'staff', label: 'Staff' },
                  { id: 'overrides', label: 'With overrides' },
                  { id: 'all', label: 'Everyone' },
                ] as { id: UserFilter; label: string }[]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setUserFilter(option.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    userFilter === option.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/70 bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <ScrollArea className="h-[280px] rounded-2xl border border-border/60 bg-background p-2 lg:h-[68vh] lg:min-h-[520px]">
              {renderUserList()}
            </ScrollArea>
            {selectedSummary && (
              <>
                <Separator className="hidden lg:block" />
                <p className="hidden text-xs text-muted-foreground lg:block">
                  Changes here only affect {selectedSummary.name}. Use the Roles view to change defaults for
                  everyone with the {roleLabel(selectedSummary.role)} role.
                </p>
              </>
            )}
          </div>

          <div className="min-w-0">{renderEditor()}</div>
        </div>
      </CardContent>
    </Card>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Camera,
  Crown,
  Loader2,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Shield,
  User,
  UserCog,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/usePermission';
import {
  fetchAdminPermissionsConfig,
  updateAdminPermissionsConfig,
} from '@/services/permissionService';
import type {
  AdminPermissionsResponse,
  PermissionCatalogItem,
  PermissionRoleMeta,
  RolePermissionIdsMap,
} from '@/types/permissions';

const ROLE_ICONS: Record<string, React.ElementType> = {
  superadmin: Crown,
  admin: Shield,
  editing_manager: UserCog,
  salesRep: Briefcase,
  photographer: Camera,
  editor: Scissors,
  client: User,
};

const toSortedUnique = (values: string[]) => Array.from(new Set(values)).sort();

const samePermissionList = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const countDirtyRoles = (
  draftPermissions: RolePermissionIdsMap,
  savedPermissions: RolePermissionIdsMap,
  roles: PermissionRoleMeta[],
) =>
  roles.reduce((count, role) => {
    const draft = draftPermissions[role.id] ?? [];
    const saved = savedPermissions[role.id] ?? [];
    return count + (samePermissionList(draft, saved) ? 0 : 1);
  }, 0);

const permissionMatchesSearch = (permission: PermissionCatalogItem, search: string) => {
  if (!search) return true;

  const haystack = [
    permission.label,
    permission.description,
    permission.resource,
    permission.action,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
};

export function PermissionsManager() {
  const { toast } = useToast();
  const { can } = usePermission();
  const canSavePermissions = can('permissions-manager', 'update');
  const [config, setConfig] = useState<AdminPermissionsResponse | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<RolePermissionIdsMap>({});
  const [activeRole, setActiveRole] = useState('admin');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadPermissions = async () => {
      setLoading(true);

      try {
        const nextConfig = await fetchAdminPermissionsConfig(controller.signal);
        if (cancelled) return;

        setConfig(nextConfig);
        setDraftPermissions(nextConfig.permissions);
        setActiveRole((current) => {
          if (current && nextConfig.roles.some((role) => role.id === current)) {
            return current;
          }
          return nextConfig.roles[0]?.id ?? 'admin';
        });
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load permissions config:', error);
        toast({
          title: 'Failed to load permissions',
          description: error instanceof Error ? error.message : 'Unable to load permissions manager data.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [toast]);

  const roles = config?.roles ?? [];
  const savedPermissions = config?.permissions ?? {};
  const defaultPermissions = config?.defaults ?? {};
  const catalog = config?.catalog ?? [];
  const activeRoleMeta = roles.find((role) => role.id === activeRole);
  const activeRolePermissions = draftPermissions[activeRole] ?? [];
  const activeDefaultPermissions = defaultPermissions[activeRole] ?? [];
  const dirtyRoles = countDirtyRoles(draftPermissions, savedPermissions, roles);
  const activeRoleDirty = !samePermissionList(activeRolePermissions, savedPermissions[activeRole] ?? []);

  const visibleGroups = useMemo(() => {
    return catalog
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) =>
          permissionMatchesSearch(permission, searchValue),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [catalog, searchValue]);

  const roleTabs = useMemo<AutoExpandingTab[]>(
    () =>
      roles.map((role) => ({
        value: role.id,
        label: role.label,
        icon: ROLE_ICONS[role.id] ?? Shield,
        badge: draftPermissions[role.id]?.length ?? 0,
      })),
    [draftPermissions, roles],
  );

  const togglePermission = (roleId: string, permissionId: string) => {
    setDraftPermissions((current) => {
      const nextValues = new Set(current[roleId] ?? []);
      if (nextValues.has(permissionId)) {
        nextValues.delete(permissionId);
      } else {
        nextValues.add(permissionId);
      }

      return {
        ...current,
        [roleId]: toSortedUnique(Array.from(nextValues)),
      };
    });
  };

  const handleResetRole = () => {
    if (!activeRoleMeta || activeRoleMeta.locked) return;

    setDraftPermissions((current) => ({
      ...current,
      [activeRole]: toSortedUnique(defaultPermissions[activeRole] ?? []),
    }));
  };

  const handleResetAll = () => {
    setDraftPermissions(
      roles.reduce<RolePermissionIdsMap>((next, role) => {
        next[role.id] = role.locked
          ? toSortedUnique(savedPermissions[role.id] ?? [])
          : toSortedUnique(defaultPermissions[role.id] ?? []);
        return next;
      }, {}),
    );
  };

  const handleSave = async () => {
    if (!config || !canSavePermissions) return;

    setSaving(true);

    try {
      const saved = await updateAdminPermissionsConfig(draftPermissions);
      const nextConfig: AdminPermissionsResponse = {
        ...config,
        permissions: saved,
      };

      setConfig(nextConfig);
      setDraftPermissions(saved);
      toast({
        title: 'Permissions saved',
        description: 'Role permissions are now synced with the dashboard.',
      });
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast({
        title: 'Failed to save permissions',
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
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading permissions manager...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card className="w-full border-destructive/30">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <div>
            <p className="font-medium">Permissions manager is unavailable.</p>
            <p className="text-sm text-muted-foreground">
              Reload the page and try again. If the issue continues, check the backend permissions API.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <CardHeader className="space-y-5 border-b border-border/60 bg-slate-50/60 dark:bg-slate-900/50">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Account Permissions</CardTitle>
            <CardDescription>
              Backend-backed role permissions with grouped feature coverage across the current dashboard.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {roles.length} roles
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {catalog.reduce((count, group) => count + group.permissions.length, 0)} permissions
            </Badge>
            <Badge
              variant={dirtyRoles > 0 ? 'default' : 'outline'}
              className="rounded-full px-3 py-1"
            >
              {dirtyRoles > 0 ? `${dirtyRoles} unsaved role changes` : 'All changes saved'}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-border/60 bg-background/70 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active role</p>
              <p className="mt-2 text-lg font-semibold">{activeRoleMeta?.label ?? 'Role'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{activeRoleMeta?.description}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-background/70 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Enabled now</p>
              <p className="mt-2 text-lg font-semibold">{activeRolePermissions.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeRoleDirty ? 'This role has unsaved edits.' : 'Matches the saved configuration.'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-background/70 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Default baseline</p>
              <p className="mt-2 text-lg font-semibold">{activeDefaultPermissions.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quick reset target for the selected role.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search permissions, resources, or actions..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleResetRole}
              disabled={!activeRole || activeRoleMeta?.locked || saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Role
            </Button>
            <Button variant="outline" onClick={handleResetAll} disabled={saving}>
              Reset All
            </Button>
            <Button onClick={handleSave} disabled={!canSavePermissions || saving || dirtyRoles === 0}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="rounded-2xl border border-border/60 bg-slate-50/70 p-3 dark:bg-slate-900/40">
          <Tabs value={activeRole} onValueChange={setActiveRole}>
            <AutoExpandingTabsList tabs={roleTabs} value={activeRole} desktopExpanded className="pb-0" />
            <TabsContent value={activeRole} className="mt-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                <ScrollArea className="h-[62vh] min-h-[420px] rounded-2xl border border-border/60 bg-background p-4">
                  <div className="space-y-4">
                    {visibleGroups.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                        <p className="font-medium">No permissions match that search.</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Try a broader term like dashboard, messaging, accounting, or media.
                        </p>
                      </div>
                    )}

                    {visibleGroups.map((group) => (
                      <Card key={group.id} className="border-border/60 shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{group.label}</CardTitle>
                          <CardDescription>{group.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {group.permissions.map((permissionItem) => {
                            const checked = activeRolePermissions.includes(permissionItem.id);
                            const isDefault = activeDefaultPermissions.includes(permissionItem.id);
                            const disabled = Boolean(activeRoleMeta?.locked) || !canSavePermissions;

                            return (
                              <div
                                key={permissionItem.id}
                                className="flex items-start justify-between gap-4 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/30"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{permissionItem.label}</p>
                                    <Badge variant="outline" className="rounded-full text-[11px]">
                                      {permissionItem.resource}.{permissionItem.action}
                                    </Badge>
                                    {isDefault && (
                                      <Badge variant="secondary" className="rounded-full text-[11px]">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{permissionItem.description}</p>
                                </div>
                                <Checkbox
                                  checked={checked}
                                  disabled={disabled}
                                  onCheckedChange={() => togglePermission(activeRole, permissionItem.id)}
                                  aria-label={`Toggle ${permissionItem.label}`}
                                  className="mt-1"
                                />
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                <div className="space-y-3">
                  <Card className="border-border/60 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Role Snapshot</CardTitle>
                      <CardDescription>Quick compare the saved state across every role.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {roles.map((role) => {
                        const draftCount = draftPermissions[role.id]?.length ?? 0;
                        const savedCount = savedPermissions[role.id]?.length ?? 0;
                        const dirty = !samePermissionList(
                          draftPermissions[role.id] ?? [],
                          savedPermissions[role.id] ?? [],
                        );
                        const Icon = ROLE_ICONS[role.id] ?? Shield;

                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => setActiveRole(role.id)}
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                              activeRole === role.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border/60 hover:bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-muted p-2">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{role.label}</p>
                                <p className="text-xs text-muted-foreground">{draftCount} enabled</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {role.locked ? (
                                <Badge variant="secondary" className="rounded-full">Locked</Badge>
                              ) : dirty ? (
                                <Badge className="rounded-full">Unsaved</Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full">Saved</Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                baseline {savedCount}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Editing Rules</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <p>Permissions control route access, sidebar visibility, and dashboard feature loading.</p>
                      <Separator />
                      <p>Ownership rules like self-only, assigned-only, and workflow state still apply underneath role permissions.</p>
                      <Separator />
                      <p>Super Admin stays fully enabled so the system cannot lock itself out.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

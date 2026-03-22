import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MultiSelectChecklist } from '@/components/ui/multi-select-checklist';
import { useToast } from '@/hooks/use-toast';
import { useServiceGroups } from '@/hooks/useServiceGroups';
import { useServices } from '@/hooks/useServices';
import API_ROUTES from '@/lib/api';
import { Loader2, Pencil, Plus, Trash2, Users2, Wrench } from 'lucide-react';
import type { Client } from '@/types/clients';
import type { ServiceGroupDetail } from '@/types/serviceGroups';

type ServiceGroupFormState = {
  name: string;
  description: string;
  is_active: boolean;
  service_ids: string[];
  client_ids: string[];
};

const emptyFormState: ServiceGroupFormState = {
  name: '',
  description: '',
  is_active: true,
  service_ids: [],
  client_ids: [],
};

export function ServiceGroupsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: groups = [], isLoading: groupsLoading } = useServiceGroups();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<ServiceGroupDetail | null>(null);
  const [formState, setFormState] = React.useState<ServiceGroupFormState>(emptyFormState);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['service-group-clients'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(API_ROUTES.clients.adminList, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load clients');
      }

      const json = await response.json();
      const records = Array.isArray(json.data) ? json.data : [];

      return records.map((client: any) => ({
        id: String(client.id),
        name: client.name,
        email: client.email,
        company: client.company_name || client.company || '',
        phone: client.phonenumber || client.phone || '',
        address: client.address || '',
        status: (client.account_status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
        shootsCount: Number(client.shoots_count ?? 0),
        lastActivity: client.updated_at || client.created_at || '',
        avatar: client.avatar || undefined,
        companyNotes: client.companyNotes ?? client.company_notes ?? '',
        service_groups: Array.isArray(client.service_groups)
          ? client.service_groups.map((group: any) => ({
              id: String(group.id),
              name: group.name,
              description: group.description ?? '',
            }))
          : [],
        service_group_ids: Array.isArray(client.service_group_ids)
          ? client.service_group_ids.map((id: any) => String(id))
          : [],
      }));
    },
  });

  const serviceOptions = React.useMemo(
    () =>
      [...services]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((service) => ({
          id: service.id,
          label: service.name,
          description: service.description || undefined,
          meta: service.category || 'Uncategorized',
        })),
    [services],
  );

  const clientOptions = React.useMemo(
    () =>
      [...clients]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((client) => ({
          id: client.id,
          label: client.name,
          description: client.email || undefined,
          meta: client.company || 'No company',
        })),
    [clients],
  );

  const resetForm = React.useCallback(() => {
    setEditingGroup(null);
    setFormState(emptyFormState);
  }, []);

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (group: ServiceGroupDetail) => {
    setEditingGroup(group);
    setFormState({
      name: group.name,
      description: group.description || '',
      is_active: group.is_active,
      service_ids: group.service_ids || [],
      client_ids: group.client_ids || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formState.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a service group name.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const url = editingGroup
        ? API_ROUTES.serviceGroups.update(editingGroup.id)
        : API_ROUTES.serviceGroups.create;
      const method = editingGroup ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formState.name.trim(),
          description: formState.description.trim() || null,
          is_active: formState.is_active,
          service_ids: formState.service_ids.map((id) => Number(id)),
          client_ids: formState.client_ids.map((id) => Number(id)),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save service group');
      }

      queryClient.invalidateQueries({ queryKey: ['service-groups'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });

      toast({
        title: editingGroup ? 'Service group updated' : 'Service group created',
        description: `${formState.name.trim()} saved successfully.`,
      });

      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error?.message || 'Failed to save service group.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: ServiceGroupDetail) => {
    const confirmed = window.confirm(`Delete "${group.name}"? This will remove all service and client assignments from the group.`);
    if (!confirmed) return;

    setDeletingId(group.id);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(API_ROUTES.serviceGroups.delete(group.id), {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete service group');
      }

      queryClient.invalidateQueries({ queryKey: ['service-groups'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });

      toast({
        title: 'Service group deleted',
        description: `${group.name} was removed successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Failed to delete service group.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const loading = groupsLoading || servicesLoading || clientsLoading;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Service Groups</CardTitle>
            <CardDescription>
              Create client-specific service catalogs by grouping services and assigning clients to those groups.
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Service Group
          </Button>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : groups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="h-full">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xl">{group.name}</CardTitle>
                      <Badge variant={group.is_active ? 'default' : 'secondary'}>
                        {group.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {group.description || 'No description yet.'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(group)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(group)}
                      disabled={deletingId === group.id}
                    >
                      {deletingId === group.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Services</p>
                      <Badge variant="secondary">{group.service_count}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.services.length > 0 ? (
                        group.services.slice(0, 6).map((service) => (
                          <Badge key={service.id} variant="outline">
                            {service.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No services assigned.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Clients</p>
                      <Badge variant="secondary">{group.client_count}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.clients.length > 0 ? (
                        group.clients.slice(0, 6).map((client) => (
                          <Badge key={client.id} variant="outline">
                            {client.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No clients assigned.</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <h3 className="text-lg font-semibold">No service groups yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Create your first service group to control which services specific clients can see while booking.
            </p>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Group
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && !saving) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Service Group' : 'Create Service Group'}</DialogTitle>
            <DialogDescription>
              Assign services and clients. Clients with one or more service groups will only see services from their assigned group(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service-group-name">Name</Label>
                <Input
                  id="service-group-name"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Enterprise Clients"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="service-group-active">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive groups stay assigned but are marked for admin review.
                  </p>
                </div>
                <Switch
                  id="service-group-active"
                  checked={formState.is_active}
                  onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-group-description">Description</Label>
              <Textarea
                id="service-group-description"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Who this group is for and what makes it different."
                rows={3}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Services</Label>
                <MultiSelectChecklist
                  options={serviceOptions}
                  value={formState.service_ids}
                  onChange={(value) => setFormState((prev) => ({ ...prev, service_ids: value }))}
                  placeholder="Select the services this group should allow."
                  emptyMessage="No services available yet."
                />
              </div>

              <div className="space-y-2">
                <Label>Clients</Label>
                <MultiSelectChecklist
                  options={clientOptions}
                  value={formState.client_ids}
                  onChange={(value) => setFormState((prev) => ({ ...prev, client_ids: value }))}
                  placeholder="Select the clients that belong to this group."
                  emptyMessage="No clients available yet."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

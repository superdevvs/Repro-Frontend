import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Users } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/sonner-toast';

import {
  SERVICE_AREA_KINDS,
  type ServiceAreaFilter,
  type ServiceAreaKind,
  type ServiceAreaPhotographer,
  commitServiceAreaAssignment,
  listAdminPhotographers,
  previewServiceAreaAssignment,
} from '@/services/serviceArea';

const KIND_LABELS: Record<ServiceAreaKind, string> = {
  region: 'Region',
  state: 'State',
  area: 'Area',
};

const KIND_PLACEHOLDERS: Record<ServiceAreaKind, string> = {
  region: 'e.g. Mid-Atlantic',
  state: 'e.g. MD',
  area: 'e.g. Bethesda',
};

const matchesQueryKey = (filter: ServiceAreaFilter | null) =>
  ['service-area', 'matches', filter?.kind ?? null, filter?.value ?? null] as const;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown; error?: unknown }).message;
      if (typeof message === 'string' && message) return message;
      const errorMsg = (data as { error?: unknown }).error;
      if (typeof errorMsg === 'string' && errorMsg) return errorMsg;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};

/**
 * `ServiceAreaAssignmentTool` (Req 10).
 *
 * Workflow:
 *   1. Admin enters a (kind, value) filter.
 *   2. "Preview matches" calls /admin/assignments/preview — renders the matching photographers
 *      and persists nothing (AC 10.3, 10.5).
 *   3. Admin selects a photographer to receive this service area.
 *   4. "Confirm assignment" calls /admin/assignments/commit — persists the assignment in a
 *      transaction (AC 10.4), refreshes the displayed match list, and shows a success toast.
 */
export function ServiceAreaAssignmentTool() {
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<ServiceAreaKind>('state');
  const [value, setValue] = useState('');
  const [activeFilter, setActiveFilter] = useState<ServiceAreaFilter | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const trimmedValue = value.trim();
  const canPreview = trimmedValue.length > 0;

  const previewQuery = useQuery({
    queryKey: matchesQueryKey(activeFilter),
    queryFn: () => previewServiceAreaAssignment(activeFilter as ServiceAreaFilter),
    enabled: activeFilter !== null,
  });

  const photographersQuery = useQuery({
    queryKey: ['admin', 'photographers'],
    queryFn: listAdminPhotographers,
  });

  const matches: ServiceAreaPhotographer[] = previewQuery.data?.photographers ?? [];

  const commitMutation = useMutation({
    mutationFn: ({ filter, userId }: { filter: ServiceAreaFilter; userId: number }) =>
      commitServiceAreaAssignment(filter, userId),
    onSuccess: (_data, variables) => {
      // After commit, refresh the displayed match list (AC 10.4).
      queryClient.invalidateQueries({ queryKey: matchesQueryKey(variables.filter) });
      toast.success('Service area assigned', {
        description: `${KIND_LABELS[variables.filter.kind]} "${variables.filter.value}" assigned successfully.`,
      });
      setSelectedUserId('');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to assign service area.'));
    },
  });

  const handlePreview = () => {
    if (!canPreview) {
      toast.warning('Enter a value to preview matches.');
      return;
    }
    setActiveFilter({ kind, value: trimmedValue });
    setSelectedUserId('');
  };

  const handleCommit = () => {
    if (!activeFilter) {
      toast.warning('Preview matches before confirming.');
      return;
    }
    const userId = Number(selectedUserId);
    if (!Number.isFinite(userId) || userId <= 0) {
      toast.warning('Select a photographer to assign.');
      return;
    }
    commitMutation.mutate({ filter: activeFilter, userId });
  };

  const photographerOptions = useMemo(
    () => photographersQuery.data ?? [],
    [photographersQuery.data],
  );

  const isPreviewLoading = previewQuery.isFetching;
  const isCommitting = commitMutation.isPending;

  return (
    <div className="space-y-6" data-testid="service-area-assignment-tool">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Service Area Filter
          </CardTitle>
          <CardDescription>
            Choose a region, state, or area to preview which photographers currently match.
            Previewing does not change any assignments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="service-area-kind">Kind</Label>
              <Select
                value={kind}
                onValueChange={(next) => setKind(next as ServiceAreaKind)}
              >
                <SelectTrigger id="service-area-kind">
                  <SelectValue placeholder="Select kind" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_AREA_KINDS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {KIND_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-area-value">Value</Label>
              <Input
                id="service-area-value"
                value={value}
                placeholder={KIND_PLACEHOLDERS[kind]}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handlePreview();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              data-testid="service-area-preview-button"
              onClick={handlePreview}
              disabled={!canPreview || isPreviewLoading}
            >
              {isPreviewLoading ? 'Previewing…' : 'Preview matches'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeFilter && (
        <Card data-testid="service-area-matches-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Matching Photographers
            </CardTitle>
            <CardDescription>
              {`Photographers currently assigned to ${KIND_LABELS[activeFilter.kind].toLowerCase()} "${activeFilter.value}". Preview persists nothing.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewQuery.isError && (
              <p className="text-sm text-destructive">
                {getErrorMessage(previewQuery.error, 'Failed to load matches.')}
              </p>
            )}

            {!previewQuery.isError && isPreviewLoading && (
              <p className="text-sm text-muted-foreground">Loading matches…</p>
            )}

            {!previewQuery.isError && !isPreviewLoading && matches.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No photographers currently match this filter.
              </p>
            )}

            {matches.length > 0 && (
              <ul className="divide-y rounded-md border" data-testid="service-area-matches-list">
                {matches.map((photographer) => (
                  <li
                    key={photographer.id}
                    data-testid="service-area-match-row"
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{photographer.name}</p>
                      <p className="text-sm text-muted-foreground">{photographer.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {photographer.service_areas.map((area) => (
                        <Badge
                          key={`${area.kind}-${area.value}`}
                          variant="secondary"
                          className="text-xs"
                        >
                          {`${KIND_LABELS[area.kind]}: ${area.value}`}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="service-area-photographer">Assign to photographer</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={photographersQuery.isLoading || photographerOptions.length === 0}
                >
                  <SelectTrigger id="service-area-photographer">
                    <SelectValue
                      placeholder={
                        photographersQuery.isLoading
                          ? 'Loading photographers…'
                          : 'Select a photographer'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {photographerOptions.map((photographer) => (
                      <SelectItem
                        key={photographer.id}
                        value={String(photographer.id)}
                      >
                        {photographer.name}
                        {photographer.email ? ` — ${photographer.email}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                data-testid="service-area-commit-button"
                onClick={handleCommit}
                disabled={!selectedUserId || isCommitting}
                className="gap-2"
              >
                {isCommitting ? (
                  'Confirming…'
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm assignment
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ServiceAreaAssignmentTool;

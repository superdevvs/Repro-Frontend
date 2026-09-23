import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { toast } from '@/components/ui/use-toast';
import {
  createCubicasaOrder,
  getCubicasaTrackedShoots,
  type CubicasaTrackedShoot,
} from '@/services/cubicasaTracking';

type TrackerStatus = 'missing' | 'linked';

const canCreateCubicasaOrder = (role?: string | null) =>
  role === 'admin' || role === 'superadmin' || role === 'editing_manager';

const errorMessage = (error: unknown) => {
  const response = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return response?.message || response?.error || 'Could not load CubiCasa shoots.';
};

export default function CubiCasaScanning() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TrackerStatus>('missing');
  const [search, setSearch] = useState('');
  const canCreate = canCreateCubicasaOrder(role);

  const shootsQuery = useQuery({
    queryKey: ['cubicasa-shoots', status, search],
    queryFn: () => getCubicasaTrackedShoots({ status, search }),
  });

  const createMutation = useMutation({
    mutationFn: (shootId: number) => createCubicasaOrder(shootId),
    onSuccess: () => {
      toast({ title: 'CubiCasa order created', description: 'The shoot is now connected.' });
      queryClient.invalidateQueries({ queryKey: ['cubicasa-shoots'] });
    },
    onError: (error: unknown) => {
      toast({ title: 'Could not create the order', description: errorMessage(error), variant: 'destructive' });
    },
  });

  const rows = shootsQuery.data?.data ?? [];
  const counts = shootsQuery.data?.counts ?? { missing: 0, linked: 0 };

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <PageHeader
          badge="Property"
          title="Property Scan"
          description="Floor plan bookings and the CubiCasa orders created for them."
          compactTitleOnMobile
        />

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by address"
          aria-label="Search by address"
        />

        <div className="grid grid-cols-2 gap-2">
          <FilterButton
            active={status === 'missing'}
            onClick={() => setStatus('missing')}
            label="Needs an order"
            count={counts.missing}
          />
          <FilterButton
            active={status === 'linked'}
            onClick={() => setStatus('linked')}
            label="Connected"
            count={counts.linked}
          />
        </div>

        {shootsQuery.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could not load shoots</AlertTitle>
            <AlertDescription>{errorMessage(shootsQuery.error)}</AlertDescription>
          </Alert>
        )}

        {shootsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <InlineSpinner className="mr-2 h-4 w-4" />
            Loading shoots
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="scanning"
            title={status === 'missing' ? 'Every floor plan booking has an order.' : 'No connected CubiCasa orders yet.'}
            size="compact"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((shoot) => (
              <ShootRow
                key={shoot.id}
                shoot={shoot}
                canCreate={canCreate}
                creating={createMutation.isPending && createMutation.variables === shoot.id}
                onCreate={() => createMutation.mutate(shoot.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}, ${count}`}
      className={`flex h-11 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-medium ${
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-background text-muted-foreground'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums text-xs">{count}</span>
    </button>
  );
}

function ShootRow({
  shoot,
  canCreate,
  creating,
  onCreate,
}: {
  shoot: CubicasaTrackedShoot;
  canCreate: boolean;
  creating: boolean;
  onCreate: () => void;
}) {
  const when = shoot.scheduled_at ? format(new Date(shoot.scheduled_at), 'MMM d, yyyy') : null;
  const who = [shoot.client_name, shoot.photographer_name].filter(Boolean).join(' · ');

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="min-w-0">
        <p className="font-semibold leading-snug">{shoot.address || `Shoot #${shoot.id}`}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {[when, who].filter(Boolean).join(' · ') || 'Scheduled'}
        </p>
        {shoot.services.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{shoot.services.join(', ')}</p>
        )}
      </div>

      {shoot.linked ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium">{shoot.cubicasa_status || 'Connected'}</span>
          {shoot.cubicasa_order_id && (
            <span className="truncate text-muted-foreground">{shoot.cubicasa_order_id}</span>
          )}
          {shoot.cubicasa_last_sync_error && (
            <span className="text-destructive">{shoot.cubicasa_last_sync_error}</span>
          )}
        </div>
      ) : (
        shoot.cubicasa_last_sync_error && (
          <p className="text-sm text-destructive">{shoot.cubicasa_last_sync_error}</p>
        )
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/shoots/${shoot.id}`}>Open shoot</Link>
        </Button>
        {!shoot.linked && canCreate && (
          <Button
            size="sm"
            onClick={onCreate}
            disabled={creating}
            aria-label={`Create order for ${shoot.address || `shoot ${shoot.id}`}`}
          >
            {creating && <InlineSpinner className="mr-2 h-4 w-4" />}
            Create order
          </Button>
        )}
      </div>
    </li>
  );
}

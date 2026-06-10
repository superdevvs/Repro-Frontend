import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, FlaskConical, MapPin, Users } from 'lucide-react';

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
import { calendarDay, formatInZone } from '@/lib/date';

import { SERVICE_AREA_KINDS, type ServiceAreaKind } from '@/services/serviceArea';
import {
  type EligiblePhotographer,
  type TestShoot,
  assignTestShoot,
  createTestShoot,
  previewEligiblePhotographers,
} from '@/services/testShoot';

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

/**
 * A curated set of common IANA timezones plus the viewer's own zone, so an admin can
 * scope a Test_Shoot to the region timezone that drives its displayed calendar day.
 */
const TIMEZONE_OPTIONS = (() => {
  const base = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'UTC',
  ];
  let local = '';
  try {
    local = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    local = '';
  }
  return local && !base.includes(local) ? [local, ...base] : base;
})();

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
      const errorMsg = (data as { error?: unknown }).error;
      if (typeof errorMsg === 'string' && errorMsg) return errorMsg;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};

/** Render the Test_Shoot's scheduled day/time in its region timezone (AC 10.11). */
const renderScheduled = (shoot: TestShoot): string => {
  const tz = shoot.timezone || 'UTC';
  if (shoot.scheduled_at) {
    return formatInZone(shoot.scheduled_at, tz, {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  }
  // Fall back to the local calendar day (parsed as local midnight — never re-shifted).
  const day = calendarDay(shoot.scheduled_date);
  return Number.isNaN(day.getTime())
    ? shoot.scheduled_date
    : day.toLocaleDateString('en-US', { dateStyle: 'full' } as Intl.DateTimeFormatOptions);
};

/** Reusable badge that distinguishes a Test_Shoot from a real shoot (Req 10.10). */
export function InternalTestBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      <FlaskConical className="mr-1 h-3 w-3" />
      Internal Test
    </Badge>
  );
}

/**
 * `TestShootPanel` (Req 10.7-10.11).
 *
 * Lets an admin run the region-based assignment simulator end to end:
 *   1. Create a Test_Shoot scoped to a region/state/area at a chosen instant + timezone (AC 10.7).
 *   2. Preview the photographers eligible for that scope (AC 10.8) — reuses the production matcher.
 *   3. Assign one eligible photographer and link them to the Test_Shoot (AC 10.9).
 *
 * After assignment the Test_Shoot flows through the same schedule query as a real shoot, so it
 * appears on the assigned photographer's Shoot Calendar (AC 10.10). Its date/time renders in the
 * region timezone via the timezone-safe helpers in lib/date.ts so the displayed calendar day
 * equals the scheduled day (AC 10.11). An internal-test badge marks it apart from real shoots.
 */
export function TestShootPanel() {
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<ServiceAreaKind>('state');
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [timezone, setTimezone] = useState<string>(TIMEZONE_OPTIONS[0]);

  const [testShoot, setTestShoot] = useState<TestShoot | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const trimmedValue = value.trim();
  const canCreate = trimmedValue.length > 0 && date.length > 0 && time.length > 0;

  const createMutation = useMutation({
    mutationFn: createTestShoot,
    onSuccess: (data) => {
      setTestShoot(data.shoot);
      setSelectedUserId('');
      toast.success('Test_Shoot created', {
        description: `Scoped to ${KIND_LABELS[kind].toLowerCase()} "${trimmedValue}".`,
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to create Test_Shoot.'));
    },
  });

  const eligibleQuery = useQuery({
    queryKey: ['test-shoot', 'eligible', testShoot?.id ?? null],
    queryFn: () => previewEligiblePhotographers(testShoot!.id),
    enabled: testShoot !== null,
  });

  const eligible: EligiblePhotographer[] = eligibleQuery.data?.photographers ?? [];

  const assignMutation = useMutation({
    mutationFn: ({ shootId, userId }: { shootId: number; userId: number }) =>
      assignTestShoot(shootId, userId),
    onSuccess: (data) => {
      setTestShoot(data.shoot);
      // The Test_Shoot now belongs to the photographer's schedule — refresh shoot queries
      // so it appears in the Shoot Calendar without a manual reload (AC 10.10).
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      const assigned = eligible.find((p) => p.id === data.shoot.photographer_id);
      toast.success('Photographer assigned to Test_Shoot', {
        description: assigned
          ? `${assigned.name} will see this Test_Shoot in their schedule.`
          : 'The Test_Shoot now appears in the photographer\u2019s schedule.',
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to assign photographer.'));
    },
  });

  const handleCreate = () => {
    if (!canCreate) {
      toast.warning('Enter an area value, date, and time to create a Test_Shoot.');
      return;
    }
    // Combine the chosen local date + time; the backend reads `timezone` as authoritative
    // for the local calendar day, so we send a wall-clock datetime alongside the zone.
    createMutation.mutate({
      kind,
      value: trimmedValue,
      scheduled_at: `${date}T${time.length === 5 ? `${time}:00` : time}`,
      timezone,
    });
  };

  const handleAssign = () => {
    if (!testShoot) return;
    const userId = Number(selectedUserId);
    if (!Number.isFinite(userId) || userId <= 0) {
      toast.warning('Select an eligible photographer to assign.');
      return;
    }
    assignMutation.mutate({ shootId: testShoot.id, userId });
  };

  const eligibleOptions = useMemo(() => eligible, [eligible]);
  const assignedPhotographer = testShoot?.photographer_id
    ? eligible.find((p) => p.id === testShoot.photographer_id)
    : undefined;

  const isCreating = createMutation.isPending;
  const isEligibleLoading = eligibleQuery.isFetching;
  const isAssigning = assignMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Test_Shoot Simulator
          </CardTitle>
          <CardDescription>
            Create a simulated shoot scoped to a region, state, or area to verify region-based
            assignment, scheduling, and timezone behavior. Test shoots are flagged internally and
            never mix with real bookings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-shoot-kind">Service area kind</Label>
              <Select value={kind} onValueChange={(next) => setKind(next as ServiceAreaKind)}>
                <SelectTrigger id="test-shoot-kind">
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
              <Label htmlFor="test-shoot-value">Service area value</Label>
              <Input
                id="test-shoot-value"
                value={value}
                placeholder={KIND_PLACEHOLDERS[kind]}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-shoot-date">Date</Label>
              <Input
                id="test-shoot-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-shoot-time">Time</Label>
              <Input
                id="test-shoot-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="test-shoot-timezone">Region timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="test-shoot-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" onClick={handleCreate} disabled={!canCreate || isCreating}>
            {isCreating ? 'Creating…' : 'Create Test_Shoot'}
          </Button>
        </CardContent>
      </Card>

      {testShoot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Test_Shoot
              <InternalTestBadge className="ml-1" />
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {KIND_LABELS[(testShoot.service_area_kind as ServiceAreaKind)] ??
                  testShoot.service_area_kind}
                : {testShoot.service_area_value}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{renderScheduled(testShoot)}</p>
              <p className="text-muted-foreground">
                {testShoot.timezone ?? 'UTC'} · scheduled day {testShoot.scheduled_date}
              </p>
            </div>

            {assignedPhotographer ? (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>
                  Assigned to <span className="font-medium">{assignedPhotographer.name}</span>. It
                  now appears in their schedule.
                </span>
              </div>
            ) : testShoot.photographer_id ? (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Assigned. It now appears in the photographer&rsquo;s schedule.</span>
              </div>
            ) : null}

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Eligible photographers</p>
              </div>

              {eligibleQuery.isError && (
                <p className="text-sm text-destructive">
                  {getErrorMessage(eligibleQuery.error, 'Failed to load eligible photographers.')}
                </p>
              )}

              {!eligibleQuery.isError && isEligibleLoading && (
                <p className="text-sm text-muted-foreground">Loading eligible photographers…</p>
              )}

              {!eligibleQuery.isError && !isEligibleLoading && eligibleOptions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No photographers match this Test_Shoot&rsquo;s service area.
                </p>
              )}

              {eligibleOptions.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="test-shoot-photographer">Assign to photographer</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger id="test-shoot-photographer">
                        <SelectValue placeholder="Select an eligible photographer" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleOptions.map((photographer) => (
                          <SelectItem key={photographer.id} value={String(photographer.id)}>
                            {photographer.name}
                            {photographer.email ? ` — ${photographer.email}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAssign}
                    disabled={!selectedUserId || isAssigning}
                    className="gap-2"
                  >
                    {isAssigning ? (
                      'Assigning…'
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Assign photographer
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TestShootPanel;

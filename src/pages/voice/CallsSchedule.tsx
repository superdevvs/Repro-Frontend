import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import ScheduleBadge from '@/components/voice/ScheduleBadge';
import {
  createScheduleOverride,
  deleteScheduleOverride,
  getScheduleOverrides,
  getVoiceSettings,
  updateVoiceSettings,
} from '@/services/voice';
import type { VoiceScheduleOverride, VoiceSettings } from '@/types/voice';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function CallsSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const overrides = useQuery({ queryKey: ['voice-schedule-overrides'], queryFn: getScheduleOverrides });
  const [draft, setDraft] = useState<Partial<VoiceSettings>>({});
  const [newOverride, setNewOverride] = useState({ starts_at: '', ends_at: '', mode: 'closed' as 'open' | 'closed', label: '' });

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: updateVoiceSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['voice-settings'], data);
      queryClient.invalidateQueries({ queryKey: ['voice-schedule-state'] });
      toast({ title: 'Schedule saved' });
    },
  });

  const addOverride = useMutation({
    mutationFn: createScheduleOverride,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['voice-schedule-state'] });
      setNewOverride({ starts_at: '', ends_at: '', mode: 'closed', label: '' });
      toast({ title: 'Override added' });
    },
  });

  const removeOverride = useMutation({
    mutationFn: (id: number) => deleteScheduleOverride(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['voice-schedule-state'] });
    },
  });

  const weekly = draft.business_hours?.weekly ?? {};

  const setWindow = (day: string, idx: number, pos: 0 | 1, value: string) => {
    setDraft((current) => {
      const bh = current.business_hours ?? {};
      const w = { ...(bh.weekly ?? {}) } as Record<string, Array<[string, string]>>;
      const windows = [...(w[day] ?? [])].map((win) => [...win] as [string, string]);
      if (!windows[idx]) windows[idx] = ['09:00', '17:00'];
      windows[idx][pos] = value;
      w[day] = windows;
      return { ...current, business_hours: { ...bh, weekly: w } };
    });
  };

  const addWindow = (day: string) => {
    setDraft((current) => {
      const bh = current.business_hours ?? {};
      const w = { ...(bh.weekly ?? {}) } as Record<string, Array<[string, string]>>;
      w[day] = [...(w[day] ?? []), ['09:00', '17:00']];
      return { ...current, business_hours: { ...bh, weekly: w } };
    });
  };

  const removeWindow = (day: string, idx: number) => {
    setDraft((current) => {
      const bh = current.business_hours ?? {};
      const w = { ...(bh.weekly ?? {}) } as Record<string, Array<[string, string]>>;
      w[day] = (w[day] ?? []).filter((_, i) => i !== idx);
      return { ...current, business_hours: { ...bh, weekly: w } };
    });
  };

  const presetOverride = (hours: number, mode: 'open' | 'closed', label: string) => {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 3600 * 1000);
    addOverride.mutate({ starts_at: now.toISOString(), ends_at: end.toISOString(), mode, label });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue-600" /> Business Schedule
            </span>
            <ScheduleBadge />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Timezone</label>
            <Input
              className="max-w-xs"
              value={draft.business_hours?.timezone ?? 'UTC'}
              onChange={(e) =>
                setDraft((c) => ({ ...c, business_hours: { ...(c.business_hours ?? {}), timezone: e.target.value } }))
              }
              placeholder="America/New_York"
            />
          </div>

          <div className="space-y-2">
            {DAYS.map((day) => (
              <div key={day} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                <span className="w-24 text-sm font-medium capitalize">{day}</span>
                {(weekly[day] ?? []).map((win, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <Input
                      type="time"
                      className="h-8 w-28"
                      value={win[0]}
                      onChange={(e) => setWindow(day, idx, 0, e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="time"
                      className="h-8 w-28"
                      value={win[1]}
                      onChange={(e) => setWindow(day, idx, 1, e.target.value)}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeWindow(day, idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ))}
                {(weekly[day] ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">Closed</span>
                )}
                <Button size="sm" variant="outline" className="ml-auto h-8" onClick={() => addWindow(day)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Window
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate({ business_hours: draft.business_hours })} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> Save hours
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Holidays */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Holidays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(draft.holidays ?? []).map((h, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                type="date"
                className="h-8 w-44"
                value={h.date}
                onChange={(e) =>
                  setDraft((c) => {
                    const list = [...(c.holidays ?? [])];
                    list[idx] = { ...list[idx], date: e.target.value };
                    return { ...c, holidays: list };
                  })
                }
              />
              <Input
                className="h-8"
                placeholder="Label (e.g. Christmas)"
                value={h.label ?? ''}
                onChange={(e) =>
                  setDraft((c) => {
                    const list = [...(c.holidays ?? [])];
                    list[idx] = { ...list[idx], label: e.target.value };
                    return { ...c, holidays: list };
                  })
                }
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setDraft((c) => ({ ...c, holidays: (c.holidays ?? []).filter((_, i) => i !== idx) }))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft((c) => ({ ...c, holidays: [...(c.holidays ?? []), { date: '', label: '' }] }))}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add holiday
            </Button>
            <Button onClick={() => save.mutate({ holidays: draft.holidays })} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> Save holidays
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quiet hours + messages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quiet hours & messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Quiet hours enabled</div>
              <div className="text-xs text-muted-foreground">Suppresses callbacks and outbound during this window.</div>
            </div>
            <Switch
              checked={draft.quiet_hours?.enabled ?? false}
              onCheckedChange={(checked) =>
                setDraft((c) => ({ ...c, quiet_hours: { ...(c.quiet_hours ?? {}), enabled: checked } }))
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start</label>
              <Input
                type="time"
                value={draft.quiet_hours?.start ?? '20:00'}
                onChange={(e) => setDraft((c) => ({ ...c, quiet_hours: { ...(c.quiet_hours ?? {}), start: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End</label>
              <Input
                type="time"
                value={draft.quiet_hours?.end ?? '08:00'}
                onChange={(e) => setDraft((c) => ({ ...c, quiet_hours: { ...(c.quiet_hours ?? {}), end: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Timezone</label>
              <Input
                value={draft.quiet_hours?.timezone ?? 'UTC'}
                onChange={(e) => setDraft((c) => ({ ...c, quiet_hours: { ...(c.quiet_hours ?? {}), timezone: e.target.value } }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Out-of-hours message</label>
            <Textarea
              value={draft.out_of_hours_message ?? ''}
              onChange={(e) => setDraft((c) => ({ ...c, out_of_hours_message: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Holiday message ({'{holiday_label}'} supported)</label>
            <Textarea
              value={draft.holiday_message ?? ''}
              onChange={(e) => setDraft((c) => ({ ...c, holiday_message: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() =>
                save.mutate({
                  quiet_hours: draft.quiet_hours,
                  out_of_hours_message: draft.out_of_hours_message,
                  holiday_message: draft.holiday_message,
                })
              }
              disabled={save.isPending}
            >
              <Save className="mr-2 h-4 w-4" /> Save messages
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overrides */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => presetOverride(2, 'open', 'Extended support 2h')}>
              Extended support 2h
            </Button>
            <Button size="sm" variant="outline" onClick={() => presetOverride(24, 'closed', 'Closed today')}>
              Closed today
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            <Input
              type="datetime-local"
              className="h-8"
              value={newOverride.starts_at}
              onChange={(e) => setNewOverride((o) => ({ ...o, starts_at: e.target.value }))}
            />
            <Input
              type="datetime-local"
              className="h-8"
              value={newOverride.ends_at}
              onChange={(e) => setNewOverride((o) => ({ ...o, ends_at: e.target.value }))}
            />
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              value={newOverride.mode}
              onChange={(e) => setNewOverride((o) => ({ ...o, mode: e.target.value as 'open' | 'closed' }))}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <Input
              className="h-8"
              placeholder="Label"
              value={newOverride.label}
              onChange={(e) => setNewOverride((o) => ({ ...o, label: e.target.value }))}
            />
            <Button
              size="sm"
              disabled={!newOverride.starts_at || !newOverride.ends_at || addOverride.isPending}
              onClick={() =>
                addOverride.mutate({
                  starts_at: new Date(newOverride.starts_at).toISOString(),
                  ends_at: new Date(newOverride.ends_at).toISOString(),
                  mode: newOverride.mode,
                  label: newOverride.label || undefined,
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>

          <div className="space-y-1">
            {(overrides.data ?? []).map((o: VoiceScheduleOverride) => (
              <div key={o.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                <Badge variant={o.mode === 'open' ? 'default' : 'secondary'}>{o.mode}</Badge>
                <span className="font-medium">{o.label ?? 'Override'}</span>
                <span className="text-muted-foreground">
                  {new Date(o.starts_at).toLocaleString()} → {new Date(o.ends_at).toLocaleString()}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto h-7 w-7"
                  onClick={() => removeOverride.mutate(o.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(overrides.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No active overrides.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

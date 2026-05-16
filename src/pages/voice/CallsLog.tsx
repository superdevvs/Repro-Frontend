import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Headphones, PhoneForwarded } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getVoiceCalls, pageVoiceCallStaff } from '@/services/voice';
import type { VoiceCall } from '@/types/voice';

const filters = [
  { value: '', label: 'All' },
  { value: 'missed', label: 'Missed' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'callback_needed', label: 'Callback needed' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'unresolved', label: 'Unresolved' },
];

export default function CallsLog() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const calls = useQuery({
    queryKey: ['voice-calls', filter],
    queryFn: () => getVoiceCalls({ per_page: 50, filter: filter || undefined }),
  });
  const pageStaff = useMutation({
    mutationFn: (call: VoiceCall) => pageVoiceCallStaff(call.id, 'Requested from Calls UI'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voice-calls'] }),
  });

  const rows = calls.data?.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-base">Call Log</CardTitle>
            <p className="text-sm text-muted-foreground">Contact, routing intent, transcript, callback status, disposition, and actions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <Button
                key={item.value || 'all'}
                size="sm"
                variant={filter === item.value ? 'default' : 'outline'}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Menu</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Assistant</TableHead>
                <TableHead>Related Shoot</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Transcript</TableHead>
                <TableHead>Callback</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="font-medium">{callerName(call)}</TableCell>
                  <TableCell>
                    <Badge variant={call.direction === 'OUTBOUND' ? 'default' : 'secondary'}>{call.direction}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{call.status}</Badge>
                  </TableCell>
                  <TableCell>{call.intent || '—'}</TableCell>
                  <TableCell>{call.menu_digit || '—'}</TableCell>
                  <TableCell>{call.duration_seconds ? `${call.duration_seconds}s` : '—'}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{call.assistant_id || 'Default'}</TableCell>
                  <TableCell>{String((call.related_shoot ?? call.relatedShoot)?.address ?? '—')}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">
                    {call.summary ? call.summary.slice(0, 120) : '—'}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">
                    {call.transcript ? call.transcript.slice(0, 120) : '—'}
                  </TableCell>
                  <TableCell>{call.callback_status || '—'}</TableCell>
                  <TableCell>{call.disposition || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => pageStaff.mutate(call)} disabled={pageStaff.isPending}>
                      <PhoneForwarded className="mr-1 h-3.5 w-3.5" /> Page staff
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {calls.isLoading && (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading calls…</div>
        )}
        {!calls.isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Headphones className="mx-auto mb-2 h-6 w-6" /> No calls yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function callerName(call: VoiceCall): string {
  return (
    call.caller_user?.name ??
    call.callerUser?.name ??
    call.caller_contact?.name ??
    call.callerContact?.name ??
    call.from_phone ??
    call.to_phone ??
    'Unknown'
  );
}

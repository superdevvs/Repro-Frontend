import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PhoneCall } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getVoiceNumbers, updateVoiceNumber } from '@/services/voice';
import type { VoiceNumberConfig } from '@/types/voice';

export default function CallsNumbers() {
  const queryClient = useQueryClient();
  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers });
  usePageLoading(numbers.isLoading);

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VoiceNumberConfig> }) => updateVoiceNumber(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voice-numbers'] }),
  });

  const rows = numbers.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCall className="h-4 w-4 text-blue-600" /> Call Numbers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((number) => (
          <div
            key={number.id}
            className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 md:grid-cols-[1fr_auto] md:items-center"
          >
            <div>
              <div className="font-medium">{number.label || number.phone_number}</div>
              <div className="text-sm text-muted-foreground">{number.phone_number}</div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={number.voice_ai_enabled ?? false}
                  onCheckedChange={(checked) =>
                    update.mutate({ id: number.id, data: { voice_ai_enabled: checked } })
                  }
                />
                Voice AI
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={number.sms_ai_enabled ?? false}
                  onCheckedChange={(checked) =>
                    update.mutate({ id: number.id, data: { sms_ai_enabled: checked } })
                  }
                />
                Robbie SMS
              </label>
            </div>
          </div>
        ))}
        {numbers.isLoading && <p className="text-sm text-muted-foreground">Loading numbers…</p>}
        {numbers.isError && <div role="alert" className="py-6 text-center text-sm text-destructive"><p>Could not load numbers.</p><Button variant="outline" className="mt-3" onClick={() => void numbers.refetch()}>Try Again</Button></div>}
          {!numbers.isLoading && !numbers.isError && rows.length === 0 && (
          <EmptyState icon="calls" title={<>No Telnyx numbers configured yet.</>} size="compact" />
        )}
      </CardContent>
    </Card>
  );
}

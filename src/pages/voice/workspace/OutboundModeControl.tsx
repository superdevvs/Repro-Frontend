import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { VoiceOutboundMode } from '@/types/voice';

const modes: Array<{ id: VoiceOutboundMode; label: string; description: string }> = [
  { id: 'all', label: 'Allow all', description: 'Place outbound calls to any destination.' },
  { id: 'canary', label: 'Canary', description: 'Only the allowlisted numbers below.' },
  { id: 'none', label: 'None', description: 'Block outbound calling entirely.' },
];

export default function OutboundModeControl({
  mode,
  canaryNumbers,
  disabled,
  onChange,
}: {
  mode?: VoiceOutboundMode | string | null;
  canaryNumbers?: string[];
  disabled?: boolean;
  onChange: (next: { outbound_mode: VoiceOutboundMode; canary_numbers: string[] }) => void;
}) {
  const current = modes.some((item) => item.id === mode) ? (mode as VoiceOutboundMode) : 'canary';
  const [draftNumbers, setDraftNumbers] = useState((canaryNumbers ?? []).join('\n'));

  useEffect(() => {
    setDraftNumbers((canaryNumbers ?? []).join('\n'));
  }, [canaryNumbers]);

  const parsedNumbers = draftNumbers
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Outbound calling</h3>
        <p className="mt-1 text-xs text-[var(--calls-muted)]">
          Allow all destinations, limit outbound to a canary list, or turn it off.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={current === item.id}
            disabled={disabled}
            onClick={() => onChange({ outbound_mode: item.id, canary_numbers: parsedNumbers })}
            className={cn(
              'rounded-xl border px-3 py-3 text-left transition-colors',
              current === item.id
                ? 'border-[var(--calls-brand)] bg-[var(--calls-brand-soft)]'
                : 'border-[var(--calls-border)] bg-[var(--calls-subtle)]',
            )}
          >
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="mt-1 block text-xs text-[var(--calls-muted)]">{item.description}</span>
          </button>
        ))}
      </div>
      {current === 'canary' ? (
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="canary-numbers">
            Canary numbers
          </label>
          <Textarea
            id="canary-numbers"
            className="min-h-24"
            value={draftNumbers}
            disabled={disabled}
            placeholder="+12025550123"
            onChange={(event) => setDraftNumbers(event.target.value)}
            onBlur={() => onChange({ outbound_mode: 'canary', canary_numbers: parsedNumbers })}
          />
          <p className="text-xs text-[var(--calls-muted)]">One number per line. Stored as E.164.</p>
        </div>
      ) : null}
    </div>
  );
}

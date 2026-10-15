import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight, Loader2, Phone } from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { cn } from '@/lib/utils';
import './callGlass.css';

export type CallGlassTone = 'call' | 'live' | 'held' | 'robbie';

export function RobbieMark({ className = '' }: { className?: string }) {
  return <span className={cn('call-robbie-mark', className)} aria-hidden="true"><ReproAiIcon /></span>;
}

export function CallWaveform({ paused = false }: { paused?: boolean }) {
  return <span className="call-glass-wave" data-paused={paused || undefined} aria-hidden="true">{[0, 1, 2, 3, 4].map(bar => <i key={bar} />)}</span>;
}

export function CallGlassSurface() {
  return <><span className="call-glass-lens" aria-hidden="true"><span className="call-glass-mesh" /><span className="call-glass-mesh call-glass-mesh-secondary" /></span><span className="call-glass-reflection" aria-hidden="true" /></>;
}

interface CallGlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: CallGlassTone;
  busy?: boolean;
  icon?: ReactNode;
}

export const CallGlassButton = forwardRef<HTMLButtonElement, CallGlassButtonProps>(
  function CallGlassButton({ tone = 'call', busy = false, icon, children, className, disabled, ...props }, ref) {
    return <button {...props} ref={ref} type={props.type || 'button'} className={cn('call-glass-button', className)} data-tone={tone} aria-busy={busy || undefined} disabled={disabled || busy}>
      <CallGlassSurface />
      <span className="call-glass-content">
        {tone === 'robbie' ? <RobbieMark /> : <span className="call-glass-icon">{busy ? <Loader2 className="animate-spin" size={18} /> : icon || <Phone size={18} />}</span>}
        <span className="call-glass-label">{children}</span>
        {tone === 'robbie' && <span className="call-robbie-ai" aria-hidden="true">AI</span>}
      </span>
    </button>;
  },
);

export function CallGlassStatus({ tone = 'live', children, paused = false, robbie = false, className }: {
  tone?: CallGlassTone; children: ReactNode; paused?: boolean; robbie?: boolean; className?: string;
}) {
  return <span className={cn('call-glass-status', className)} data-tone={tone}>
    <CallGlassSurface /><span className="call-glass-content">{robbie ? <RobbieMark /> : <span className="call-glass-icon"><Phone size={16} /></span>}<span className="call-glass-label">{children}</span><CallWaveform paused={paused} /></span>
  </span>;
}

export function RobbieHandoffButton({ busy = false, children = 'Send to Robbie', className, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return <button {...props} type={props.type || 'button'} className={cn('call-robbie-handoff', className)} aria-busy={busy || undefined} disabled={disabled || busy}>
    <RobbieMark /><span>{children}</span><span className="call-robbie-ai" aria-hidden="true">AI</span>{busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
  </button>;
}

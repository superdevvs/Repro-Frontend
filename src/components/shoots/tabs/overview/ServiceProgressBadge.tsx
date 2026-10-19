import { Check } from 'lucide-react';
import type { ServiceProgress } from './serviceProgress';

export function ServiceProgressBadge({ progress, serviceName }: { progress: ServiceProgress; serviceName: string }) {
  return <span className="service-progress-badge" data-tone={progress.tone} data-progress={progress.code}
    aria-label={`${serviceName}: ${progress.label}`}>
    {progress.code === 'delivered' ? <Check aria-hidden="true" /> : <span className="service-progress-dot" aria-hidden="true" />}
    <span>{progress.label}</span>
  </span>;
}

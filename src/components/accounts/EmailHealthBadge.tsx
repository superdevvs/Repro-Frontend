import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';
import type { EmailHealth } from '@/types/auth';
import { getEmailHealthClasses, getEmailHealthLabel } from '@/utils/emailHealth';

interface EmailHealthBadgeProps {
  emailHealth?: EmailHealth;
}

export function EmailHealthBadge({ emailHealth }: EmailHealthBadgeProps) {
  if (!emailHealth) {
    return null;
  }

  const status = emailHealth.status ?? 'unverified';

  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1.5 ${getEmailHealthClasses(status)}`}>
      <Mail className="h-3 w-3 shrink-0" />
      {getEmailHealthLabel(status)}
    </Badge>
  );
}

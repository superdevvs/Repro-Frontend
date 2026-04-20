import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';
import type { EmailHealth } from '@/types/auth';
import { getEmailHealthClasses, getEmailHealthLabel } from '@/utils/emailHealth';

interface EmailHealthBadgeProps {
  emailHealth?: EmailHealth;
}

export function EmailHealthBadge({ emailHealth }: EmailHealthBadgeProps) {
  if (!emailHealth?.status) {
    return null;
  }

  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1.5 ${getEmailHealthClasses(emailHealth.status)}`}>
      <Mail className="h-3 w-3 shrink-0" />
      {getEmailHealthLabel(emailHealth.status)}
    </Badge>
  );
}

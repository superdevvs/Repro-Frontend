import { Badge } from '@/components/ui/badge';
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
    <Badge variant="outline" className={getEmailHealthClasses(emailHealth.status)}>
      {getEmailHealthLabel(emailHealth.status)}
    </Badge>
  );
}

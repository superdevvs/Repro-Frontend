import type React from 'react';
import { BarChart3, Briefcase, Building2, CalendarCheck, FileText, Home, Inbox, KanbanSquare, Mail, UserCheck, Users } from 'lucide-react';
import { useCrmMeta } from '../hooks';

export interface CrmNavItem { to: string; label: string; icon: React.ElementType; count?: number; hot?: boolean; end?: boolean }

export function useCrmNav(): { label: string | null; items: CrmNavItem[] }[] {
  const { data: meta } = useCrmMeta();
  const can = meta?.can;
  const due = meta?.counts.follow_ups_due ?? 0;
  return [
    { label: null, items: [{ to: '/crm', label: 'Home', icon: Home, end: true }] },
    {
      label: 'Sales',
      items: [
        { to: '/crm/pipeline', label: 'Pipeline', icon: KanbanSquare },
        { to: '/crm/contacts', label: 'Contacts', icon: Users },
        { to: '/crm/companies', label: 'Companies', icon: Building2 },
        { to: '/crm/client-pool', label: 'Client pool', icon: UserCheck },
        { to: '/crm/follow-ups', label: 'Follow-ups', icon: CalendarCheck, count: due || undefined, hot: due > 0 },
        { to: '/crm/quotes', label: 'Quotes', icon: FileText },
      ],
    },
    { label: 'Marketing', items: [{ to: '/crm/email', label: 'Email', icon: Mail }] },
    { label: 'Insights', items: [{ to: '/crm/reports', label: 'Reports', icon: BarChart3 }] },
    {
      label: 'Admin',
      items: [
        ...(can?.assign ? [{ to: '/crm/unassigned', label: 'Unassigned', icon: Inbox, count: (meta?.counts.unassigned ?? 0) + (meta?.counts.duplicate_attempts ?? 0) || undefined }] : []),
        ...(can?.recruiting ? [{ to: '/crm/recruiting', label: 'Recruiting', icon: Briefcase }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);
}

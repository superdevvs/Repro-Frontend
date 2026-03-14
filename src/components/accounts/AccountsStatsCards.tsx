import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Users, 
  Shield, 
  ShieldCheck, 
  Camera, 
  Paintbrush, 
  User, 
  UserCheck,
  Briefcase
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

interface RoleStats {
  total: number;
  superadmin: number;
  admin: number;
  editing_manager: number;
  photographer: number;
  editor: number;
  client: number;
  salesRep: number;
}

interface AccountsStatsCardsProps {
  stats: RoleStats;
  selectedRole: string | null;
  onRoleSelect: (role: string | null) => void;
}

const roleConfig = [
  { key: 'total', label: 'Total', shortLabel: 'All', icon: Users, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  { key: 'superadmin', label: 'Super Admin', shortLabel: 'Super', icon: ShieldCheck, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  { key: 'admin', label: 'Admin', shortLabel: 'Admin', icon: Shield, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { key: 'editing_manager', label: 'Editing Mgr', shortLabel: 'Ed. Mgr', icon: Briefcase, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  { key: 'photographer', label: 'Photographers', shortLabel: 'Photo', icon: Camera, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  { key: 'editor', label: 'Editors', shortLabel: 'Edit', icon: Paintbrush, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  { key: 'client', label: 'Clients', shortLabel: 'Client', icon: User, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  { key: 'salesRep', label: 'Sales Reps', shortLabel: 'Sales', icon: UserCheck, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
];

export const AccountsStatsCards: React.FC<AccountsStatsCardsProps> = ({
  stats,
  selectedRole,
  onRoleSelect,
}) => {
  const { role: viewerRole } = useAuth();
  const isSuperAdmin = viewerRole === 'superadmin';

  // Filter out superadmin card for non-superadmin users
  const visibleRoles = roleConfig.filter(role => {
    if (role.key === 'superadmin' && !isSuperAdmin) return false;
    return true;
  });

  return (
    <div className="overflow-x-auto pb-1 -mx-1 px-1 touch-manipulation scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex gap-1.5 sm:gap-2 min-w-max">
        {visibleRoles.map((role) => {
          const Icon = role.icon;
          const count = stats[role.key as keyof RoleStats] || 0;
          const isSelected = selectedRole === (role.key === 'total' ? null : role.key) || 
                            (role.key === 'total' && selectedRole === null);

          return (
            <button
              key={role.key}
              onClick={() => onRoleSelect(role.key === 'total' ? null : role.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full transition-all touch-manipulation',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">
                <span className="hidden sm:inline">{role.label}</span>
                <span className="sm:hidden">{role.shortLabel}</span>
              </span>
              <span className={cn(
                'flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full text-xs font-semibold tabular-nums',
                isSelected
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-foreground/10 text-foreground'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AccountsStatsCards;

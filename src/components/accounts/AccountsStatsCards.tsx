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
  { key: 'total', label: 'Total', shortLabel: 'All', icon: Users, activeBg: 'bg-blue-600 dark:bg-blue-600', activeText: 'text-white' },
  { key: 'superadmin', label: 'Super Admin', shortLabel: 'Super', icon: ShieldCheck, activeBg: 'bg-red-600 dark:bg-red-700', activeText: 'text-white' },
  { key: 'admin', label: 'Admin', shortLabel: 'Admin', icon: Shield, activeBg: 'bg-purple-600 dark:bg-purple-700', activeText: 'text-white' },
  { key: 'editing_manager', label: 'Editing Mgr', shortLabel: 'Ed. Mgr', icon: Briefcase, activeBg: 'bg-violet-600 dark:bg-violet-700', activeText: 'text-white' },
  { key: 'photographer', label: 'Photographers', shortLabel: 'Photo', icon: Camera, activeBg: 'bg-blue-600 dark:bg-blue-700', activeText: 'text-white' },
  { key: 'editor', label: 'Editors', shortLabel: 'Edit', icon: Paintbrush, activeBg: 'bg-amber-600 dark:bg-amber-700', activeText: 'text-white' },
  { key: 'client', label: 'Clients', shortLabel: 'Client', icon: User, activeBg: 'bg-green-600 dark:bg-green-700', activeText: 'text-white' },
  { key: 'salesRep', label: 'Sales Reps', shortLabel: 'Sales', icon: UserCheck, activeBg: 'bg-indigo-600 dark:bg-indigo-700', activeText: 'text-white' },
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
    <div className="overflow-x-auto pt-1 pb-1 -mx-1 px-1 touch-manipulation scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                'flex items-center gap-2 h-10 px-4 rounded-full transition-all touch-manipulation',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected
                  ? `${role.activeBg} ${role.activeText}`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
                  ? 'bg-white/20 text-white'
                  : 'bg-black/10 dark:bg-white/10'
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

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
  { key: 'total', label: 'Total', shortLabel: 'All', icon: Users, activeBg: 'bg-slate-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
  { key: 'superadmin', label: 'Super Admin', shortLabel: 'Super', icon: ShieldCheck, activeBg: 'bg-red-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
  { key: 'admin', label: 'Admin', shortLabel: 'Admin', icon: Shield, activeBg: 'bg-blue-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
  { key: 'editing_manager', label: 'Editing Mgr', shortLabel: 'Ed. Mgr', icon: Briefcase, activeBg: 'bg-violet-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
  { key: 'photographer', label: 'Photographers', shortLabel: 'Photo', icon: Camera, activeBg: 'bg-amber-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
  { key: 'editor', label: 'Editors', shortLabel: 'Edit', icon: Paintbrush, activeBg: 'bg-green-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
  { key: 'client', label: 'Clients', shortLabel: 'Client', icon: User, activeBg: 'bg-cyan-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
  { key: 'salesRep', label: 'Sales Reps', shortLabel: 'Sales', icon: UserCheck, activeBg: 'bg-purple-600', activeText: 'text-white', badgeBg: 'bg-white/20 text-white' },
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
                'flex items-center gap-2 px-3 py-1.5 rounded-full transition-all touch-manipulation',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected
                  ? `${role.activeBg} ${role.activeText}`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">
                <span className="hidden sm:inline">{role.label}</span>
                <span className="sm:hidden">{role.shortLabel}</span>
              </span>
              <span className={cn(
                'flex items-center justify-center h-4.5 min-w-[1.125rem] px-1 rounded-full text-[10px] font-semibold tabular-nums',
                isSelected
                  ? role.badgeBg
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

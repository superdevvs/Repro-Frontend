import type React from 'react';
import { Briefcase, Camera, Crown, Scissors, Shield, User, UserCog } from 'lucide-react';

export const ROLE_ICONS: Record<string, React.ElementType> = {
  superadmin: Crown,
  admin: Shield,
  editing_manager: UserCog,
  salesRep: Briefcase,
  photographer: Camera,
  editor: Scissors,
  client: User,
};

export const FALLBACK_ROLE_ICON: React.ElementType = Shield;

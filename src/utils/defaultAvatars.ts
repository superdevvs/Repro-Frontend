import { API_BASE_URL } from "@/config/env";

// Default avatar system based on role and gender
// Reserved avatars: 01 (superadmin), 11 (admin)
// Female avatars: 03, 05, 06, 08, 09, 12
// Male avatars: 02, 04, 07, 10

export type Gender = 'male' | 'female' | 'unknown';

// All available avatar files
const allAvatars = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

// Reserved avatars for specific roles
const reservedAvatars = {
  superadmin: '01',
  admin: '11',
};

// Female avatars (excluding reserved)
export const femaleAvatars = ['03', '05', '06', '08', '09', '12'];

// Male avatars (excluding reserved)  
export const maleAvatars = ['02', '04', '07', '10'];

// Selectable avatars (excluding reserved 01 and 11)
export const selectableFemaleAvatars = femaleAvatars;
export const selectableMaleAvatars = maleAvatars.filter(a => a !== '11');
export const allSelectableAvatars = [...selectableMaleAvatars, ...selectableFemaleAvatars].sort();

// Role-specific default avatars (for roles without reserved avatars)
const roleDefaultAvatars: Record<string, { male: string; female: string }> = {
  editing_manager: { male: '04', female: '05' },
  photographer: { male: '02', female: '03' },
  editor: { male: '07', female: '06' },
  client: { male: '10', female: '08' },
  salesRep: { male: '04', female: '09' },
};

/**
 * Get the default avatar URL for a user based on their role and gender
 */
export function getDefaultAvatar(
  role?: string,
  gender?: Gender,
  userId?: string | number
): string {
  // Reserved avatars for specific roles
  if (role === 'superadmin') {
    return '/avatars/Avatars-01.png';
  }
  if (role === 'admin') {
    return '/avatars/Avatars-11.png';
  }

  // Determine gender - use userId hash if not specified
  let effectiveGender: 'male' | 'female' = gender === 'female' ? 'female' : 'male';
  if (!gender || gender === 'unknown') {
    // Use user ID to consistently assign a gender for unknown cases
    if (userId) {
      const numericId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      effectiveGender = numericId % 2 === 0 ? 'female' : 'male';
    }
  }

  // Get role-specific avatar or fallback
  const roleConfig = roleDefaultAvatars[role || 'client'] || roleDefaultAvatars.client;
  const avatarNum = effectiveGender === 'female' ? roleConfig.female : roleConfig.male;

  return `/avatars/Avatars-${avatarNum}.png`;
}

/**
 * Get avatar URL - returns custom avatar if set, otherwise default
 */
export function getAvatarUrl(
  customAvatar?: string | null,
  role?: string,
  gender?: Gender,
  userId?: string | number
): string {
  // Check for valid custom avatar - handle edge cases like "null" string, empty strings, etc.
  const invalidValues = ['null', 'undefined', 'none', ''];
  if (customAvatar && customAvatar.trim() && !invalidValues.includes(customAvatar.trim().toLowerCase())) {
    const trimmed = customAvatar.trim();
    const isAbsolute = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:');
    if (isAbsolute) {
      return trimmed;
    }

    const base = String(API_BASE_URL || '').replace(/\/+$/, '');
    let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const isDefaultAvatar = /\/avatars\/Avatars-\d+\.png$/i.test(path);
    if (!isDefaultAvatar && !path.startsWith('/storage') && (path.startsWith('/avatars') || path.startsWith('/branding') || path.startsWith('/uploads'))) {
      path = `/storage${path}`;
    }
    const resolved = isDefaultAvatar ? path : base ? `${base}${path}` : path;
    try {
      return encodeURI(resolved);
    } catch {
      return resolved;
    }
  }
  return getDefaultAvatar(role, gender, userId);
}

/**
 * Check if an avatar is a reserved avatar (01 for superadmin, 11 for admin)
 */
export function isReservedAvatar(avatarPath: string): boolean {
  return avatarPath.includes('Avatars-01.png') || avatarPath.includes('Avatars-11.png');
}

/**
 * Get all selectable avatars for a user (excludes reserved avatars)
 */
export function getSelectableAvatars(): string[] {
  return allSelectableAvatars.map(num => `/avatars/Avatars-${num}.png`);
}

export default {
  getDefaultAvatar,
  getAvatarUrl,
  isReservedAvatar,
  getSelectableAvatars,
  allSelectableAvatars,
  selectableFemaleAvatars,
  selectableMaleAvatars,
};

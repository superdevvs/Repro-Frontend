import { User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-blue-600',
] as const;

export type SmsAvatarPerson = {
  id?: string | number;
  name?: string | null;
  phone?: string | null;
  initials?: string | null;
};

const colorForKey = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const smsPersonInitials = (person: SmsAvatarPerson) => {
  const explicit = person.initials?.trim();
  if (explicit) return explicit.slice(0, 2).toUpperCase();
  const name = (person.name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const digits = (person.phone || '').replace(/\D/g, '');
  return digits.slice(-2) || '?';
};

const personKey = (person: SmsAvatarPerson, index: number) =>
  String(person.id ?? person.phone ?? person.name ?? index);

type CellProps = {
  person?: SmsAvatarPerson | null;
  index: number;
  className?: string;
};

const AvatarCell = ({ person, index, className }: CellProps) => {
  const key = person ? personKey(person, index) : `silhouette-${index}`;
  const color = colorForKey(key);
  const initials = person ? smsPersonInitials(person) : null;

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold leading-none text-white shadow-sm ring-1 ring-background',
        color,
        className,
      )}
      aria-hidden
    >
      {initials ? (
        <span className="select-none">{initials}</span>
      ) : (
        <User className="h-[55%] w-[55%] opacity-95" strokeWidth={2.25} />
      )}
    </div>
  );
};

/**
 * Google Messages–style composite avatar: 2×2 circular grid for groups,
 * single circle for 1:1 threads.
 */
export function SmsThreadAvatar({
  mode,
  person,
  people = [],
  memberCount,
  className,
}: {
  mode: 'direct' | 'group';
  person?: SmsAvatarPerson | null;
  people?: SmsAvatarPerson[];
  memberCount?: number;
  className?: string;
}) {
  if (mode === 'direct') {
    const initials = person
      ? smsPersonInitials(person)
      : '??';
    const key = person ? personKey(person, 0) : 'unknown';
    return (
      <Avatar className={cn('h-12 w-12 shrink-0', className)}>
        <AvatarFallback className={cn('text-sm font-semibold text-white', colorForKey(key))}>
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  const targetSlots = Math.min(4, Math.max(2, memberCount || people.length || 2));
  const slots: Array<SmsAvatarPerson | null> = [];
  for (let i = 0; i < 4; i += 1) {
    if (i < people.length) {
      slots.push(people[i] ?? null);
    } else if (i < targetSlots) {
      slots.push(null); // silhouette filler when we know there are more people
    } else {
      slots.push(null);
    }
  }

  // Always render a 2×2 for groups (Google Messages group treatment).
  return (
    <div
      className={cn(
        'grid h-12 w-12 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 rounded-full p-0.5',
        className,
      )}
      role="img"
      aria-label="Group avatar"
    >
      {slots.map((slot, index) => (
        <AvatarCell
          key={`${personKey(slot ?? {}, index)}-${index}`}
          person={slot}
          index={index}
          className="h-full w-full min-h-0 min-w-0"
        />
      ))}
    </div>
  );
}

export default SmsThreadAvatar;
